import { Template } from "src/db/entity/template.entity";
import { stripNulls } from "../shared/s3.uploader";

export function templateData(template: Template) {
	return {
		id: template.id,
		type: "template",
		attributes: {
			account_id: template.accountId,
			name: template.name,
			body: template.body,
			public: template.public,
			created_at: template.createdAt,
		},
	};
}

export function templateResponse(template: Template) {
	return { data: templateData(template) };
}

export function templatesResponse(
	templates: Template[],
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
		data: templates.map(templateData),
		links: stripNulls({
			self: link(offset),
			first: link(0),
			last: link(lastPage * limit),
			prev: currentPage > 0 ? link((currentPage - 1) * limit) : null,
			next: currentPage < lastPage ? link((currentPage + 1) * limit) : null,
		}),
	};
}
