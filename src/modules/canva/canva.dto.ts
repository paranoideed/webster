import {
	IsIn,
	IsDefined,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	ValidateNested,
	Equals,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Canva CRUD ───────────────────────────────────────────────────────────────

export class GetCanvasQueryDto {
	@IsUUID()
	project_id: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	'page[limit]'?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	'page[offset]'?: number;

	@IsOptional()
	@IsIn(['newest', 'oldest'])
	sort?: 'newest' | 'oldest';
}

class CreateCanvaAttributesDto {
	@IsUUID()
	project_id: string;

	@IsString()
	@Length(1, 255)
	name: string;
}

class CreateCanvaDataDto {
	@IsString()
	@Equals('canva')
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => CreateCanvaAttributesDto)
	attributes: CreateCanvaAttributesDto;
}

export class CreateCanvaDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateCanvaDataDto)
	data: CreateCanvaDataDto;
}

class UpdateCanvaAttributesDto {
	@IsString()
	@Length(1, 255)
	name: string;
}

class UpdateCanvaDataDto {
	@IsUUID()
	id: string;

	@IsString()
	@Equals('canva')
	type: string;

	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateCanvaAttributesDto)
	attributes: UpdateCanvaAttributesDto;
}

export class UpdateCanvaDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateCanvaDataDto)
	data: UpdateCanvaDataDto;
}
