import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { database } from 'src/db/data-source';
import { Canva } from 'src/db/entity/canva.entity';
import { ProjectMember, ProjectMemberRole } from 'src/db/entity/project-member.entity';

@Injectable()
export class CanvaService {

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

	async getCanva(accountId: string, projectId: string, canvaId: string): Promise<Canva> {
		await this.requireMember(accountId, projectId);
		return this.findCanva(canvaId, projectId);
	}

	async createCanva(accountId: string, projectId: string, name: string): Promise<Canva> {
		await this.requireEditorOrOwner(accountId, projectId);
		const canva = Canva.create({ projectId, name });
		await canva.save();
		return canva;
	}

	async updateCanva(
		accountId: string,
		projectId: string,
		canvaId: string,
		name: string,
	): Promise<Canva> {
		await this.requireEditorOrOwner(accountId, projectId);
		const canva = await this.findCanva(canvaId, projectId);
		canva.name = name;
		await canva.save();
		return canva;
	}

	async deleteCanva(accountId: string, projectId: string, canvaId: string): Promise<void> {
		await this.requireEditorOrOwner(accountId, projectId);
		const canva = await this.findCanva(canvaId, projectId);
		await canva.softRemove();
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	private async findCanva(canvaId: string, projectId: string): Promise<Canva> {
		const canva = await Canva.findOneBy({ id: canvaId, projectId });
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
