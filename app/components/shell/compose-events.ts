// Cross-tree signaling for the compose overlay. Studio's page tree has no
// direct reference to AppShell's state, and HomeTimeline mounts once with
// its own local state, so opening the composer and reporting a fresh post
// cross those boundaries via window events instead of prop drilling.
export const OPEN_COMPOSE_EVENT = 'snackd:open-compose';
export const PUBLISHED_EVENT = 'snackd:published';
