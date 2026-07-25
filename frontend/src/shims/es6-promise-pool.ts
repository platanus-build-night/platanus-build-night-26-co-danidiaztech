/**
 * Minimal ESM replacement for the `es6-promise-pool` UMD package.
 *
 * Why this exists: `es6-promise-pool` assigns its constructor straight to
 * `module.exports` with no `.default`. Under Vite 8 / Rolldown the CJS→ESM
 * interop shim isn't applied, so Excalidraw's `import Pool from
 * "es6-promise-pool"` resolves to `undefined` and it dies on `new Pool(...)`
 * with "import_es6_promise_pool.default is not a constructor". Neither
 * `optimizeDeps.include` nor `optimizeDeps.needsInterop` fixed it, so
 * `vite.config.ts` aliases the specifier here instead.
 *
 * Scope is deliberately narrow — exactly the surface Excalidraw uses for font
 * loading: construct with a generator of promises plus a concurrency cap,
 * subscribe to "fulfilled", and await `start()`. Rejection semantics match the
 * original: the first failure rejects the pool.
 */

interface PoolEvent<T> {
  type: string;
  target: PromisePool<T>;
  data: { promise: Promise<T>; result?: T; error?: unknown };
}

type Listener<T> = (event: PoolEvent<T>) => void;

export default class PromisePool<T = unknown> {
  private readonly iterator: Iterator<Promise<T>>;
  private readonly concurrency: number;
  private readonly listeners: Record<string, Listener<T>[]> = {};

  private size = 0;
  private done = false;
  private settled = false;
  private resolveAll: (() => void) | null = null;
  private rejectAll: ((err: unknown) => void) | null = null;

  constructor(source: Iterable<Promise<T>> | Iterator<Promise<T>>, concurrency: number) {
    // Accept either a generator object (what Excalidraw passes) or any iterable.
    const maybeIterable = source as Iterable<Promise<T>>;
    this.iterator =
      typeof maybeIterable[Symbol.iterator] === "function"
        ? maybeIterable[Symbol.iterator]()
        : (source as Iterator<Promise<T>>);
    this.concurrency = Math.max(1, concurrency);
  }

  addEventListener(type: string, listener: Listener<T>): void {
    (this.listeners[type] ||= []).push(listener);
  }

  removeEventListener(type: string, listener: Listener<T>): void {
    const list = this.listeners[type];
    if (!list) return;
    const i = list.indexOf(listener);
    if (i >= 0) list.splice(i, 1);
  }

  private emit(type: string, data: PoolEvent<T>["data"]): void {
    for (const listener of this.listeners[type] ?? []) {
      listener({ type, target: this, data });
    }
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.resolveAll = resolve;
      this.rejectAll = reject;
      this.pump();
    });
  }

  /** Top the pool back up to `concurrency` in-flight promises. */
  private pump(): void {
    if (this.settled) return;

    while (!this.done && this.size < this.concurrency) {
      const next = this.iterator.next();
      if (next.done) {
        this.done = true;
        break;
      }
      this.size++;
      this.track(Promise.resolve(next.value));
    }

    if (this.done && this.size === 0) this.settle();
  }

  private track(promise: Promise<T>): void {
    promise.then(
      (result) => {
        this.size--;
        this.emit("fulfilled", { promise, result });
        this.pump();
      },
      (error) => {
        this.size--;
        this.emit("rejected", { promise, error });
        // Matches the original: the first rejection fails the whole pool.
        if (!this.settled) {
          this.settled = true;
          this.rejectAll?.(error);
        }
      }
    );
  }

  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveAll?.();
  }
}
