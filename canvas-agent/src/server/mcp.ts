import { spawn } from "node:child_process";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { toolDescriptions, toolInputSchemas, toolNames, type ToolName } from "../canvas/schemas.js";
import { AGENT_PROMPT, loadConfig, type CanvasAgentConfig, VERSION } from "../config.js";

type CanvasAgentToolResponse = { ok?: boolean; result?: unknown; error?: string };

/** 启动通过标准输入输出通信的 MCP 服务。 */
export async function startMcpServer() {
    const config = loadConfig(true);
    await ensureHttpServer(config);
    const server = new McpServer({ name: "canvas-agent", version: VERSION }, { instructions: AGENT_PROMPT });
    toolNames.forEach((name) => registerCanvasTool(server, config, name));
    await server.connect(new StdioServerTransport());
}

/** 本地 HTTP 服务未运行时以独立后台进程拉起并等待就绪，网页与工具转发不再依赖手动保持 CMD 运行。 */
async function ensureHttpServer(config: CanvasAgentConfig) {
    if (await isHealthy(config.url)) return;
    const entry = path.resolve(process.argv[1] || "");
    if (!entry) return;
    spawn(process.execPath, [entry], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    for (let waited = 0; waited < 10000 && !(await isHealthy(config.url)); waited += 250) await sleep(250);
}

async function isHealthy(url: string) {
    try {
        return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) })).ok;
    } catch {
        return false;
    }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 向 MCP Server 注册单个 Canvas Agent 工具。 */
function registerCanvasTool(server: McpServer, config: CanvasAgentConfig, name: ToolName) {
    const schema = toolInputSchemas[name];
    server.registerTool(name, { description: toolDescriptions[name], inputSchema: schema.shape }, async (input: unknown) => {
        const result = await postCanvasAgentTool(config, name, schema.parse(input));
        return toToolContent(result);
    });
}

/** 结果为字符串时直传（如 get_state 的表头行文本）；携带 image 字段时输出 MCP 图像内容，便于多模态客户端直接看图；其余字段仍以 JSON 返回。 */
function toToolContent(result: unknown) {
    if (typeof result === "string") return { content: [{ type: "text" as const, text: result }] };
    const record = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
    const image = record.image as { data?: unknown; mimeType?: unknown } | undefined;
    if (typeof image?.data !== "string") return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    const { image: _image, ...rest } = record;
    return {
        content: [
            { type: "image" as const, data: image.data, mimeType: typeof image.mimeType === "string" ? image.mimeType : "image/png" },
            { type: "text" as const, text: JSON.stringify(rest, null, 2) },
        ],
    };
}

/** 将 MCP 工具调用转发到本地 Canvas Agent HTTP 服务。 */
async function postCanvasAgentTool(config: CanvasAgentConfig, name: ToolName, input: unknown) {
    const res = await fetch(`${config.url}/api/tools`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, input }) });
    const body = (await res.json()) as CanvasAgentToolResponse;
    if (!body.ok) throw new Error(body.error || "tool call failed");
    return body.result;
}
