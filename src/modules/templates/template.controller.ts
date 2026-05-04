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
import { TemplateService } from "./template.service";
import { CreateTemplateDto, GetTemplatesQueryDto, UpdateTemplateDto } from "./template.dto";
import { templateResponse, templatesResponse } from "./template.response";
import { JwtGuard } from "../shared/jwt.guard";
import { CurrentUser } from "../shared/decorators";
import { AppLogger } from "../shared/logger";

@UseGuards(JwtGuard)
@Controller("templates")
export class TemplateController {
	private readonly log = new AppLogger(TemplateController.name);

	constructor(private templateService: TemplateService) {}

	@Get()
	async getTemplates(
		@CurrentUser() user: Express.User,
		@Query() query: GetTemplatesQueryDto,
		@Req() req: Request,
		@Res() res: Response,
	) {
		const limit = query["page[limit]"] ?? 20;
		const offset = query["page[offset]"] ?? 0;
		const sort = query.sort ?? "newest";
		const { templates, total } = await this.templateService.getTemplates(
			user.id, limit, offset, sort,
		);
		const baseUrl = `${req.protocol}://${req.get("host")}/webster/v1/templates`;
		this.log.debug("GET", "/templates", 200);
		return res.json(templatesResponse(templates, total, limit, offset, sort, baseUrl));
	}

	@Get(":id")
	async getTemplate(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		const template = await this.templateService.getTemplate(user.id, id);
		this.log.debug("GET", `/templates/${id}`, 200);
		return res.json(templateResponse(template));
	}

	@Patch(":id")
	async updateTemplate(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateTemplateDto,
		@Res() res: Response,
	) {
		const template = await this.templateService.updateTemplate(user.id, id, dto.data.attributes.name);
		this.log.info("PATCH", `/templates/${id}`, 200);
		return res.json(templateResponse(template));
	}

	@Post()
	async createTemplate(
		@CurrentUser() user: Express.User,
		@Body() dto: CreateTemplateDto,
		@Res() res: Response,
	) {
		const { name, body } = dto.data.attributes;
		const template = await this.templateService.createTemplate(user.id, name, body);
		this.log.info("POST", "/templates", 201);
		return res.status(HttpStatus.CREATED).json(templateResponse(template));
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteTemplate(
		@CurrentUser() user: Express.User,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		await this.templateService.deleteTemplate(user.id, id);
		this.log.info("DELETE", `/templates/${id}`, 204);
	}
}
