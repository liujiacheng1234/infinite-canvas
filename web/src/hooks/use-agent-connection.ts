import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { acquireAgentClientId } from "@/lib/agent/agent-client-id";
import { readAgentUrlBootstrap } from "@/lib/agent/agent-url-bootstrap";
import { isSiteTool, runSiteTool } from "@/lib/agent/agent-site-tools";
import type { CanvasAgentOp } from "@/lib/canvas/canvas-agent-ops";
import { readCanvasNodeImage } from "@/lib/canvas/canvas-image-reader";
import { activateAgentClient, postState, postToolResult } from "@/services/api/canvas-agent";
import { useAgentStore, type AgentCanvasContext } from "@/stores/use-agent-store";

/** 与 canvas-agent AGENT_PROTOCOL_VERSION 保持一致。 */
const AGENT_PROTOCOL_VERSION = 8;

type AgentHelloEvent = { ok?: boolean; protocolVersion?: number; clientId?: string };
type AgentToolCallEvent = { requestId: string; name: string; input?: { ops?: CanvasAgentOp[]; path?: string } & Record<string, unknown> };

/**
 * 全局本地 Agent 连接：建立 SSE、上报画布快照、执行 Agent 工具调用并回传结果。
 * 只要 localStorage 中保存过地址，应用启动后就会自动静默连接。
 */
export function useAgentConnection() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const clientIdRef = useRef("");
    const connectedRef = useRef(false);
    const canvasContextRef = useRef<AgentCanvasContext | null>(useAgentStore.getState().canvasContext);
    const enabled = useAgentStore((state) => state.enabled);
    const connected = useAgentStore((state) => state.connected);
    const url = useAgentStore((state) => state.url);
    const endpoint = url.trim().replace(/\/$/, "");

    // 挂载时恢复标签页身份；支持 #agentUrl= 引导参数，并在已有配置时自动静默连接。
    useEffect(() => {
        let disposed = false;
        void acquireAgentClientId().then((clientId) => {
            if (disposed) return;
            clientIdRef.current = clientId;
            const state = useAgentStore.getState();
            const bootstrap = readAgentUrlBootstrap(window.location.hash);
            if (bootstrap) {
                window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${bootstrap.remainingHash || ""}`);
                state.setAgentState({ url: bootstrap.url || state.url });
                state.connectAgent({ silent: true });
                return;
            }
            if (!state.enabled && state.url) state.connectAgent({ silent: true });
        });
        return () => {
            disposed = true;
        };
    }, []);

    // Imperatively observe canvasContext to debounce snapshot reports without rerendering on every frame.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = useAgentStore.subscribe((state) => {
            if (state.canvasContext === canvasContextRef.current) return;
            canvasContextRef.current = state.canvasContext;
            if (!useAgentStore.getState().connected) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => void postState(endpoint, clientIdRef.current, canvasContextRef.current?.snapshot || null), 300);
        });
        return () => {
            unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [endpoint]);

    useEffect(() => {
        if (!enabled || !clientIdRef.current) return;
        const clientId = clientIdRef.current;
        const rt = (key: string, options?: Record<string, unknown>) => t(`agent.runtime.${key}`, options);
        let disposed = false;
        const source = new EventSource(`${endpoint}/events?clientId=${encodeURIComponent(clientId)}`);
        source.addEventListener("hello", (event) => {
            if (disposed) return;
            const hello = parseEventData<AgentHelloEvent>(event);
            if (hello?.protocolVersion !== AGENT_PROTOCOL_VERSION) {
                const text = rt("agentOutdated");
                source.close();
                useAgentStore.getState().setAgentState({ enabled: false, connected: false, activity: rt("restartRequired"), connectError: text, silentConnect: false });
                return;
            }
            connectedRef.current = true;
            useAgentStore.getState().setAgentState({ connected: true, activity: i18n.t("agent.status.connected"), connectError: "", silentConnect: false });
            void postState(endpoint, clientId, canvasContextRef.current?.snapshot || null);
            if (document.visibilityState === "visible" && document.hasFocus()) void activateAgentClient(endpoint, clientId);
        });
        source.addEventListener("tool_call", (event) => {
            if (disposed) return;
            const data = parseEventData<AgentToolCallEvent>(event);
            if (data) void handleToolCall(endpoint, clientId, navigate, data);
        });
        source.onerror = () => {
            if (disposed) return;
            const wasConnected = connectedRef.current;
            connectedRef.current = false;
            const silent = useAgentStore.getState().silentConnect && !wasConnected;
            useAgentStore.getState().setAgentState({
                activity: rt(wasConnected ? "connectionLost" : "connectionFailed"),
                connected: false,
                connectError: silent ? "" : rt(wasConnected ? "connectionLostDescription" : "connectionFailedDescription"),
                silentConnect: false,
            });
            // Silent auto-start sessions retry quietly so the page reconnects once canvas-agent becomes available;
            // explicit manual connections stop here so invalid-token errors stay visible.
            if (!wasConnected) {
                source.close();
                useAgentStore.getState().setAgentState({ enabled: false });
                if (silent && !disposed) {
                    setTimeout(() => {
                        const state = useAgentStore.getState();
                        if (!disposed && !state.connected && !state.enabled) state.connectAgent({ silent: true });
                    }, 5000);
                }
            }
        };
        return () => {
            disposed = true;
            source.close();
            connectedRef.current = false;
        };
    }, [enabled, endpoint, navigate, t]);

    // 页面获得焦点时把当前标签页设为工具目标。
    useEffect(() => {
        if (!connected) return;
        const activate = () => void activateAgentClient(endpoint, clientIdRef.current);
        const activateVisible = () => {
            if (document.visibilityState === "visible") activate();
        };
        window.addEventListener("focus", activate);
        document.addEventListener("visibilitychange", activateVisible);
        return () => {
            window.removeEventListener("focus", activate);
            document.removeEventListener("visibilitychange", activateVisible);
        };
    }, [connected, endpoint]);
}

/** 执行 Agent 工具调用并把结果回传给本地服务。 */
async function handleToolCall(endpoint: string, clientId: string, navigate: ReturnType<typeof useNavigate>, payload: AgentToolCallEvent) {
    const rt = (key: string, options?: Record<string, unknown>) => i18n.t(`agent.runtime.${key}`, options);
    try {
        if (isSiteTool(payload.name)) {
            const result = await runSiteTool(payload.name, payload.input || {}, navigate, { canvasSnapshot: useAgentStore.getState().canvasContext?.snapshot || null });
            await postToolResult(endpoint, clientId, { requestId: payload.requestId, result });
            return;
        }
        const input: { ops?: CanvasAgentOp[]; path?: string } = payload.input || {};
        let result: unknown;
        if (payload.name === "site_navigate") {
            const path = input.path || "/";
            navigate(path);
            result = { ok: true, path };
        } else if (payload.name === "canvas_apply_ops") {
            const context = useAgentStore.getState().canvasContext;
            if (!context) throw new Error(rt("openCanvasFirst"));
            const { snapshot, receipt } = context.applyOpsWithReceipt(input.ops || []);
            result = { ok: receipt.opResults.every((item) => item.ok), ...receipt, nodeCount: snapshot.nodes.length, connectionCount: snapshot.connections.length, selectedNodeIds: snapshot.selectedNodeIds, hint: rt("opsReceiptHint") };
            void postState(endpoint, clientId, snapshot);
        } else if (payload.name === "canvas_read_image") {
            const snapshot = useAgentStore.getState().canvasContext?.snapshot;
            if (!snapshot) throw new Error(rt("openCanvasFirst"));
            result = await readCanvasNodeImage(snapshot, payload.input as { nodeId?: string; imageId?: string } || {});
        } else {
            result = { ok: false, error: rt("unknownCanvasTool", { name: payload.name }) };
        }
        await postToolResult(endpoint, clientId, { requestId: payload.requestId, result });
    } catch (error) {
        const message = error instanceof Error ? error.message : rt("canvasOperationFailed");
        await postToolResult(endpoint, clientId, { requestId: payload.requestId, error: message }).catch(() => undefined);
    }
}

function parseEventData<T>(event: MessageEvent) {
    try {
        return JSON.parse(String(event.data || "")) as T;
    } catch {
        return null;
    }
}
