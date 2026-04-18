import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Canva } from 'src/db/entity/canva.entity';
import { ProjectMember, ProjectMemberRole } from 'src/db/entity/project-member.entity';
import { CassandraService, CommitRow, SnapshotRow } from 'src/db/cassandra/cassandra.service';
import { Commit, Operation } from '@paranoideed/drawebster';

export interface CanvasState {
	snapshot: SnapshotRow;
	commits: CommitRow[];
}

export interface CommitPayload {
	previous: number;
	changes: Operation[];
}

export interface CommitResult {
	commit: Commit;
	new_state?: CanvasState;
}

const MAX_RETRIES = 5;

@Injectable()
export class DrawService {
	private readonly logger = new Logger(DrawService.name);

	private readonly snapshotInterval: number;

	constructor(
		private readonly cassandra: CassandraService,
		private readonly config: ConfigService,
	) {
		this.snapshotInterval = this.config.get<number>('SNAPSHOT_INTERVAL', 10);
	}

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

	async getCanvasState(canvaId: string): Promise<CanvasState> {
		const snapshot = await this.cassandra.getLatestSnapshot(canvaId);
		const snapshotCommitBoundary = snapshot.version * this.snapshotInterval;
		const commits = await this.cassandra.getCommitsAfter(canvaId, snapshotCommitBoundary);
		return { snapshot, commits };
	}

	async validateHead(canvaId: string, head: number): Promise<string | null> {
		const [snapshot, maxNumber] = await Promise.all([
			this.cassandra.getLatestSnapshot(canvaId),
			this.cassandra.getMaxCommitNumber(canvaId),
		]);

		const minHead = snapshot.version * this.snapshotInterval;

		if (head < minHead) return `head ${head} is before snapshot boundary ${minHead}`;
		if (head > maxNumber) return `head ${head} exceeds latest commit ${maxNumber}`;

		return null;
	}

	async processCommit(canvaId: string, payload: CommitPayload): Promise<CommitResult> {
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
			let new_state: CanvasState | undefined;

			if (nextNumber >= 2 * this.snapshotInterval && nextNumber % this.snapshotInterval === 0) {
				const newSnapshotVersion = nextNumber / this.snapshotInterval - 1;
				const { snapshot, commits } = await this.cassandra.computeAndStoreSnapshot(
					canvaId,
					newSnapshotVersion,
					this.snapshotInterval,
				);
				new_state = { snapshot, commits };
			}

			return { commit, new_state };
		}

		throw new Error(`Failed to insert commit after ${MAX_RETRIES} retries (canva ${canvaId})`);
	}
}
