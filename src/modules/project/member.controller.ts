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

	@Get(":memberId")
	async getMember(
		@CurrentUser() user: Express.User,
		@Param("memberId", ParseUUIDPipe) memberId: string,
		@Res() res: Response,
	) {
		const member = await this.projectService.getMember(user.id, memberId);
		this.log.debug("GET", `/members/${memberId}`, 200);
		return res.json(memberResponse(member));
	}

	@Patch(":memberId")
	async updateMember(
		@CurrentUser() user: Express.User,
		@Param("memberId", ParseUUIDPipe) memberId: string,
		@Body() dto: UpdateMemberDto,
		@Res() res: Response,
	) {
		const member = await this.projectService.updateMember(
			user.id,
			memberId,
			dto.data.attributes.role,
		);
		this.log.info("PATCH", `/members/${memberId}`, 200);
		return res.json(memberResponse(member));
	}

	@Delete(":memberId")
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeMember(
		@CurrentUser() user: Express.User,
		@Param("memberId", ParseUUIDPipe) memberId: string,
	) {
		await this.projectService.removeMember(user.id, memberId);
		this.log.info("DELETE", `/members/${memberId}`, 204);
	}
}
