import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { MoreThan } from "typeorm";
import { database } from "src/db/data-source";
import { Account } from "src/db/entity/account.entity";
import { Profile } from "src/db/entity/profile.entity";
import { Project } from "src/db/entity/project.entity";
import { ProjectMember, ProjectMemberRole } from "src/db/entity/project-member.entity";
import { ProjectInvite } from "src/db/entity/project-invite.entity";
import { MailService } from "../mail/mail.service";

@Injectable()
export class ProjectService {
	constructor(private mail: MailService) {}

	async createProject(accountId: string, name: string): Promise<Project> {
		const queryRunner = database.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const project = queryRunner.manager.create(Project, { name });
			await queryRunner.manager.save(project);

			const member = queryRunner.manager.create(ProjectMember, {
				accountId,
				projectId: project.id,
				role: ProjectMemberRole.OWNER,
			});
			await queryRunner.manager.save(member);
			await queryRunner.commitTransaction();
			return project;
		} catch (e) {
			await queryRunner.rollbackTransaction();
			throw e;
		} finally {
			await queryRunner.release();
		}
	}

	async getMyProjects(
		accountId: string,
		limit: number,
		offset: number,
		sort: "newest" | "oldest",
	): Promise<{ projects: Project[]; total: number }> {
		const order = sort === "oldest" ? "ASC" : "DESC";
		const qb = database.dataSource.manager
			.createQueryBuilder(Project, "project")
			.innerJoin(ProjectMember, "member", "member.project_id = project.id")
			.where("member.account_id = :accountId", { accountId })
			.orderBy("project.createdAt", order)
			.skip(offset)
			.take(limit);

		const [projects, total] = await qb.getManyAndCount();
		return { projects, total };
	}

	async getProject(accountId: string, projectId: string): Promise<Project> {
		await this.requireMember(accountId, projectId);
		const project = await Project.findOneBy({ id: projectId });
		if (!project) throw new NotFoundException("Project not found");
		return project;
	}

	async updateProject(accountId: string, projectId: string, name: string): Promise<Project> {
		const member = await this.requireMember(accountId, projectId);
		if (member.role === ProjectMemberRole.VIEWER) {
			throw new ForbiddenException("Insufficient permissions");
		}
		const project = await Project.findOneBy({ id: projectId });
		if (!project) throw new NotFoundException("Project not found");
		project.name = name;
		await project.save();
		return project;
	}

	async deleteProject(accountId: string, projectId: string): Promise<void> {
		const member = await this.requireMember(accountId, projectId);
		if (member.role !== ProjectMemberRole.OWNER) {
			throw new ForbiddenException("Only the owner can delete a project");
		}
		const project = await Project.findOneBy({ id: projectId });
		if (!project) throw new NotFoundException("Project not found");

		await database.dataSource.transaction(async (manager) => {
			const members = await manager.findBy(ProjectMember, { projectId });
			await manager.softRemove(ProjectMember, members);
			await manager.softRemove(Project, project);
		});
	}

	async getMembers(accountId: string, projectId: string): Promise<ProjectMember[]> {
		await this.requireMember(accountId, projectId);
		return ProjectMember.findBy({ projectId });
	}

	async getMember(accountId: string, memberId: string): Promise<ProjectMember> {
		const member = await ProjectMember.findOneBy({ id: memberId });
		if (!member) throw new NotFoundException("Member not found");
		await this.requireMember(accountId, member.projectId);
		return member;
	}

	async updateMember(
		accountId: string,
		memberId: string,
		role: ProjectMemberRole,
	): Promise<ProjectMember> {
		const member = await ProjectMember.findOneBy({ id: memberId });
		if (!member) throw new NotFoundException("Member not found");

		const requester = await this.requireMember(accountId, member.projectId);
		if (requester.role !== ProjectMemberRole.OWNER) {
			throw new ForbiddenException("Only the owner can change member roles");
		}
		if (member.role === ProjectMemberRole.OWNER) {
			throw new BadRequestException("Cannot change the owner's role");
		}
		if (role === ProjectMemberRole.OWNER) {
			throw new BadRequestException("Cannot assign owner role");
		}

		member.role = role;
		await member.save();
		return member;
	}

	async removeMember(accountId: string, memberId: string): Promise<void> {
		const member = await ProjectMember.findOneBy({ id: memberId });
		if (!member) throw new NotFoundException("Member not found");

		const requester = await this.requireMember(accountId, member.projectId);
		const isSelf = member.accountId === accountId;
		const isOwner = requester.role === ProjectMemberRole.OWNER;

		if (!isSelf && !isOwner) {
			throw new ForbiddenException("Only the owner can remove other members");
		}
		if (member.role === ProjectMemberRole.OWNER) {
			throw new BadRequestException("Cannot remove the project owner");
		}

		await member.softRemove();
	}

	// ── Invites ───────────────────────────────────────────────────────────────

	async sendInvite(
		accountId: string,
		projectId: string,
		email: string,
	): Promise<ProjectInvite> {
		const requester = await this.requireMember(accountId, projectId);
		if (requester.role !== ProjectMemberRole.OWNER) {
			throw new ForbiddenException("Only the owner can invite members");
		}

		const project = await Project.findOneBy({ id: projectId });
		if (!project) throw new NotFoundException("Project not found");

		// Check not already a member
		const existingMember = await database.dataSource.manager
			.createQueryBuilder(ProjectMember, "member")
			.innerJoin(Account, "account", "account.id = member.account_id")
			.where("member.project_id = :projectId", { projectId })
			.andWhere("account.email = :email", { email })
			.getOne();
		if (existingMember) {
			throw new ConflictException("This email is already a project member");
		}

		// Check no pending invite for same email+project
		const existingInvite = await ProjectInvite.findOne({
			where: { projectId, email, expiresAt: MoreThan(new Date()) },
		});
		if (existingInvite) {
			throw new ConflictException("An invite for this email is already pending");
		}

		const [inviterProfile] = await Promise.all([
			Profile.findOneBy({ accountId }),
		]);
		const inviterName = inviterProfile?.username ?? "A team member";

		const token = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

		const invite = ProjectInvite.create({ projectId, email, token, expiresAt });
		await invite.save();

		void this.mail.sendProjectInvite(inviterName, project.name, email, token);

		return invite;
	}

	async acceptInvite(accountId: string, token: string): Promise<ProjectMember> {
		const account = await Account.findOneBy({ id: accountId });
		if (!account) throw new NotFoundException("Account not found");

		const invite = await ProjectInvite.findOne({
			where: { token, expiresAt: MoreThan(new Date()) },
		});
		if (!invite) throw new NotFoundException("Invite not found or has expired");

		if (invite.email !== account.email) {
			throw new ForbiddenException("This invite was sent to a different email address");
		}

		const alreadyMember = await ProjectMember.findOneBy({
			accountId,
			projectId: invite.projectId,
		});
		if (alreadyMember) {
			await invite.remove();
			throw new ConflictException("You are already a member of this project");
		}

		const member = ProjectMember.create({
			accountId,
			projectId: invite.projectId,
			role: ProjectMemberRole.VIEWER,
		});
		await member.save();
		await invite.remove();

		return member;
	}

	private async requireMember(accountId: string, projectId: string): Promise<ProjectMember> {
		const member = await ProjectMember.findOneBy({ accountId, projectId });
		if (!member) throw new ForbiddenException("You are not a member of this project");
		return member;
	}
}
