import { Injectable, Logger } from '@nestjs/common';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export function stripNulls<T extends object>(obj: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
	) as Partial<T>;
}

export function buildFileUrl(key: string | null): string | null {
	if (!key) return null;
	const base = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
	return `${base}/${key}`;
}

@Injectable()
export class S3Service {
	private readonly logger = new Logger(S3Service.name);
	private _s3: S3Client | null = null;
	private readonly bucket: string;
	private readonly publicBase: string;

	constructor() {
		this.bucket = process.env.BUCKET_NAME ?? '';
		const region = process.env.AWS_REGION ?? '';
		this.publicBase =
			process.env.PUBLIC_BASE_URL ??
			`https://${this.bucket}.s3.${region}.amazonaws.com`;
	}

	private get s3(): S3Client {
		if (!this._s3) {
			this._s3 = new S3Client({
				region: process.env.AWS_REGION!,
				credentials: {
					accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
					secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
				},
			});
		}
		return this._s3;
	}

	async putProfileAvatar(
		userId: string,
		data: Buffer,
		contentType: string,
	): Promise<{ key: string; url: string }> {
		const key = `user/${userId}/avatar_${Date.now()}`;

		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: data,
				ContentType: contentType,
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		);

		return { key, url: `${this.publicBase}/${key}` };
	}

	async putObject(
		data: Buffer,
		contentType: string,
		destination: string,
	): Promise<{ url: string }> {
		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: destination,
				Body: data,
				ContentType: contentType,
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		);
		return { url: `${this.publicBase}/${destination}` };
	}

	async deleteObject(key: string): Promise<void> {
		try {
			await this.s3.send(
				new DeleteObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
		} catch (err) {
			this.logger.error(`Failed to delete key: ${key}`, err);
		}
	}

	getKeyFromUrl(url: string): string | null {
		if (!url || !url.startsWith(this.publicBase)) return null;
		return url.substring(this.publicBase.length + 1);
	}
}
