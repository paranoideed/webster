import { Canva } from 'src/db/entity/canva.entity';

export function canvaData(canva: Canva) {
	return {
		id: canva.id,
		type: 'canva',
		attributes: {
			project_id: canva.projectId,
			name: canva.name,
			created_at: canva.createdAt,
		},
	};
}

export function canvaResponse(canva: Canva) {
	return { data: canvaData(canva) };
}

export function canvasResponse(
	canvases: Canva[],
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
		data: canvases.map(canvaData),
		links: {
			self: link(offset),
			first: link(0),
			last: link(lastPage * limit),
			...(currentPage > 0 ? { prev: link((currentPage - 1) * limit) } : {}),
			...(currentPage < lastPage ? { next: link((currentPage + 1) * limit) } : {}),
		},
	};
}
