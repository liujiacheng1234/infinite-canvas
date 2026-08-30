import { toolInputSchemas, toolNames, type ToolName } from "./schemas.js";
import type { CanvasConnection, CanvasNode, CanvasSnapshot } from "./types.js";

/** 判断传入名称是否为已注册的画布工具。 */
export function isToolName(name: unknown): name is ToolName {
    return typeof name === "string" && toolNames.includes(name as ToolName);
}

/** 按工具名称校验并解析调用参数。 */
export function parseToolInput(name: ToolName, input: unknown) {
    return toolInputSchemas[name].parse(input ?? {});
}

/** 压缩画布快照，避免向 Agent 返回过长的节点内容。 */
export function compactCanvasState(state: CanvasSnapshot | null) {
    if (!state) throw new Error("当前没有已连接画布");
    return { ...state, nodes: (state.nodes || []).map(compactNode) };
}

/** 把画布节点压缩成结构概览，内容全文和生成参数留给 canvas_get_nodes 按需读取。 */
export function compactNode(node: CanvasNode) {
    const metadata = (node.metadata || {}) as Record<string, unknown>;
    const summary: Record<string, unknown> = { id: node.id, type: node.type, title: node.title, position: node.position, width: node.width, height: node.height };
    if (metadata.status !== undefined) summary.status = metadata.status;
    if (metadata.errorDetails) summary.errorDetails = metadata.errorDetails;
    if (metadata.generationMode) summary.generationMode = metadata.generationMode;
    const images = Array.isArray(metadata.images) ? (metadata.images as Array<Record<string, unknown>>) : [];
    if (images.length) {
        const primaryId = typeof metadata.primaryImageId === "string" ? metadata.primaryImageId : "";
        const primary = images.find((image) => image.id === primaryId) || images[0];
        summary.images = { count: images.length, primary: { id: primary.id, status: primary.status, naturalWidth: primary.naturalWidth, naturalHeight: primary.naturalHeight } };
    }
    return summary;
}

/** 计算节点的上下游邻居摘要，供删除或改连线前评估影响。 */
export function nodeRelations(nodes: CanvasNode[], connections: CanvasConnection[], nodeId: string) {
    const summaries = new Map(nodes.map((node) => [node.id, { id: node.id, type: node.type, title: node.title }]));
    const upstream: Array<{ id: string; type: string; title?: string }> = [];
    const downstream: Array<{ id: string; type: string; title?: string }> = [];
    connections.forEach((connection) => {
        if (connection.toNodeId === nodeId) {
            const summary = summaries.get(connection.fromNodeId);
            if (summary) upstream.push(summary);
        }
        if (connection.fromNodeId === nodeId) {
            const summary = summaries.get(connection.toNodeId);
            if (summary) downstream.push(summary);
        }
    });
    return { upstream, downstream };
}

/** 计算新节点在当前画布右侧的默认横坐标。 */
export function nextCanvasX(state: CanvasSnapshot | null) {
    const nodes = state?.nodes || [];
    return nodes.length ? Math.max(...nodes.map((node) => node.position.x + node.width)) + 80 : 0;
}
