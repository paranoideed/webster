/**
 * Number of commits between consecutive snapshots.
 * A new snapshot is computed and broadcast to all room members
 * every SNAPSHOT_INTERVAL commits (at commit numbers n*2, n*3, n*4, …).
 * The snapshot always lags one interval behind the current HEAD.
 */
export const SNAPSHOT_INTERVAL = 20;
