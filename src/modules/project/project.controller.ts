import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ProjectService } from "./project.service";
import { CreateProjectDto, UpdateProjectDto, SendInviteDto, GetProjectsQueryDto } from "./project.dto";
import {
	projectResponse,
	projectsResponse,
	memberResponse,
	membersResponse,
	inviteResponse,
} from "./project.response";
import { JwtGuard } from "../shared/jwt.guard";
import { CurrentUser } from "../shared/decorators";
import { AppLogger } from "../shared/logger";

@UseGuards(JwtGuard)
@Controller("projects")
export class ProjectController {
	private readonly log = new AppLogger(ProjectController.name);

	constructor(private projectService: ProjectService) {}

	// ── Invites (registered before /:id to avoid routing conflicts) ───────────

	@Post("invites/:token/accept")
	async acceptInvite(
		@CurrentUser() user: Express.User,
		@Param("token") token: string,
		@Res() res: Response,
	) {
		const member = await this.projectService.acceptInvite(user.id, token);
		this.log.info("POST", `/projects/invites/${token}/accept`, 201);
		return res.status(HttpStatus.CREATED).json(memberResponse(member));
	}

	// ── Projects ──────────────────────────────────────────────────────────────

	@Post()
	async createProject(
		@CurrentUser() user: Express.User,
		@Body() dto: CreateProjectDto,
		@Res() res: Response,
	) {
		const project = await this.projectService.createProject(user.id, dto.data.attributes.name);
		this.log.info("POST", "/projects", 201);
		return res.status(HttpStatus.CREATED).json(projectResponse(project));
	}

	@Get()
	async getMyProjects(
		@CurrentUser() user: Express.User,
		@Query() query: GetProjectsQueryDto,
		@Req() req: Request,
		@Res() res: Response,
	) {
		const limit = query["page[limit]"] ?? 20;
		const offset = query["page[offset]"] ?? 0;
		const sort = query.sort ?? "newest";
		const { projects, total } = await this.projectService.getMyProjects(user.id, limit, offset, sort);
		const baseUrl = `${req.protocol}://${req.get("host")}/webster/v1/projects`;
		this.log.debug("GET", "/projects", 200);
		return res.json(projectsResponse(projects, total, limit, offset, sort, baseUrl));
	}

	@Get(":id")
	async getProject(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		const project = await this.projectService.getProject(user.id, id);
		this.log.debug("GET", `/projects/${id}`, 200);
		return res.json(projectResponse(project));
	}

	@Patch(":id")
	async updateProject(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateProjectDto,
		@Res() res: Response,
	) {
		const project = await this.projectService.updateProject(user.id, id, dto.data.attributes.name);
		this.log.info("PATCH", `/projects/${id}`, 200);
		return res.json(projectResponse(project));
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteProject(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		await this.projectService.deleteProject(user.id, id);
		this.log.info("DELETE", `/projects/${id}`, 204);
	}

	// ── Members ───────────────────────────────────────────────────────────────

	@Get(":id/members")
	async getMembers(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		const members = await this.projectService.getMembers(user.id, id);
		this.log.debug("GET", `/projects/${id}/members`, 200);
		return res.json(membersResponse(members));
	}

	// ── Project invites ───────────────────────────────────────────────────────

	@Post(":id/invites")
	async sendInvite(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: SendInviteDto,
		@Res() res: Response,
	) {
		const invite = await this.projectService.sendInvite(user.id, id, dto.data.attributes.email);
		this.log.info("POST", `/projects/${id}/invites`, 201);
		return res.status(HttpStatus.CREATED).json(inviteResponse(invite));
	}
}
