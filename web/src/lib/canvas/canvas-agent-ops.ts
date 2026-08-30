import { nanoid } from "nanoid";

import i18n from "@/i18n";
import { getNodeSpec, isRegisteredNodeType } from "@/lib/canvas/node-registry";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type CanvasNodeTypeId, type ViewportTransform } from "@/types/canvas";

export type CanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: CanvasNodeTypeId; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeMetadata }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeMetadata }
    | { type: "delete_node"; id?: string; ids?: string[]; nodeType?: CanvasNodeTypeId }
    | { type: "delete_connections"; id?: string; ids?: string[]; fromNodeId?: string; toNodeId?: string; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string };

export type CanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
};

/** 单个 op 的执行回执，供 Agent 确认每一步是否生效。 */
export type CanvasAgentOpResult = { op: string; ok: boolean; nodeId?: string; error?: string; note?: string };
export type CanvasAgentCreatedNode = { id: string; type: CanvasNodeTypeId; title: string };
export type CanvasAgentRemovedConnection = { id: string; fromNodeId: string; toNodeId: string };
export type CanvasAgentApplyReceipt = { opResults: CanvasAgentOpResult[]; created: CanvasAgentCreatedNode[]; removedConnections: CanvasAgentRemovedConnection[] };

export function summarizeCanvasAgentOps(ops?: CanvasAgentOp[]) {
    const counts = (Array.isArray(ops) ? ops : []).reduce<Record<string, number>>((acc, op) => {
        if (!op?.type) return acc;
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${opLabel(type)} ${count}`)
        .join("，");
}

export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops?: CanvasAgentOp[]) {
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;
    const opResults: CanvasAgentOpResult[] = [];
    const created: CanvasAgentCreatedNode[] = [];
    const removedConnections: CanvasAgentRemovedConnection[] = [];

    (Array.isArray(ops) ? ops : []).forEach((op, index) => {
        if (!op?.type) return;
        if (op.type === "add_node") {
            const nodeType = op.nodeType && isRegisteredNodeType(op.nodeType) ? op.nodeType : CanvasNodeType.Text;
            if (op.id && nodes.some((node) => node.id === op.id)) {
                opResults.push({ op: op.type, ok: false, nodeId: op.id, error: `节点 id 已存在：${op.id}` });
                return;
            }
            const spec = getNodeSpec(nodeType);
            const node: CanvasNodeData = {
                id: op.id || `${nodeType}-${Date.now()}-${index}`,
                type: nodeType,
                title: op.title || spec.title,
                position: op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 },
                width: op.width || spec.width,
                height: op.height || spec.height,
                metadata: { ...spec.metadata, ...op.metadata },
            };
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
            created.push({ id: node.id, type: node.type, title: node.title });
            opResults.push({ op: op.type, ok: true, nodeId: node.id });
        }
        if (op.type === "update_node") {
            if (!op.id || !nodes.some((node) => node.id === op.id)) {
                opResults.push({ op: op.type, ok: false, nodeId: op.id, error: `节点不存在：${op.id}` });
                return;
            }
            nodes = nodes.map((node) => (node.id === op.id ? { ...node, ...op.patch, metadata: { ...node.metadata, ...op.patch?.metadata, ...op.metadata } } : node));
            opResults.push({ op: op.type, ok: true, nodeId: op.id });
        }
        if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : op.nodeType ? nodes.filter((node) => node.type === op.nodeType).map((node) => node.id) : []));
            const matched = nodes.filter((node) => ids.has(node.id));
            if (!matched.length) {
                opResults.push({ op: op.type, ok: false, error: "未找到要删除的节点" });
                return;
            }
            const missing = ids.size - matched.length;
            removedConnections.push(...connections.filter((conn) => ids.has(conn.fromNodeId) || ids.has(conn.toNodeId)));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((conn) => !ids.has(conn.fromNodeId) && !ids.has(conn.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
            opResults.push({ op: op.type, ok: true, note: missing > 0 ? `${missing} 个 id 未找到，已删除 ${matched.length} 个节点` : undefined });
        }
        if (op.type === "delete_connections") {
            const before = connections;
            if (op.all) {
                connections = [];
            } else {
                const byId = op.ids?.length || op.id;
                connections = connections.filter((conn) => {
                    if (byId) return !(op.ids || (op.id ? [op.id] : [])).includes(conn.id);
                    if (!op.fromNodeId && !op.toNodeId) return true;
                    if (op.fromNodeId && conn.fromNodeId !== op.fromNodeId) return true;
                    if (op.toNodeId && conn.toNodeId !== op.toNodeId) return true;
                    return false;
                });
            }
            const removed = before.filter((conn) => !connections.includes(conn));
            removedConnections.push(...removed);
            opResults.push({ op: op.type, ok: true, note: removed.length ? undefined : "没有匹配的连线" });
        }
        if (op.type === "connect_nodes") {
            if (!op.fromNodeId || !op.toNodeId) return;
            if (!nodes.some((node) => node.id === op.fromNodeId) || !nodes.some((node) => node.id === op.toNodeId)) {
                const missingId = nodes.some((node) => node.id === op.fromNodeId) ? op.toNodeId : op.fromNodeId;
                opResults.push({ op: op.type, ok: false, nodeId: missingId, error: `连线节点不存在：${missingId}` });
                return;
            }
            if (connections.some((conn) => conn.fromNodeId === op.fromNodeId && conn.toNodeId === op.toNodeId)) {
                opResults.push({ op: op.type, ok: true, note: "连线已存在" });
                return;
            }
            connections = [...connections, { id: op.id || nanoid(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId }];
            opResults.push({ op: op.type, ok: true, nodeId: op.fromNodeId });
        }
        if (op.type === "set_viewport" && op.viewport) {
            viewport = op.viewport;
            opResults.push({ op: op.type, ok: true });
        }
        if (op.type === "select_nodes") {
            selectedNodeIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
            opResults.push({ op: op.type, ok: true });
        }
    });

    return { snapshot: { ...snapshot, nodes, connections, selectedNodeIds, viewport }, receipt: { opResults, created, removedConnections } satisfies CanvasAgentApplyReceipt };
}

function opLabel(type: string) {
    return i18n.t(`canvas.agentOps.${type}`, { defaultValue: type });
}
