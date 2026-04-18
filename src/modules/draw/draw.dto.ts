import {
	IsArray,
	IsIn,
	IsDefined,
	IsInt,
	IsObject,
	IsString,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Op } from '@paranoideed/drawebster';

const ALLOWED_CLASS_NAMES = [
	'Rect', 'Circle', 'Text', 'Line', 'Image',
	'Arrow', 'Star', 'Path', 'Group', 'RegularPolygon',
] as const;

export class KonvaNodeDto {
	@IsIn(ALLOWED_CLASS_NAMES)
	className: string;

	@IsObject()
	attrs: Record<string, unknown>;
}

export class KonvaLayerDto {
	@IsString()
	className: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => KonvaNodeDto)
	children: KonvaNodeDto[];

	@IsObject()
	attrs: Record<string, unknown>;
}

export class AddOperationDto {
	@IsIn([Op.ADD]) op: typeof Op.ADD;
	@IsString() parentId: string;
	@ValidateNested() @Type(() => KonvaNodeDto) node: KonvaNodeDto;
}

export class UpdateOperationDto {
	@IsIn([Op.UPDATE]) op: typeof Op.UPDATE;
	@IsString() id: string;
	@IsObject() props: Record<string, unknown>;
}

export class DeleteOperationDto {
	@IsIn([Op.DELETE]) op: typeof Op.DELETE;
	@IsString() id: string;
}

export class ReorderOperationDto {
	@IsIn([Op.REORDER]) op: typeof Op.REORDER;
	@IsString() id: string;
	@IsInt() @Min(0) newIndex: number;
}

export class MoveToLayerOperationDto {
	@IsIn([Op.MOVE_TO_LAYER]) op: typeof Op.MOVE_TO_LAYER;
	@IsString() id: string;
	@IsString() layerId: string;
}

export class AddLayerOperationDto {
	@IsIn([Op.ADD_LAYER]) op: typeof Op.ADD_LAYER;
	@ValidateNested() @Type(() => KonvaLayerDto) layer: KonvaLayerDto;
}

export class UpdateLayerOperationDto {
	@IsIn([Op.UPDATE_LAYER]) op: typeof Op.UPDATE_LAYER;
	@IsString() id: string;
	@IsObject() props: Record<string, unknown>;
}

export class DeleteLayerOperationDto {
	@IsIn([Op.DELETE_LAYER]) op: typeof Op.DELETE_LAYER;
	@IsString() id: string;
}

export class ReorderLayerOperationDto {
	@IsIn([Op.REORDER_LAYER]) op: typeof Op.REORDER_LAYER;
	@IsString() id: string;
	@IsInt() @Min(0) newIndex: number;
}

export class UpdateStageOperationDto {
	@IsIn([Op.UPDATE_STAGE]) op: typeof Op.UPDATE_STAGE;
	@IsObject() props: Record<string, unknown>;
}

type OperationDto =
	| AddOperationDto | UpdateOperationDto | DeleteOperationDto
	| ReorderOperationDto | MoveToLayerOperationDto | AddLayerOperationDto
	| UpdateLayerOperationDto | DeleteLayerOperationDto
	| ReorderLayerOperationDto | UpdateStageOperationDto;

export class JoinWsDto {
	@IsUUID()
	canva_id: string;
}

export class UndoRedoWsDto {
	@IsInt()
	@Min(0)
	head: number;
}

export class CommitWsDto {
	@IsInt()
	@Min(0)
	previous: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Object, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: 'op',
			subTypes: [
				{ value: AddOperationDto,          name: Op.ADD },
				{ value: UpdateOperationDto,       name: Op.UPDATE },
				{ value: DeleteOperationDto,       name: Op.DELETE },
				{ value: ReorderOperationDto,      name: Op.REORDER },
				{ value: MoveToLayerOperationDto,  name: Op.MOVE_TO_LAYER },
				{ value: AddLayerOperationDto,     name: Op.ADD_LAYER },
				{ value: UpdateLayerOperationDto,  name: Op.UPDATE_LAYER },
				{ value: DeleteLayerOperationDto,  name: Op.DELETE_LAYER },
				{ value: ReorderLayerOperationDto, name: Op.REORDER_LAYER },
				{ value: UpdateStageOperationDto,  name: Op.UPDATE_STAGE },
			],
		},
	})
	changes: OperationDto[];
}
