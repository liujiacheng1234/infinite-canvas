import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCanvasToolRequest } from "./operations.js";

function opsOf(name: Parameters<typeof buildCanvasToolRequest>[0], input: Record<string, unknown>) {
    const request = buildCanvasToolRequest(name, input, null);
    return (request.input as { ops: Array<Record<string, any>> }).ops;
}

test("generation flow reuses referenced nodes when the prompt only mentions them", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "@[node:text-1]", referenceNodeIds: ["text-1"], title: "Flow", autoRun: true });
    const addedTextNodes = ops.filter((op) => op.type === "add_node" && op.nodeType === "text");
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    const runs = ops.filter((op) => op.type === "run_generation");
    assert.equal(addedTextNodes.length, 0);
    assert.equal(ops.filter((op) => op.type === "connect_nodes" && op.fromNodeId === "text-1" && String(op.toNodeId).startsWith("config-")).length, 1);
    assert.match(String(config?.metadata?.prompt), /^@\[node:text-1\]$/);
    assert.equal(runs.length, 1);
});

test("generation flow still creates a prompt node for prose prompts", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "a cat on a roof", referenceNodeIds: ["text-1"], autoRun: true });
    assert.equal(ops.filter((op) => op.type === "add_node" && op.nodeType === "text").length, 1);
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    assert.match(String(config?.metadata?.prompt), /@\[node:text-/);
});

test("update_node_text on non-text nodes only patches title (metadata.content is media URL)", () => {
    const request = buildCanvasToolRequest("canvas_update_node_text", { id: "img-1", text: "新标题", title: "新标题" }, { nodes: [{ id: "img-1", type: "image", position: { x: 0, y: 0 }, width: 100, height: 100 }] });
    const op = (request.input as { ops: Array<Record<string, any>> }).ops[0];
    assert.equal(op.type, "update_node");
    assert.equal(op.patch.title, "新标题");
    assert.equal(op.metadata, undefined);
});

test("update_node_text on text nodes still writes metadata.content", () => {
    const request = buildCanvasToolRequest("canvas_update_node_text", { id: "text-1", text: "正文", title: "标题" }, { nodes: [{ id: "text-1", type: "text", position: { x: 0, y: 0 }, width: 100, height: 100 }] });
    const op = (request.input as { ops: Array<Record<string, any>> }).ops[0];
    assert.equal(op.patch.title, "标题");
    assert.equal(op.metadata.content, "正文");
});
