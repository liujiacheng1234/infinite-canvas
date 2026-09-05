import { create } from "zustand";
import i18n from "@/i18n";

import type { CanvasAgentApplyReceipt, CanvasAgentOp, CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";

export type AgentCanvasContext = { snapshot: CanvasAgentSnapshot; applyOps: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot; applyOpsWithReceipt: (ops?: CanvasAgentOp[]) => { snapshot: CanvasAgentSnapshot; receipt: CanvasAgentApplyReceipt }; undoOps: () => CanvasAgentSnapshot | null; canUndo: boolean };

type AgentStore = {
    url: string;
    token: string;
    connected: boolean;
    enabled: boolean;
    silentConnect: boolean;
    activity: string;
    connectError: string;
    canvasContext: AgentCanvasContext | null;
    setAgentState: (patch: Partial<Omit<AgentStore, "setAgentState" | "connectAgent" | "disconnectAgent" | "setCanvasContext">>) => void;
    connectAgent: (options?: { silent?: boolean }) => void;
    disconnectAgent: (patch?: Partial<Omit<AgentStore, "setAgentState" | "connectAgent" | "disconnectAgent" | "setCanvasContext">>) => void;
    setCanvasContext: (context: AgentCanvasContext | null) => void;
};

/** 本地 Canvas Agent 连接状态；工具执行由 use-agent-connection 负责。 */
export const useAgentStore = create<AgentStore>((set, get) => ({
    url: typeof window === "undefined" ? "http://127.0.0.1:17371" : localStorage.getItem("canvas-agent-url") || "http://127.0.0.1:17371",
    token: typeof window === "undefined" ? "" : localStorage.getItem("canvas-agent-token") || "",
    connected: false,
    enabled: false,
    silentConnect: false,
    activity: i18n.t("agent.state.offline"),
    connectError: "",
    canvasContext: null,
    setAgentState: (patch) => set(patch),
    connectAgent: (options) => {
        const silent = options?.silent ?? false;
        const endpoint = get().url.trim().replace(/\/$/, "");
        const token = get().token.trim();
        if (!endpoint || !token) return set({ connectError: silent ? "" : i18n.t("agent.state.connectionRequired") });
        try {
            const parsed = new URL(endpoint);
            if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
            return set({ connectError: silent ? "" : i18n.t("agent.state.invalidUrl") });
        }
        localStorage.setItem("canvas-agent-url", endpoint);
        localStorage.setItem("canvas-agent-token", token);
        // Only set enabled here; use-agent-connection owns SSE initialization.
        set({ url: endpoint, token, enabled: true, silentConnect: silent, activity: i18n.t("agent.status.connecting"), connectError: "" });
    },
    disconnectAgent: (patch = {}) => {
        set({ enabled: false, connected: false, silentConnect: false, activity: i18n.t("agent.state.offline"), ...patch });
    },
    setCanvasContext: (canvasContext) => set({ canvasContext }),
}));
