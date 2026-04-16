import { KonvaLayerConfig, KonvaNodeConfig } from './build-snapshot';

export const Op = {
	ADD: 'add',
	UPDATE: 'update',
	DELETE: 'delete',
	REORDER: 'reorder',
	MOVE_TO_LAYER: 'move_to_layer',
	ADD_LAYER: 'add_layer',
	UPDATE_LAYER: 'update_layer',
	DELETE_LAYER: 'delete_layer',
	REORDER_LAYER: 'reorder_layer',
	UPDATE_STAGE: 'update_stage',
} as const;

export type Operation =
	| { op: typeof Op.ADD; parentId: string; node: KonvaNodeConfig }
	| { op: typeof Op.UPDATE; id: string; props: Record<string, unknown> }
	| { op: typeof Op.DELETE; id: string }
	| { op: typeof Op.REORDER; id: string; newIndex: number }
	| { op: typeof Op.MOVE_TO_LAYER; id: string; layerId: string }
	| { op: typeof Op.ADD_LAYER; layer: KonvaLayerConfig }
	| { op: typeof Op.UPDATE_LAYER; id: string; props: Record<string, unknown> }
	| { op: typeof Op.DELETE_LAYER; id: string }
	| { op: typeof Op.REORDER_LAYER; id: string; newIndex: number }
	| { op: typeof Op.UPDATE_STAGE; props: Record<string, unknown> };
