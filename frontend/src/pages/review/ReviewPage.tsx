import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { SessionDetail } from "../../lib/types";
import { Badge, EmptyState, Panel, PageHeader, Spinner, ThemeToggle } from "../../components/ui";

/**
 * Placeholder for the review wireframe (summary card | timeframe player).
 * Owned by Agent D — this is scaffolding that proves the route + API wiring
 * work end-to-end; Agent D replaces the body with the full player.
 */
export function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api
      .getSession(Number(sessionId))
      .then(setSession)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load session"));
  }, [sessionId]);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6">
      <PageHeader
        title={session ? `Review — session #${session.id}` : "Review"}
        subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
        actions={<ThemeToggle />}
      />

      {error && <EmptyState title="Could not load session" description={error} />}

      {!error && !session && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading session…
        </div>
      )}

      {session && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pb-6 md:grid-cols-[320px_1fr]">
          <Panel title="Summary">
            <div className="space-y-2 text-sm text-text">
              <div className="flex justify-between">
                <span className="text-text-muted">Status</span>
                <Badge tone={session.status === "finished" ? "success" : "accent"}>
                  {session.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Language</span>
                <span>{session.language}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Events</span>
                <span>{session.events.length}</span>
              </div>
            </div>
          </Panel>
          <Panel title="Timeframe player (placeholder)">
            <EmptyState
              title="Replay coming soon"
              description="Code reconstruction, transcript strip, phase timeline, and playback controls land here."
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
