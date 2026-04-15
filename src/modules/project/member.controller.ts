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
	Res,
	UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ProjectService } from "./project.service";
import { UpdateMemberDto } from "./project.dto";
import { memberResponse } from "./project.response";
import { JwtGuard } from "../shared/jwt.guard";
import { CurrentUser } from "../shared/decorators";
import { AppLogger } from "../shared/logger";

@UseGuards(JwtGuard)
@Controller("members")
export class MemberController {
	private readonly log = new AppLogger(MemberController.name);

	constructor(private projectService: ProjectService) {}

	@Get(":member_id")
	async getMember(
		@CurrentUser() user: Express.User,
		@Param("member_id", ParseUUIDPipe) member_id: string,
		@Res() res: Response,
	) {
		const member = await this.projectService.getMember(user.id, member_id);
		this.log.debug("GET", `/members/${member_id}`, 200);
		return res.json(memberResponse(member));
	}

	@Patch(":member_id")
	async updateMember(
		@CurrentUser() user: Express.User,
		@Param("member_id", ParseUUIDPipe) member_id: string,
		@Body() dto: UpdateMemberDto,
		@Res() res: Response,
	) {
		const member = await this.projectService.updateMember(
			user.id,
			member_id,
			dto.data.attributes.role,
		);
		this.log.info("PATCH", `/members/${member_id}`, 200);
		return res.json(memberResponse(member));
	}

	@Delete(":member_id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeMember(
		@CurrentUser() user: Express.User,
		@Param("member_id", ParseUUIDPipe) member_id: string,
	) {
		await this.projectService.removeMember(user.id, member_id);
		this.log.info("DELETE", `/members/${member_id}`, 204);
	}
}
