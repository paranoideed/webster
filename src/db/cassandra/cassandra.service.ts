import { Injectable } from '@nestjs/common';
import { cassandraDatabase } from './cassandra.client';
import { Commit } from '@paranoideed/drawebster';
import { Operation } from '@paranoideed/drawebster';
import { KonvaStageConfig, buildSnapshot } from '@paranoideed/drawebster';

export interface SnapshotRow {
	version: number;
	body: KonvaStageConfig;
	created_at: Date;
}

/** Commit as stored in Cassandra, with parsed changes and created_at for observability. */
export interface CommitRow {
	number: number;
	previous: number;
	changes: Operation[];
	created_at: Date;
}

/** Initial canvas snapshot: 1280×720, transparent background, one empty layer. */
const EMPTY_STAGE: KonvaStageConfig = {
	className: 'Stage',
	attrs: { width: 1280, height: 720 },
	children: [
		{
			className: 'Layer',
			attrs: { id: 'layer-1' },
			children: [],
		},
	],
};

@Injectable()
export class CassandraService {
	private get client() {
		return cassandraDatabase.client;
	}

	async initCanvas(canvaId: string): Promise<void> {
		await this.client.execute(
			`INSERT INTO snapshots (canva_id, version, body, created_at)
			 VALUES (?, 0, ?, toTimestamp(now()))`,
			[canvaId, JSON.stringify(EMPTY_STAGE)],
			{ prepare: true },
		);
	}

	async getLatestSnapshot(canvaId: string): Promise<SnapshotRow> {
		const result = await this.client.execute(
			`SELECT version, body, created_at FROM snapshots
			 WHERE canva_id = ? LIMIT 1`,
			[canvaId],
			{ prepare: true },
		);

		if (result.rowLength === 0) {
			return { version: 0, body: EMPTY_STAGE, created_at: new Date(0) };
		}

		const row = result.first();
		return {
			version: row.version as number,
			body: JSON.parse(row.body as string) as KonvaStageConfig,
			created_at: new Date(row.created_at as string),
		};
	}

	async getCommitsAfter(canvaId: string, afterNumber: number): Promise<CommitRow[]> {
		const result = await this.client.execute(
			`SELECT number, previous, changes, created_at FROM commits
			 WHERE canva_id = ? AND number > ?`,
			[canvaId, afterNumber],
			{ prepare: true },
		);

		return result.rows
			.map((row) => ({
				number: row.number as number,
				previous: row.previous as number,
				changes: JSON.parse(row.changes as string),
				created_at: new Date(row.created_at as string),
			}))
			.sort((a, b) => a.number - b.number);
	}

	async getCommitRange(canvaId: string, fromNumber: number, toNumber: number): Promise<CommitRow[]> {
		const result = await this.client.execute(
			`SELECT number, previous, changes, created_at FROM commits
			 WHERE canva_id = ? AND number >= ? AND number <= ?`,
			[canvaId, fromNumber, toNumber],
			{ prepare: true },
		);

		return result.rows
			.map((row) => ({
				number: row.number as number,
				previous: row.previous as number,
				changes: JSON.parse(row.changes as string),
				created_at: new Date(row.created_at as string),
			}))
			.sort((a, b) => a.number - b.number);
	}

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

	async insertSnapshot(canvaId: string, version: number, body: KonvaStageConfig): Promise<void> {
		await this.client.execute(
			`INSERT INTO snapshots (canva_id, version, body, created_at)
			 VALUES (?, ?, ?, toTimestamp(now()))`,
			[canvaId, version, JSON.stringify(body)],
			{ prepare: true },
		);
	}

	async computeAndStoreSnapshot(
		canvaId: string,
		newVersion: number, //1
		snapshotInterval: number, //10
	): Promise<{ snapshot: SnapshotRow; commits: CommitRow[] }> {
		const prevVersionNumber = (newVersion - 1) * snapshotInterval;
		const prevSnapshot = await this.getLatestSnapshot(canvaId);

		const fromCommit = prevVersionNumber + 1;
		const toCommit = newVersion * snapshotInterval;
		const commits = await this.getCommitRange(canvaId, fromCommit, toCommit);

		const newBody = buildSnapshot(prevSnapshot.body, commits);
		await this.insertSnapshot(canvaId, newVersion, newBody);

		const remainingCommits = await this.getCommitsAfter(canvaId, toCommit);

		return {
			snapshot: { version: newVersion, body: newBody, created_at: new Date() },
			commits: remainingCommits,
		};
	}
}
