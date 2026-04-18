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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CanvaService } from './canva.service';
import { CreateCanvaDto, GetCanvasQueryDto, UpdateCanvaDto } from './canva.dto';
import { canvaResponse, canvasResponse } from './canva.response';
import { JwtGuard } from '../shared/jwt.guard';
import { CurrentUser } from '../shared/decorators';
import { AppLogger } from '../shared/logger';

@UseGuards(JwtGuard)
@Controller('canvases')
export class CanvaController {
	private readonly log = new AppLogger(CanvaController.name);

	constructor(private canvaService: CanvaService) {}

	@Get()
	async getCanvases(
		@CurrentUser() user: Express.User,
		@Query() query: GetCanvasQueryDto,
		@Req() req: Request,
		@Res() res: Response,
	) {
		const { project_id: projectId } = query;
		const limit = query['page[limit]'] ?? 20;
		const offset = query['page[offset]'] ?? 0;
		const sort = query.sort ?? 'newest';
		const { canvases, total } = await this.canvaService.getCanvases(
			user.id, projectId, limit, offset, sort,
		);
		const baseUrl = `${req.protocol}://${req.get('host')}/webster/v1/canvases`;
		this.log.debug('GET', `/canvases?projectId=${projectId}`, 200);
		return res.json(canvasResponse(canvases, total, limit, offset, sort, baseUrl));
	}

	@Get(':id')
	async getCanva(
		@CurrentUser() user: Express.User,
		@Param('id', ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		const canva = await this.canvaService.getCanva(user.id, id);
		this.log.debug('GET', `/canvases/${id}`, 200);
		return res.json(canvaResponse(canva));
	}

	@Post()
	async createCanva(
		@CurrentUser() user: Express.User,
		@Body() dto: CreateCanvaDto,
		@Res() res: Response,
	) {
		const { project_id: projectId, name } = dto.data.attributes;
		const canva = await this.canvaService.createCanva(user.id, projectId, name);
		this.log.info('POST', `/canvases`, 201);
		return res.status(HttpStatus.CREATED).json(canvaResponse(canva));
	}

	@Patch(':id')
	async updateCanva(
		@CurrentUser() user: Express.User,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateCanvaDto,
		@Res() res: Response,
	) {
		const canva = await this.canvaService.updateCanva(user.id, id, dto.data.attributes.name);
		this.log.info('PATCH', `/canvases/${id}`, 200);
		return res.json(canvaResponse(canva));
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteCanva(
		@CurrentUser() user: Express.User,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.canvaService.deleteCanva(user.id, id);
		this.log.info('DELETE', `/canvases/${id}`, 204);
	}
}
