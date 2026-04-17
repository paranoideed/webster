import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Canva } from 'src/db/entity/canva.entity';
import { ProjectMember, ProjectMemberRole } from 'src/db/entity/project-member.entity';
import { CassandraService, SnapshotRow } from 'src/db/cassandra/cassandra.service';
import { SNAPSHOT_INTERVAL } from 'src/draw/constants';
import { Commit } from 'src/draw/commit';
import { Operation } from 'src/draw/operation';

/** Shape returned to the client on join and after a new snapshot is computed. */
export interface CanvasState {
  snapshot: SnapshotRow;
  commits: Commit[];
}

/** Payload the client sends with a commit event. */
export interface CommitPayload {
  previous: number;
  changes: Operation[];
}

/** Payload sent by both undo and redo events. */
export interface UndoRedoPayload {
  head: number;
}

/** Maximum number of optimistic-concurrency retries for a single commit. */
const MAX_RETRIES = 5;

@Injectable()
export class CanvaWsService {
  private readonly logger = new Logger(CanvaWsService.name);

  constructor(private readonly cassandra: CassandraService) {}

  /**
   * Verifies that the account is a member of the project that owns the canvas.
   * Throws ForbiddenException / NotFoundException on failure.
   * Returns the projectId of the canvas so the caller can build the room name.
   */
  async checkAccess(accountId: string, canvaId: string): Promise<string> {
    const canva = await Canva.findOneBy({ id: canvaId });
    if (!canva) throw new NotFoundException('Canvas not found');

    const member = await ProjectMember.findOneBy({
      accountId,
      projectId: canva.projectId,
    });
    if (!member) throw new ForbiddenException('Not a member of this project');

    return canva.projectId;
  }

  /**
   * Verifies editor/owner access for write operations (commit).
   * Viewers are not allowed to push commits.
   */
  async checkWriteAccess(accountId: string, canvaId: string): Promise<void> {
    const canva = await Canva.findOneBy({ id: canvaId });
    if (!canva) throw new NotFoundException('Canvas not found');

    const member = await ProjectMember.findOneBy({
      accountId,
      projectId: canva.projectId,
    });
    if (!member) throw new ForbiddenException('Not a member of this project');
    if (member.role === ProjectMemberRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot push commits');
    }
  }

  /**
   * Loads the current canvas state from Cassandra:
   * 1. Reads the latest snapshot.
   * 2. Reads all commits whose number exceeds the snapshot boundary.
   * 3. Returns both so the client can reconstruct the current canvas stage.
   */
  async getCanvasState(canvaId: string): Promise<CanvasState> {
    const snapshot = await this.cassandra.getLatestSnapshot(canvaId);

    // Snapshot version k covers commit k * SNAPSHOT_INTERVAL.
    const snapshotCommitBoundary = snapshot.version * SNAPSHOT_INTERVAL;
    const commits = await this.cassandra.getCommitsAfter(canvaId, snapshotCommitBoundary);

    return { snapshot, commits };
  }

  /**
   * Processes a new commit from a client using optimistic concurrency:
   *
   * 1. Reads MAX(number) from Cassandra to determine next = MAX + 1.
   * 2. Attempts INSERT IF NOT EXISTS.
   * 3. On conflict (another writer won), retries up to MAX_RETRIES times.
   * 4. If next commit number hits a snapshot boundary, computes and stores
   *    a new snapshot and returns it alongside the stored commit.
   *
   * Returns:
   *  - commit: the stored commit (with server-assigned number)
   *  - newState: set only when a new snapshot was created; contains the
   *    updated snapshot and the commits after it (for broadcast).
   */
  async processCommit(
    canvaId: string,
    payload: CommitPayload,
  ): Promise<{ commit: Commit; newState?: CanvasState }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const maxNumber = await this.cassandra.getMaxCommitNumber(canvaId);
      const nextNumber = maxNumber + 1;

      const commit: Commit = {
        number: nextNumber,
        previous: payload.previous,
        changes: payload.changes,
      };

      const applied = await this.cassandra.insertCommit(canvaId, commit);
      if (!applied) {
        this.logger.warn(`Commit conflict for canva ${canvaId}, retrying (attempt ${attempt + 1})`);
        continue;
      }

      // Snapshot boundary: at 2n, 3n, 4n, …
      let newState: CanvasState | undefined;
      if (nextNumber >= 2 * SNAPSHOT_INTERVAL && nextNumber % SNAPSHOT_INTERVAL === 0) {
        const newSnapshotVersion = nextNumber / SNAPSHOT_INTERVAL;
        const { snapshot, commits } = await this.cassandra.computeAndStoreSnapshot(
          canvaId,
          newSnapshotVersion,
          SNAPSHOT_INTERVAL,
        );
        newState = { snapshot, commits };
      }

      return { commit, newState };
    }

    throw new Error(`Failed to insert commit after ${MAX_RETRIES} retries (canva ${canvaId})`);
  }
}
