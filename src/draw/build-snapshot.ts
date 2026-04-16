import { Op, Operation } from 'src/draw/operation';
import { Commit } from 'src/draw/commit';

export interface KonvaNodeConfig {
  className: string;
  attrs: Record<string, unknown>;
  children?: KonvaNodeConfig[];
}

export interface KonvaStageConfig extends KonvaNodeConfig {
  className: 'Stage';
  children: KonvaLayerConfig[];
}

export interface KonvaLayerConfig extends KonvaNodeConfig {
  className: 'Layer';
  children: KonvaNodeConfig[];
}

function findNode(nodes: KonvaNodeConfig[], id: string): KonvaNodeConfig | null {
  for (const node of nodes) {
    if (node.attrs.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes: KonvaNodeConfig[], id: string): KonvaNodeConfig | null {
  for (const node of nodes) {
    const idx = node.children?.findIndex((n) => n.attrs.id === id) ?? -1;
    if (idx !== -1) return node.children!.splice(idx, 1)[0];
    if (node.children) {
      const removed = removeNode(node.children, id);
      if (removed) return removed;
    }
  }
  return null;
}

type Handler<T extends Operation> = (stage: KonvaStageConfig, change: T) => void;
type Handlers = { [K in Operation['op']]: Handler<Extract<Operation, { op: K }>> };

const handlers: Handlers = {
  [Op.ADD]: (stage, change) => {
    const parent =
      stage.children.find((l) => l.attrs.id === change.parentId) ??
      findNode(stage.children, change.parentId);
    if (!parent) { console.warn(`Parent "${change.parentId}" not found`); return; }
    parent.children = parent.children ?? [];
    parent.children.push(change.node);
  },

  [Op.UPDATE]: (stage, change) => {
    const node = findNode(stage.children, change.id);
    if (!node) { console.warn(`Node "${change.id}" not found`); return; }
    Object.assign(node.attrs, change.props);
  },

  [Op.DELETE]: (stage, change) => {
    removeNode(stage.children, change.id);
  },

  [Op.REORDER]: (stage, change) => {
    for (const layer of stage.children) {
      const idx = layer.children?.findIndex((n) => n.attrs.id === change.id) ?? -1;
      if (idx !== -1) {
        const [node] = layer.children!.splice(idx, 1);
        layer.children!.splice(change.newIndex, 0, node);
        break;
      }
    }
  },

  [Op.MOVE_TO_LAYER]: (stage, change) => {
    const node = removeNode(stage.children, change.id);
    if (!node) { console.warn(`Node "${change.id}" not found`); return; }
    const target = stage.children.find((l) => l.attrs.id === change.layerId);
    if (!target) { console.warn(`Layer "${change.layerId}" not found`); return; }
    target.children = target.children ?? [];
    target.children.push(node);
  },

  [Op.ADD_LAYER]: (stage, change) => {
    stage.children.push(change.layer);
  },

  [Op.UPDATE_LAYER]: (stage, change) => {
    const layer = stage.children.find((l) => l.attrs.id === change.id);
    if (!layer) { console.warn(`Layer "${change.id}" not found`); return; }
    Object.assign(layer.attrs, change.props);
  },

  [Op.DELETE_LAYER]: (stage, change) => {
    const idx = stage.children.findIndex((l) => l.attrs.id === change.id);
    if (idx !== -1) stage.children.splice(idx, 1);
  },

  [Op.REORDER_LAYER]: (stage, change) => {
    const idx = stage.children.findIndex((l) => l.attrs.id === change.id);
    if (idx !== -1) {
      const [layer] = stage.children.splice(idx, 1);
      stage.children.splice(change.newIndex, 0, layer);
    }
  },

  [Op.UPDATE_STAGE]: (stage, change) => {
    Object.assign(stage.attrs, change.props);
  },
};

export function buildSnapshot(snapshot: KonvaStageConfig, commits: Commit[]): KonvaStageConfig {
  const stage: KonvaStageConfig = JSON.parse(JSON.stringify(snapshot));

  for (const commit of commits) {
    for (const change of commit.changes) {
      (handlers[change.op] as Handler<Operation>)(stage, change);
    }
  }

  return stage;
}
