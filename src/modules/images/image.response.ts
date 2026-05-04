import { Image } from 'src/db/entity/image.entity';
import { buildFileUrl, stripNulls } from '../shared/s3.uploader';

export function imageData(image: Image) {
	return {
		id: image.id,
		type: 'image',
		attributes: {
			account_id: image.accountId,
			name: image.name,
			url: buildFileUrl(image.s3Key),
			mime_type: image.mimeType,
			public: image.public,
			created_at: image.createdAt,
		},
	};
}

export function imageResponse(image: Image) {
	return { data: imageData(image) };
}

export function imagesResponse(
	images: Image[],
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
		data: images.map(imageData),
		links: stripNulls({
			self: link(offset),
			first: link(0),
			last: link(lastPage * limit),
			prev: currentPage > 0 ? link((currentPage - 1) * limit) : null,
			next: currentPage < lastPage ? link((currentPage + 1) * limit) : null,
		}),
	};
}
