import { create } from "zustand";

import type { CanvasConnection, CanvasNodeData, ViewportTransform } from "@/types/canvas";

// World store holds the high-frequency canvas state (nodes, connections, selection, viewport).
// Components subscribe to granular slices so interaction frames only rerender the canvas world,
// not the whole page. Action signatures match the previous React state setters one-to-one.
export type CanvasWorldState = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: Set<string>;
    selectedConnectionId: string | null;
    viewport: ViewportTransform;
    byId: Map<string, CanvasNodeData>;
    setNodes: (next: CanvasNodeData[] | ((prev: CanvasNodeData[]) => CanvasNodeData[])) => void;
    setConnections: (next: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => void;
    setSelectedNodeIds: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    setSelectedConnectionId: (next: string | null | ((prev: string | null) => string | null)) => void;
    setViewport: (next: ViewportTransform | ((prev: ViewportTransform) => ViewportTransform)) => void;
};

const buildById = (nodes: CanvasNodeData[]) => new Map(nodes.map((node) => [node.id, node]));

export const useCanvasWorldStore = create<CanvasWorldState>()((set) => ({
    nodes: [],
    connections: [],
    selectedNodeIds: new Set<string>(),
    selectedConnectionId: null,
    viewport: { x: 0, y: 0, k: 1 },
    byId: buildById([]),
    setNodes: (next) =>
        set((state) => {
            const nodes = typeof next === "function" ? next(state.nodes) : next;
            if (nodes === state.nodes) return state;
            return { nodes, byId: buildById(nodes) };
        }),
    setConnections: (next) => set((state) => ({ connections: typeof next === "function" ? next(state.connections) : next })),
    setSelectedNodeIds: (next) =>
        set((state) => {
            const selectedNodeIds = typeof next === "function" ? next(state.selectedNodeIds) : next;
            return selectedNodeIds === state.selectedNodeIds ? state : { selectedNodeIds };
        }),
    setSelectedConnectionId: (next) =>
        set((state) => {
            const selectedConnectionId = typeof next === "function" ? next(state.selectedConnectionId) : next;
            return selectedConnectionId === state.selectedConnectionId ? state : { selectedConnectionId };
        }),
    setViewport: (next) =>
        set((state) => {
            const viewport = typeof next === "function" ? next(state.viewport) : next;
            return viewport === state.viewport ? state : { viewport };
        }),
}));
