import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ImageService } from './image.service';
import { GetImagesQueryDto, UploadImageQueryDto } from './image.dto';
import { imageResponse, imagesResponse } from './image.response';
import { JwtGuard } from '../shared/jwt.guard';
import { CurrentUser } from '../shared/decorators';
import { AppLogger } from '../shared/logger';

@UseGuards(JwtGuard)
@Controller('images')
export class ImageController {
	private readonly log = new AppLogger(ImageController.name);

	constructor(private readonly imageService: ImageService) {}

	@Get()
	async getImages(
		@CurrentUser() user: Express.User,
		@Query() query: GetImagesQueryDto,
		@Req() req: Request,
		@Res() res: Response,
	) {
		const limit = query['page[limit]'] ?? 20;
		const offset = query['page[offset]'] ?? 0;
		const sort = query.sort ?? 'newest';
		const { images, total } = await this.imageService.getImages(user.id, limit, offset, sort);
		const baseUrl = `${req.protocol}://${req.get('host')}/webster/v1/images`;
		this.log.debug('GET', '/images', 200);
		return res.json(imagesResponse(images, total, limit, offset, sort, baseUrl));
	}

	@Get(':id')
	async getImage(
		@CurrentUser() user: Express.User,
		@Param('id', ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		const image = await this.imageService.getImage(user.id, id);
		this.log.debug('GET', `/images/${id}`, 200);
		return res.json(imageResponse(image));
	}

	@Post()
	@UseInterceptors(FileInterceptor('file'))
	async uploadImage(
		@CurrentUser() user: Express.User,
		@Query() query: UploadImageQueryDto,
		@UploadedFile() file: Express.Multer.File,
		@Res() res: Response,
	) {
		const image = await this.imageService.uploadImage(user.id, file, query.name);
		this.log.info('POST', '/images', 201);
		return res.status(HttpStatus.CREATED).json(imageResponse(image));
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteImage(
		@CurrentUser() user: Express.User,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.imageService.deleteImage(user.id, id);
		this.log.info('DELETE', `/images/${id}`, 204);
	}
}
