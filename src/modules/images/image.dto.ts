import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class GetImagesQueryDto {
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

export class UploadImageQueryDto {
	@IsOptional()
	@IsString()
	@Length(1, 255)
	name?: string;
}
