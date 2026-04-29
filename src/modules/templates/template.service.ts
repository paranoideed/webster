import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { database } from "src/db/data-source";
import { Template } from "src/db/entity/template.entity";

@Injectable()
export class TemplateService {
	async getTemplates(
		accountId: string,
		limit: number,
		offset: number,
		sort: "newest" | "oldest",
	): Promise<{ templates: Template[]; total: number }> {
		const order = sort === "oldest" ? "ASC" : "DESC";
		const [templates, total] = await database.dataSource.manager
			.createQueryBuilder(Template, "template")
			.where("template.public = true OR template.account_id = :accountId", { accountId })
			.orderBy("template.createdAt", order)
			.skip(offset)
			.take(limit)
			.getManyAndCount();
		return { templates, total };
	}

	async getTemplate(accountId: string, templateId: string): Promise<Template> {
		const template = await Template.findOneBy({ id: templateId });
		if (!template) throw new NotFoundException("Template not found");
		if (!template.public && template.accountId !== accountId) {
			throw new ForbiddenException("Access denied");
		}
		return template;
	}

	async createTemplate(accountId: string, name: string, body: object): Promise<Template> {
		const template = Template.create({ accountId, name, body, public: false });
		await template.save();
		return template;
	}

	async updateTemplate(accountId: string, templateId: string, name: string): Promise<Template> {
		const template = await this.findOwned(accountId, templateId);
		template.name = name;
		await template.save();
		return template;
	}

	async deleteTemplate(accountId: string, templateId: string): Promise<void> {
		const template = await this.findOwned(accountId, templateId);
		await template.softRemove();
	}

	private async findOwned(accountId: string, templateId: string): Promise<Template> {
		const template = await Template.findOneBy({ id: templateId });
		if (!template) throw new NotFoundException("Template not found");
		if (template.public || template.accountId !== accountId) {
			throw new ForbiddenException("You do not own this template");
		}
		return template;
	}
}
