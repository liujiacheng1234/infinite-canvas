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

/** CSV 单元格：空值输出 -，含逗号/引号/换行时用引号包裹并转义。 */
function csvField(value: unknown) {
    const text = value === undefined || value === null || value === "" ? "-" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

const NODE_COLUMNS = "{i,id,type,title,x,y,w,h,mode,status,imgs,error}";

/** 把节点列表渲染成表头行格式的行表，比 JSON 节省约一半 token。 */
export function renderNodeRows(nodes: CanvasNode[]) {
    const lines = [`nodes[${nodes.length}]${NODE_COLUMNS}:`];
    nodes.forEach((node, index) => {
        const metadata = (node.metadata || {}) as Record<string, unknown>;
        const status = typeof metadata.status === "string" && !["idle", "success"].includes(metadata.status) ? metadata.status : "-";
        const images = Array.isArray(metadata.images) ? (metadata.images as Array<Record<string, unknown>>) : [];
        const primaryId = typeof metadata.primaryImageId === "string" ? metadata.primaryImageId : "";
        const primary = images.find((image) => image.id === primaryId) || images[0];
        const imgs = images.length ? `${images.length}:${primary?.naturalWidth}x${primary?.naturalHeight}` : "-";
        lines.push([index, node.id, node.type, node.title, node.position?.x, node.position?.y, node.width, node.height, metadata.generationMode, status, imgs, metadata.errorDetails].map(csvField).join(","));
    });
    return lines;
}

/** 画布结构概览渲染成表头行文本：canvas/viewport/selected 头部 + 节点行表 + 连线下标对。 */
export function renderCanvasOverview(state: CanvasSnapshot) {
    const nodes = state.nodes || [];
    const lines = [
        `canvas ${state.projectId || "-"} ${csvField(state.title)}`,
        `viewport ${state.viewport ? `${state.viewport.x},${state.viewport.y},${state.viewport.k}` : "-"}`,
        `selected ${state.selectedNodeIds?.length ? state.selectedNodeIds.join(",") : "-"}`,
    ];
    lines.push(...renderNodeRows(nodes));
    const connections = state.connections || [];
    const indexOf = new Map(nodes.map((node, index) => [node.id, index]));
    lines.push(`connections[${connections.length}]{from,to}:`);
    connections.forEach((connection) => {
        const from = indexOf.get(connection.fromNodeId);
        const to = indexOf.get(connection.toNodeId);
        if (from !== undefined && to !== undefined) lines.push(`${from},${to}`);
    });
    return lines.join("\n");
}

/** 清理返回给 Agent 的节点 metadata：剔除存储字段，prompt 与 composerContent 重复时去重。 */
export function slimNodeMetadata(node: CanvasNode) {
    const metadata = { ...(node.metadata || {}) } as Record<string, unknown>;
    if (typeof metadata.prompt === "string" && metadata.prompt === metadata.composerContent) delete metadata.prompt;
    if (Array.isArray(metadata.images)) {
        metadata.images = (metadata.images as Array<Record<string, unknown>>).map((image) => {
            const { storageKey: _storageKey, bytes: _bytes, mimeType: _mimeType, ...rest } = image;
            return rest;
        });
    }
    return { ...node, metadata };
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
