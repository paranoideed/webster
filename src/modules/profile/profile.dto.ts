import {
	IsString,
	IsUUID,
	IsOptional,
	MinLength,
	MaxLength,
	Matches,
	IsInt,
	Min,
	Max,
	ValidateNested,
	IsDefined,
	Equals,
	IsBoolean
} from "class-validator";
import { Type } from "class-transformer";
import { NullIfEmpty } from "../shared/decorators";
import { USERNAME_PATTERN } from "../shared/constants";

export class UpdateProfileAttributesDto {
	@IsOptional()
	@NullIfEmpty()
	@IsString()
	@MinLength(3)
	@MaxLength(32)
	@Matches(USERNAME_PATTERN, {
		message: "Username can only contain letters, numbers, and -._!"
	})
	username?: string;
}

export class UpdateProfileDataDto {
	@IsUUID()
	id: string;

	@IsString()
	@Equals("profile")
	type: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateProfileAttributesDto)
	attributes?: UpdateProfileAttributesDto;
}

export class UpdateProfileDto {
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateProfileDataDto)
	data: UpdateProfileDataDto;
}

export class FilterProfilesDto {
	@IsOptional()
	@IsString()
	text?: string;

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
}
