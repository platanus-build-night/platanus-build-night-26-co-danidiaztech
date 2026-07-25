import { Component, type ReactNode } from "react";

interface ExcalidrawErrorBoundaryProps {
  children: ReactNode;
  /** Rendered in place of the crashed canvas — see CanvasFallback. */
  fallback: ReactNode;
}

interface ExcalidrawErrorBoundaryState {
  crashed: boolean;
}

/**
 * Guards against @excalidraw/excalidraw throwing at runtime. In practice it
 * does: this version throws `import_es6_promise_pool.default is not a
 * constructor` during scene font loading (a CJS/ESM interop bug in one of
 * its deps, unrelated to the IS_PREACT flag vite.config already sets),
 * which cascades into a "Maximum update depth exceeded" crash. Rather than
 * take down the whole Solve screen, we swap in the minimal canvas-pad
 * fallback.
 */
export class ExcalidrawErrorBoundary extends Component<
  ExcalidrawErrorBoundaryProps,
  ExcalidrawErrorBoundaryState
> {
  state: ExcalidrawErrorBoundaryState = { crashed: false };

  static getDerivedStateFromError(): ExcalidrawErrorBoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Excalidraw canvas crashed, using fallback pad:", error);
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}
