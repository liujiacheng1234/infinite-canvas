import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";

import { CanvasSession } from "./session.js";

test("MCP 读取当前激活网页的画布", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    t.after(() => {
        first.close();
        second.close();
    });
    session.updateState(snapshot("canvas-first"), "first");
    session.updateState(snapshot("canvas-second"), "second");

    session.activateClient("first");
    assert.match(await session.callTool("canvas_get_state", {}), /canvas-first/);

    session.activateClient("second");
    assert.match(await session.callTool("canvas_get_state", {}), /canvas-second/);
});

test("画布写操作只发送给当前激活网页", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    t.after(() => {
        first.close();
        second.close();
    });
    session.updateState(snapshot("canvas-first"), "first");
    session.updateState(snapshot("canvas-second"), "second");
    session.activateClient("second");

    const result = session.callTool("canvas_create_text_node", { text: "只写入第二个画布" });
    const call = second.event("tool_call");
    assert.equal(first.event("tool_call"), undefined);
    assert.equal(field(call, "name"), "canvas_apply_ops");
    session.resolveResult("second", { requestId: String(field(call, "requestId")), result: { ok: true } });
    assert.deepEqual(await result, { ok: true });
});

test("tool result is accepted only from the request client", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    t.after(() => {
        first.close();
        second.close();
    });
    session.activateClient("first");

    const result = session.callTool("canvas_create_text_node", { text: "first only" });
    const call = first.event("tool_call");
    const requestId = String(field(call, "requestId"));

    assert.equal(session.resolveResult("second", { requestId, result: { client: "second" } }), false);
    assert.equal(session.resolveResult("first", { requestId, result: { client: "first" } }), true);
    assert.deepEqual(await result, { client: "first" });
});

test("生成状态查询由当前激活网页返回", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    t.after(() => {
        first.close();
        second.close();
    });
    session.activateClient("second");

    const result = session.callTool("generation_get_status", { scope: "all" });
    const call = second.event("tool_call");
    assert.equal(first.event("tool_call"), undefined);
    assert.equal(field(call, "name"), "generation_get_status");
    session.resolveResult("second", { requestId: String(field(call, "requestId")), result: { total: 1, tasks: [{ id: "image-1", status: "running" }] } });
    assert.deepEqual(await result, { total: 1, tasks: [{ id: "image-1", status: "running" }] });
});

test("generation_get_status 的 nodeIds 支持节点短引用", async (t) => {
    const session = new CanvasSession();
    const page = connect(session, "first");
    t.after(() => page.close());
    session.updateState(
        { ...snapshot("canvas-first"), nodes: [{ id: "image-real-1", type: "image", title: "home", position: { x: 0, y: 0 }, width: 100, height: 100 }] },
        "first",
    );
    session.activateClient("first");

    const result = session.callTool("generation_get_status", { nodeIds: ["n1"] });
    const call = page.event("tool_call");
    assert.equal(field(call, "name"), "generation_get_status");
    assert.deepEqual(field(field(call, "input"), "nodeIds"), ["image-real-1"]);
    session.resolveResult("first", { requestId: String(field(call, "requestId")), result: { total: 0, tasks: [] } });
    assert.deepEqual(await result, { total: 0, tasks: [] });
});

test("活动网页关闭后回退到仍连接的画布", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    t.after(() => {
        first.close();
        second.close();
    });
    session.updateState(snapshot("canvas-first"), "first");
    session.updateState(snapshot("canvas-second"), "second");
    session.activateClient("second");
    second.close();

    assert.match(await session.callTool("canvas_get_state", {}), /canvas-first/);
});

test("closing the active client falls back to the most recently focused client", async (t) => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const second = connect(session, "second");
    const third = connect(session, "third");
    t.after(() => {
        first.close();
        second.close();
        third.close();
    });
    session.updateState(snapshot("canvas-first"), "first");
    session.updateState(snapshot("canvas-second"), "second");
    session.updateState(snapshot("canvas-third"), "third");
    session.activateClient("third");
    session.activateClient("second");
    second.close();

    assert.match(await session.callTool("canvas_get_state", {}), /canvas-third/);
});

test("closing a client rejects its pending tool requests", async () => {
    const session = new CanvasSession();
    const first = connect(session, "first");
    const result = session.callTool("canvas_create_text_node", { text: "pending" });
    const call = first.event("tool_call");
    const requestId = String(field(call, "requestId"));
    first.close();

    const outcome = await Promise.race([
        result.then(() => "resolved", (error) => error instanceof Error ? error.message : String(error)),
        new Promise<string>((resolve) => setTimeout(() => resolve("pending"), 20)),
    ]);
    if (outcome === "pending") session.resolveResult("first", { requestId, result: null });
    assert.match(outcome, /断开/);
});

test("hello 事件返回协议版本和客户端 id", () => {
    const session = new CanvasSession();
    const client = connect(session, "first");
    client.close();

    const hello = client.event("hello");
    assert.equal(field(hello, "protocolVersion"), 7);
    assert.equal(field(hello, "clientId"), "first");
});

test("节点短引用在概览、读取和写入之间闭环", async (t) => {
    const session = new CanvasSession();
    const client = connect(session, "first");
    t.after(() => client.close());
    session.updateState(
        {
            projectId: "p1",
            title: "p1",
            nodes: [
                { id: "text-long-uuid-1", type: "text", title: "提示词", position: { x: 0, y: 0 }, width: 340, height: 240, metadata: { content: "一只猫", status: "success" } },
                { id: "config-long-uuid-2", type: "config", title: "图片生成", position: { x: 420, y: 0 }, width: 340, height: 420, metadata: { status: "idle" } },
            ],
            connections: [{ id: "conn-1", fromNodeId: "text-long-uuid-1", toNodeId: "config-long-uuid-2" }],
            selectedNodeIds: [],
            viewport: { x: 0, y: 0, k: 1 },
        },
        "first",
    );
    session.activateClient("first");

    const overview = String(await session.callTool("canvas_get_state", {}));
    assert.match(overview, /,n1,text,/);
    assert.match(overview, /,n2,config,/);
    assert.match(overview, /connections\[1\]\{from,to\}:\n0,1/);
    assert.doesNotMatch(overview, /text-long-uuid-1/);

    const detail = (await session.callTool("canvas_get_nodes", { ids: ["n1", "missing-short"] })) as { nodes: Array<Record<string, unknown>>; missing: string[] };
    assert.equal(detail.nodes[0].id, "n1");
    assert.equal(detail.nodes[0].metadata.content, "一只猫");
    assert.equal(field(detail.nodes[0].downstream[0], "id"), "n2");
    assert.deepEqual(detail.missing, ["missing-short"]);

    const update = session.callTool("canvas_update_node", { id: "n2", patch: { title: "新标题" } });
    const updateCall = client.event("tool_call");
    const ops = (field(updateCall, "input") as { ops: Array<Record<string, unknown>> }).ops;
    assert.equal(ops[0].id, "config-long-uuid-2");
    session.resolveResult("first", { requestId: String(field(updateCall, "requestId")), result: { ok: true, opResults: [{ op: "update_node", ok: true, nodeId: "config-long-uuid-2" }], created: [], removedConnections: [] } });
    const receipt = (await update) as { opResults: Array<{ nodeId?: string }> };
    assert.equal(receipt.opResults[0].nodeId, "n2");

    const flow = session.callTool("canvas_generate_image", { prompt: "参考 @[node:n1] 的风格", referenceNodeIds: ["n1"] });
    const flowCall = client.events("tool_call")[1];
    assert.ok(flowCall);
    const flowOps = (field(flowCall, "input") as { ops: Array<Record<string, unknown>> }).ops;
    const config = flowOps.find((op) => op.type === "add_node" && op.nodeType === "config");
    assert.match(String((config?.metadata as Record<string, unknown>).prompt), /@\[node:text-long-uuid-1\]/);
    assert.equal(flowOps.some((op) => op.type === "connect_nodes" && op.fromNodeId === "text-long-uuid-1"), true);
    session.resolveResult("first", { requestId: String(field(flowCall, "requestId")), result: { ok: true } });
    await flow;
});

function connect(session: CanvasSession, clientId: string) {
    const response = new FakeSseResponse();
    session.openEvents(new URL(`http://127.0.0.1/events?clientId=${clientId}`), response as unknown as ServerResponse);
    return response;
}

/** 创建最小画布快照。 */
function snapshot(projectId: string) {
    return { projectId, title: projectId, nodes: [], connections: [], selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } };
}

/** 安全读取测试对象字段。 */
function field(value: unknown, key: string) {
    return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

/** 模拟 Node SSE 响应并提供事件读取能力。 */
class FakeSseResponse extends EventEmitter {
    private chunks: string[] = [];

    /** 模拟写入响应头。 */
    writeHead() {
        return this;
    }

    /** 保存写入的 SSE 文本块。 */
    write(chunk: string) {
        this.chunks.push(chunk);
        return true;
    }

    /** 读取指定类型的首个 SSE 事件数据。 */
    event(type: string) {
        return this.events(type)[0];
    }

    /** 读取指定类型的全部 SSE 事件数据。 */
    events(type: string) {
        return this.chunks.flatMap((chunk) => {
            if (!chunk.startsWith(`event: ${type}\n`)) return [];
            const data = chunk.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
            return data ? [JSON.parse(data) as unknown] : [];
        });
    }

    /** 触发连接关闭事件。 */
    close() {
        this.emit("close");
    }
}
