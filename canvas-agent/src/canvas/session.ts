import crypto from "node:crypto";
import type { ServerResponse } from "node:http";

import { logger } from "../utils/logger.js";
import { buildCanvasToolRequest, resolveToolNodeRefs, shortenToolNodeRefs } from "./operations.js";
import type { ToolName } from "./schemas.js";
import { ShortIdRegistry } from "./short-refs.js";
import { isToolName, nodeRelations, parseToolInput, renderCanvasOverview, renderNodeRows, slimNodeMetadata } from "./tools.js";
import type { CanvasSnapshot } from "./types.js";

type PendingRequest = { clientId: string; resolve: (value: unknown) => void; reject: (error: Error) => void };
export const AGENT_PROTOCOL_VERSION = 7;

const SITE_TOOLS = new Set<ToolName>([
    "site_navigate",
    "canvas_list_projects",
    "workbench_image_get_config",
    "workbench_image_generate",
    "workbench_video_get_config",
    "workbench_video_generate",
    "prompts_search",
    "assets_list",
    "assets_add",
    "generation_get_status",
]);

/** 管理网页画布连接、状态和工具请求，把 MCP 调用转发到当前激活网页执行。 */
export class CanvasSession {
    private clients = new Map<string, ServerResponse>();
    private clientFocusOrder = new Map<string, number>();
    private pending = new Map<string, PendingRequest>();
    private canvasStates = new Map<string, CanvasSnapshot>();
    private refRegistries = new Map<string, ShortIdRegistry>();
    private activeClientId = "";
    private focusSequence = 0;

    /** 获取当前目标网页的画布状态。 */
    private get canvasState() {
        return this.clients.has(this.targetClientId) ? this.canvasStates.get(this.targetClientId) || null : null;
    }

    /** 获取最近激活的网页客户端。 */
    private get targetClientId() {
        return this.activeClientId;
    }

    /** 返回 Canvas Agent 当前连接状态。 */
    health() {
        return { ok: true, protocolVersion: AGENT_PROTOCOL_VERSION, hasCanvas: Boolean(this.canvasState), clients: this.clients.size };
    }

    /** 建立网页与 Canvas Agent 之间的 SSE 连接。 */
    openEvents(url: URL, res: ServerResponse) {
        const clientId = url.searchParams.get("clientId") || crypto.randomUUID();
        logger.info("SSE client connected", { clientId });
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        this.clients.set(clientId, res);
        if (!this.activeClientId) this.activeClientId = clientId;
        this.clientFocusOrder.set(clientId, ++this.focusSequence);
        sendEvent(res, "hello", { ok: true, protocolVersion: AGENT_PROTOCOL_VERSION, clientId });
        const timer = setInterval(() => sendEvent(res, "ping", { time: Date.now() }), 15000);
        res.on("close", () => {
            clearInterval(timer);
            logger.info("SSE client disconnected", { clientId });
            if (this.clients.get(clientId) !== res) return;
            this.clients.delete(clientId);
            this.clientFocusOrder.delete(clientId);
            this.canvasStates.delete(clientId);
            this.pending.forEach((item, requestId) => {
                if (item.clientId !== clientId) return;
                this.pending.delete(requestId);
                item.reject(new Error("请求页面已断开"));
            });
            if (this.activeClientId === clientId) this.activeClientId = [...this.clients.keys()].sort((a, b) => (this.clientFocusOrder.get(b) || 0) - (this.clientFocusOrder.get(a) || 0))[0] || "";
            this.refRegistries.delete(clientId);
        });
    }

    /** 保存指定网页上报的最新画布快照。 */
    updateState(body: unknown, clientId?: string) {
        const targetClientId = clientId || this.activeClientId;
        if (!targetClientId || !this.clients.has(targetClientId)) return;
        const state = { ...((body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>), clientId: targetClientId } as CanvasSnapshot;
        this.canvasStates.set(targetClientId, state);
        this.refsFor(targetClientId).ensure(String(state.projectId || ""), state.nodes || []);
        logger.debug("Canvas state updated", { clientId: targetClientId, nodes: state.nodes?.length || 0, connections: state.connections?.length || 0 });
    }

    /** 将指定网页设为最近激活的工具目标。 */
    activateClient(clientId: string) {
        if (!this.clients.has(clientId)) throw new Error("当前网页未连接");
        this.activeClientId = clientId;
        this.clientFocusOrder.set(clientId, ++this.focusSequence);
        logger.debug("Canvas client activated", { clientId });
    }

    /** 接收网页返回的工具调用结果。 */
    resolveResult(clientId: string, body: { requestId?: string; error?: string; result?: unknown }) {
        const item = body.requestId ? this.pending.get(body.requestId) : null;
        if (!item || !body.requestId || item.clientId !== clientId) return false;
        this.pending.delete(body.requestId);
        logger.debug("Canvas tool result received", { clientId, requestId: body.requestId, error: body.error, result: body.result });
        body.error ? item.reject(new Error(body.error)) : item.resolve(body.result);
        return true;
    }

    /** 向全部已连接网页广播事件。 */
    emitAll(type: string, payload: unknown) {
        this.clients.forEach((client) => sendEvent(client, type, payload));
    }

    /** 获取指定网页的短引用注册表，不存在则创建。 */
    private refsFor(clientId: string) {
        let registry = this.refRegistries.get(clientId);
        if (!registry) {
            registry = new ShortIdRegistry();
            this.refRegistries.set(clientId, registry);
            const state = this.canvasStates.get(clientId);
            if (state) registry.ensure(String(state.projectId || ""), state.nodes || []);
        }
        return registry;
    }

    /** 校验工具参数并将调用分派到当前目标网页。 */
    async callTool(name: unknown, rawInput: unknown) {
        if (!isToolName(name)) throw new Error(`未知工具：${String(name)}`);
        logger.info("MCP tool called", { name, input: rawInput, targetClientId: this.targetClientId });
        const input = parseToolInput(name, rawInput) as Record<string, unknown>;
        if (SITE_TOOLS.has(name)) {
            if (!this.clients.size) throw new Error("当前没有已连接网页");
            // generation_get_status 的 nodeIds 与画布工具入参同样接受节点短引用，转发前先解析为真实 id。
            const resolved = name === "generation_get_status" ? (resolveToolNodeRefs(this.refsFor(this.targetClientId), input) as Record<string, unknown>) : input;
            return await this.requestCanvasTool(name, resolved);
        }
        const state = this.canvasState;
        const readTool = ["canvas_get_state", "canvas_get_selection", "canvas_get_nodes"].includes(name);
        if (readTool && (!this.clients.size || !state)) throw new Error("当前没有已连接画布");
        if (name === "canvas_get_state") return renderCanvasOverview(state, this.refsFor(this.targetClientId));
        if (name === "canvas_get_nodes") return this.getNodesDetailed((input as { ids: string[] }).ids);
        if (name === "canvas_get_selection") {
            const ids = new Set(state?.selectedNodeIds || []);
            return renderNodeRows((state?.nodes || []).filter((node) => ids.has(node.id)), this.refsFor(this.targetClientId)).join("\n");
        }
        if (!this.clients.size) throw new Error("当前没有已连接画布");
        const registry = this.refsFor(this.targetClientId);
        // 读图由页面执行（IndexedDB 图片降采样转 base64），服务端透传；结果经 mcp.ts 包装为 MCP image content。
        if (name === "canvas_read_image") return shortenToolNodeRefs(registry, await this.requestCanvasTool(name, resolveToolNodeRefs(registry, input) as Record<string, unknown>));
        const request = buildCanvasToolRequest(name, resolveToolNodeRefs(registry, input) as Record<string, unknown>, this.canvasState);
        return shortenToolNodeRefs(registry, await this.requestCanvasTool(request.name, request.input));
    }

    /** 返回指定节点的完整 metadata 和上下游邻居，供 Agent 读全文和评估删除/改连线影响；id 输出为短引用。 */
    private getNodesDetailed(ids: string[]) {
        const state = this.canvasState;
        if (!state) throw new Error("当前没有已连接画布");
        const registry = this.refsFor(this.targetClientId);
        const nodes = state.nodes || [];
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const found: unknown[] = [];
        const missing: string[] = [];
        ids.forEach((id) => {
            const realId = registry.resolve(id);
            const node = byId.get(realId);
            if (!node) {
                missing.push(id);
                return;
            }
            const relations = nodeRelations(nodes, state.connections || [], node.id);
            const shortenId = (item: { id: string; type: string; title?: string }) => ({ ...item, id: registry.shorten(item.id) });
            found.push({
                ...slimNodeMetadata(node),
                id: registry.shorten(node.id),
                upstream: relations.upstream.map(shortenId),
                downstream: relations.downstream.map(shortenId),
            });
        });
        return { nodes: found, missing };
    }

    /** 向目标网页发送工具请求并等待调用结果。 */
    private async requestCanvasTool(name: ToolName, input: Record<string, unknown>) {
        const requestId = crypto.randomUUID();
        const clientId = this.targetClientId;
        const client = this.clients.get(clientId);
        if (!client) throw new Error("当前没有已连接画布");
        sendEvent(client, "tool_call", { requestId, name, input });
        logger.debug("Canvas tool request sent", { requestId, name, input, clientId });
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                logger.warn("Canvas tool request timed out", { requestId, name, clientId });
                reject(new Error("画布操作超时"));
            }, 30000);
            this.pending.set(requestId, { clientId, resolve: (value) => (clearTimeout(timer), resolve(value)), reject: (error) => (clearTimeout(timer), reject(error)) });
        });
    }
}

/** 向 SSE 连接写入一个事件。 */
function sendEvent(res: ServerResponse, type: string, payload: unknown) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}
