import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { database } from 'src/db/data-source';
import { Canva } from 'src/db/entity/canva.entity';
import { ProjectMember, ProjectMemberRole } from 'src/db/entity/project-member.entity';
import { CassandraService } from 'src/db/cassandra/cassandra.service';

@Injectable()
export class CanvaService {
	constructor(private readonly cassandra: CassandraService) {}

	async getCanvases(
		accountId: string,
		projectId: string,
		limit: number,
		offset: number,
		sort: 'newest' | 'oldest',
	): Promise<{ canvases: Canva[]; total: number }> {
		await this.requireMember(accountId, projectId);

		const order = sort === 'oldest' ? 'ASC' : 'DESC';
		const [canvases, total] = await database.dataSource.manager
			.createQueryBuilder(Canva, 'canva')
			.where('canva.projectId = :projectId', { projectId })
			.orderBy('canva.createdAt', order)
			.skip(offset)
			.take(limit)
			.getManyAndCount();

		return { canvases, total };
	}

	async getCanva(accountId: string, canvaId: string): Promise<Canva> {
		const canva = await this.findCanva(canvaId);
		await this.requireMember(accountId, canva.projectId);
		return canva;
	}

	async createCanva(accountId: string, projectId: string, name: string): Promise<Canva> {
		await this.requireEditorOrOwner(accountId, projectId);
		const canva = Canva.create({ projectId, name });
		await canva.save();
		await this.cassandra.initCanvas(canva.id);
		return canva;
	}

	async updateCanva(accountId: string, canvaId: string, name: string): Promise<Canva> {
		const canva = await this.findCanva(canvaId);
		await this.requireEditorOrOwner(accountId, canva.projectId);
		canva.name = name;
		await canva.save();
		return canva;
	}

	async deleteCanva(accountId: string, canvaId: string): Promise<void> {
		const canva = await this.findCanva(canvaId);
		await this.requireEditorOrOwner(accountId, canva.projectId);
		await canva.softRemove();
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	private async findCanva(canvaId: string): Promise<Canva> {
		const canva = await Canva.findOneBy({ id: canvaId });
		if (!canva) throw new NotFoundException('Canvas not found');
		return canva;
	}

	private async requireMember(accountId: string, projectId: string): Promise<ProjectMember> {
		const member = await ProjectMember.findOneBy({ accountId, projectId });
		if (!member) throw new ForbiddenException('You are not a member of this project');
		return member;
	}

	private async requireEditorOrOwner(accountId: string, projectId: string): Promise<void> {
		const member = await this.requireMember(accountId, projectId);
		if (member.role === ProjectMemberRole.VIEWER) {
			throw new ForbiddenException('Insufficient permissions');
		}
	}
}
