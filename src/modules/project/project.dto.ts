import { Type } from "class-transformer";
import {
	Equals,
	IsEmail,
	IsEnum,
	IsDefined,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	ValidateNested,
} from "class-validator";

import { ProjectMemberRole } from "src/db/entity/project-member.entity";

// ── Get projects (pagination + sort) ─────────────────────────────────────────

export class GetProjectsQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	"page[limit]"?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	"page[offset]"?: number;

	@IsOptional()
	@IsIn(["newest", "oldest"])
	sort?: "newest" | "oldest";
}

// ── Create project ────────────────────────────────────────────────────────────

class CreateProjectAttributesDto {
	@IsString()
	@Length(1, 255)
	name: string;
}

class CreateProjectDataDto {
	@IsString()
	@Equals("project")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => CreateProjectAttributesDto)
	attributes: CreateProjectAttributesDto;
}

export class CreateProjectDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateProjectDataDto)
	data: CreateProjectDataDto;
}

// ── Update project ────────────────────────────────────────────────────────────

class UpdateProjectAttributesDto {
	@IsString()
	@Length(1, 255)
	name: string;
}

class UpdateProjectDataDto {
	@IsUUID()
	id: string;

	@IsString()
	@Equals("project")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateProjectAttributesDto)
	attributes: UpdateProjectAttributesDto;
}

export class UpdateProjectDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateProjectDataDto)
	data: UpdateProjectDataDto;
}

// ── Send invite ───────────────────────────────────────────────────────────────

class SendInviteAttributesDto {
	@IsEmail()
	email: string;
}

class SendInviteDataDto {
	@IsString()
	@Equals("project_invite")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => SendInviteAttributesDto)
	attributes: SendInviteAttributesDto;
}

export class SendInviteDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => SendInviteDataDto)
	data: SendInviteDataDto;
}

// ── Update member role ────────────────────────────────────────────────────────

class UpdateMemberAttributesDto {
	@IsEnum(ProjectMemberRole)
	role: ProjectMemberRole;
}

class UpdateMemberDataDto {
	@IsUUID()
	id: string;

	@IsString()
	@Equals("project_member")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateMemberAttributesDto)
	attributes: UpdateMemberAttributesDto;
}

export class UpdateMemberDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateMemberDataDto)
	data: UpdateMemberDataDto;
}
