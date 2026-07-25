import { Component, type ReactNode } from "react";
import { EmptyState } from "../../../components/ui";

interface ExcalidrawErrorBoundaryProps {
  children: ReactNode;
}

interface ExcalidrawErrorBoundaryState {
  crashed: boolean;
}

/**
 * Guards against @excalidraw/excalidraw throwing at runtime (it ships a
 * preact-compatible build gated by IS_PREACT — vite.config sets that, but
 * we still don't want a canvas bug to take down the whole Solve screen).
 * Falls back to a minimal notice rather than blanking the panel.
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
    console.error("Excalidraw canvas crashed:", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <EmptyState
          title="Drawing canvas unavailable"
          description="The sketch pad hit a runtime error. Your notes below are unaffected."
        />
      );
    }
    return this.props.children;
  }
}
