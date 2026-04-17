import { Injectable } from '@nestjs/common';
import { cassandraDatabase } from './cassandra.client';
import { Commit } from 'src/draw/commit';
import { KonvaStageConfig, buildSnapshot } from 'src/draw/build-snapshot';

export interface SnapshotRow {
  version: number;
  body: KonvaStageConfig;
}

export interface CommitRow {
  number: number;
  previous: number;
  changes: string;
}

/** Empty canvas stage used as the initial snapshot (version 0). */
const EMPTY_STAGE: KonvaStageConfig = {
  className: 'Stage',
  attrs: {},
  children: [],
};

@Injectable()
export class CassandraService {
  private get client() {
    return cassandraDatabase.client;
  }

  /**
   * Initialises a new canvas in Cassandra by inserting snapshot version 0
   * (empty stage). Called once when a canvas is created via the REST API.
   */
  async initCanvas(canvaId: string): Promise<void> {
    await this.client.execute(
      `INSERT INTO snapshots (canva_id, version, body, created_at)
       VALUES (?, 0, ?, toTimestamp(now()))`,
      [canvaId, JSON.stringify(EMPTY_STAGE)],
      { prepare: true },
    );
  }

  /**
   * Returns the most recent snapshot for the canvas.
   * Always returns at least the empty snapshot inserted by initCanvas.
   */
  async getLatestSnapshot(canvaId: string): Promise<SnapshotRow> {
    const result = await this.client.execute(
      `SELECT version, body FROM snapshots
       WHERE canva_id = ? LIMIT 1`,
      [canvaId],
      { prepare: true },
    );

    if (result.rowLength === 0) {
      // Fallback: treat missing snapshot as version 0 empty canvas.
      return { version: 0, body: EMPTY_STAGE };
    }

    const row = result.first();
    return {
      version: row.version as number,
      body: JSON.parse(row.body as string) as KonvaStageConfig,
    };
  }

  /**
   * Returns all commits whose number is strictly greater than afterNumber,
   * ordered ascending. Used on canvas load to fetch commits after the latest snapshot.
   */
  async getCommitsAfter(canvaId: string, afterNumber: number): Promise<Commit[]> {
    const result = await this.client.execute(
      `SELECT number, previous, changes FROM commits
       WHERE canva_id = ? AND number > ?`,
      [canvaId, afterNumber],
      { prepare: true },
    );

    return result.rows
      .map((row) => ({
        number: row.number as number,
        previous: row.previous as number,
        changes: JSON.parse(row.changes as string),
      }))
      .sort((a, b) => a.number - b.number);
  }

  /**
   * Returns commits in the range [fromNumber, toNumber] inclusive, ascending.
   * Used when computing a new snapshot to replay the last SNAPSHOT_INTERVAL commits.
   */
  async getCommitRange(canvaId: string, fromNumber: number, toNumber: number): Promise<Commit[]> {
    const result = await this.client.execute(
      `SELECT number, previous, changes FROM commits
       WHERE canva_id = ? AND number >= ? AND number <= ?`,
      [canvaId, fromNumber, toNumber],
      { prepare: true },
    );

    return result.rows
      .map((row) => ({
        number: row.number as number,
        previous: row.previous as number,
        changes: JSON.parse(row.changes as string),
      }))
      .sort((a, b) => a.number - b.number);
  }

  /**
   * Returns the highest commit number stored for the canvas, or 0 if none exist.
   * Used at the start of each commit flow to determine the next sequential number.
   */
  async getMaxCommitNumber(canvaId: string): Promise<number> {
    const result = await this.client.execute(
      `SELECT number FROM commits
       WHERE canva_id = ? LIMIT 1`,
      [canvaId],
      { prepare: true },
    );

    if (result.rowLength === 0) return 0;
    return result.first().number as number;
  }

  /**
   * Attempts to insert a commit using lightweight transactions (IF NOT EXISTS).
   * Returns true if the insert succeeded, false if another writer raced us
   * to the same commit number (i.e. [applied] = false).
   *
   * The caller must retry from getMaxCommitNumber on false.
   */
  async insertCommit(canvaId: string, commit: Commit): Promise<boolean> {
    const result = await this.client.execute(
      `INSERT INTO commits (canva_id, number, previous, changes, created_at)
       VALUES (?, ?, ?, ?, toTimestamp(now()))
       IF NOT EXISTS`,
      [canvaId, commit.number, commit.previous, JSON.stringify(commit.changes)],
      { prepare: true },
    );

    return result.first()['[applied]'] as boolean;
  }

  /**
   * Inserts a pre-computed snapshot.
   * Called automatically after every SNAPSHOT_INTERVAL commits.
   */
  async insertSnapshot(canvaId: string, version: number, body: KonvaStageConfig): Promise<void> {
    await this.client.execute(
      `INSERT INTO snapshots (canva_id, version, body, created_at)
       VALUES (?, ?, ?, toTimestamp(now()))`,
      [canvaId, version, JSON.stringify(body)],
      { prepare: true },
    );
  }

  /**
   * Computes and stores the next snapshot by replaying SNAPSHOT_INTERVAL commits
   * on top of the previous snapshot.
   *
   * Snapshot version k covers state at commit k * SNAPSHOT_INTERVAL.
   * Returns the new snapshot so the caller can broadcast it to room members.
   */
  async computeAndStoreSnapshot(
    canvaId: string,
    newVersion: number,
    snapshotInterval: number,
  ): Promise<{ snapshot: SnapshotRow; commits: Commit[] }> {
    // Load the snapshot immediately before the new one.
    const prevVersionNumber = (newVersion - 1) * snapshotInterval;
    const prevSnapshot = await this.getLatestSnapshot(canvaId);

    // Commits that fall between the previous and new snapshot boundary.
    const fromCommit = prevVersionNumber + 1;
    const toCommit = newVersion * snapshotInterval;
    const commits = await this.getCommitRange(canvaId, fromCommit, toCommit);

    const newBody = buildSnapshot(prevSnapshot.body, commits);
    await this.insertSnapshot(canvaId, newVersion, newBody);

    // After the new snapshot we only keep commits that came after it.
    const remainingCommits = await this.getCommitsAfter(canvaId, toCommit);

    return {
      snapshot: { version: newVersion, body: newBody },
      commits: remainingCommits,
    };
  }
}
