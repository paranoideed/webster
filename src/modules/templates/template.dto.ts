import { Type } from "class-transformer";
import {
	Equals,
	IsDefined,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Length,
	Max,
	Min,
	ValidateNested,
} from "class-validator";

export class GetTemplatesQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	"page[limit]"?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	"page[offset]"?: number;

	@IsOptional()
	@IsIn(["newest", "oldest"])
	sort?: "newest" | "oldest";
}

class CreateTemplateAttributesDto {
	@IsString()
	@Length(1, 255)
	name: string;

	@IsObject()
	body: object;
}

class CreateTemplateDataDto {
	@IsString()
	@Equals("template")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => CreateTemplateAttributesDto)
	attributes: CreateTemplateAttributesDto;
}

export class CreateTemplateDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateTemplateDataDto)
	data: CreateTemplateDataDto;
}

// ── Update template ───────────────────────────────────────────────────────────

class UpdateTemplateAttributesDto {
	@IsString()
	@Length(1, 255)
	name: string;
}

class UpdateTemplateDataDto {
	@IsString()
	@Equals("template")
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateTemplateAttributesDto)
	attributes: UpdateTemplateAttributesDto;
}

export class UpdateTemplateDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateTemplateDataDto)
	data: UpdateTemplateDataDto;
}
