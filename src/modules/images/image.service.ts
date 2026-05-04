import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { database } from 'src/db/data-source';
import { Image } from 'src/db/entity/image.entity';
import { S3Service } from '../shared/s3.uploader';

const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/svg+xml',
]);

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImageService {
	constructor(private readonly s3: S3Service) {}

	async getImages(
		accountId: string,
		limit: number,
		offset: number,
		sort: 'newest' | 'oldest',
	): Promise<{ images: Image[]; total: number }> {
		const order = sort === 'oldest' ? 'ASC' : 'DESC';
		const [images, total] = await database.dataSource.manager
			.createQueryBuilder(Image, 'image')
			.where('image.public = true OR image.account_id = :accountId', { accountId })
			.orderBy('image.createdAt', order)
			.skip(offset)
			.take(limit)
			.getManyAndCount();
		return { images, total };
	}

	async getImage(accountId: string, imageId: string): Promise<Image> {
		const image = await Image.findOneBy({ id: imageId });
		if (!image) throw new NotFoundException('Image not found');
		if (!image.public && image.accountId !== accountId) {
			throw new ForbiddenException('Access denied');
		}
		return image;
	}

	async uploadImage(
		accountId: string,
		file: Express.Multer.File,
		name?: string,
	): Promise<Image> {
		if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
			throw new BadRequestException(
				`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, SVG`,
			);
		}
		if (file.size > MAX_SIZE_BYTES) {
			throw new BadRequestException('File size exceeds 10 MB limit');
		}

		const ext = MIME_TO_EXT[file.mimetype];
		const s3Key = `images/${accountId}/${randomUUID()}.${ext}`;
		await this.s3.putObject(file.buffer, file.mimetype, s3Key);

		const imageName = name?.trim() || file.originalname;
		const image = Image.create({
			accountId,
			name: imageName,
			s3Key,
			mimeType: file.mimetype,
			public: false,
		});
		await image.save();
		return image;
	}

	async deleteImage(accountId: string, imageId: string): Promise<void> {
		const image = await Image.findOneBy({ id: imageId });
		if (!image) throw new NotFoundException('Image not found');
		if (image.public || image.accountId !== accountId) {
			throw new ForbiddenException('You do not own this image');
		}
		await image.softRemove();
		void this.s3.deleteObject(image.s3Key);
	}
}
