import { Project } from "src/db/entity/project.entity";
import { ProjectMember } from "src/db/entity/project-member.entity";
import { ProjectInvite } from "src/db/entity/project-invite.entity";
import { stripNulls } from "../shared/s3.uploader";

export function projectData(project: Project) {
	return {
		id: project.id,
		type: "project",
		attributes: {
			name: project.name,
			created_at: project.createdAt,
			updated_at: project.updatedAt,
		},
	};
}

export function projectResponse(project: Project) {
	return { data: projectData(project) };
}

export function projectsResponse(
	projects: Project[],
	total: number,
	limit: number,
	offset: number,
	sort: string,
	baseUrl: string,
) {
	const currentPage = Math.floor(offset / limit);
	const lastPage = Math.max(0, Math.floor((total - 1) / limit));
	const link = (o: number) =>
		`${baseUrl}?page[limit]=${limit}&page[offset]=${o}&sort=${sort}`;

	return {
		data: projects.map(projectData),
		links: stripNulls({
			self: link(offset),
			first: link(0),
			last: link(lastPage * limit),
			prev: currentPage > 0 ? link((currentPage - 1) * limit) : null,
			next: currentPage < lastPage ? link((currentPage + 1) * limit) : null,
		}),
	};
}

export function memberData(member: ProjectMember) {
	return {
		id: member.id,
		type: "project_member",
		attributes: {
			account_id: member.accountId,
			project_id: member.projectId,
			role: member.role,
			created_at: member.createdAt,
			updated_at: member.updatedAt,
		},
	};
}

export function memberResponse(member: ProjectMember) {
	return { data: memberData(member) };
}

export function membersResponse(members: ProjectMember[]) {
	return { data: members.map(memberData) };
}

export function inviteData(invite: ProjectInvite) {
	return {
		id: invite.id,
		type: "project_invite",
		attributes: {
			project_id: invite.projectId,
			email: invite.email,
			invited_by: invite.invitedBy,
			expires_at: invite.expiresAt,
			created_at: invite.createdAt,
		},
	};
}

export function inviteResponse(invite: ProjectInvite) {
	return { data: inviteData(invite) };
}
