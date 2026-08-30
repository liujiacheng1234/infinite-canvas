import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { toolDescriptions, toolInputSchemas, toolNames, type ToolName } from "../canvas/schemas.js";
import { AGENT_PROMPT, loadConfig, type CanvasAgentConfig, VERSION } from "../config.js";

type CanvasAgentToolResponse = { ok?: boolean; result?: unknown; error?: string };

/** 启动通过标准输入输出通信的 MCP 服务。 */
export async function startMcpServer() {
    const config = loadConfig(true);
    const server = new McpServer({ name: "canvas-agent", version: VERSION }, { instructions: AGENT_PROMPT });
    toolNames.forEach((name) => registerCanvasTool(server, config, name));
    await server.connect(new StdioServerTransport());
}

/** 向 MCP Server 注册单个 Canvas Agent 工具。 */
function registerCanvasTool(server: McpServer, config: CanvasAgentConfig, name: ToolName) {
    const schema = toolInputSchemas[name];
    server.registerTool(name, { description: toolDescriptions[name], inputSchema: schema.shape }, async (input: unknown) => {
        const result = await postCanvasAgentTool(config, name, schema.parse(input));
        return toToolContent(result);
    });
}

/** 结果携带 image 字段时输出 MCP 图像内容，便于多模态客户端直接看图；其余字段仍以 JSON 返回。 */
function toToolContent(result: unknown) {
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
    const res = await fetch(`${config.url}/api/tools`, { method: "POST", headers: { "content-type": "application/json", "x-canvas-agent-token": config.token }, body: JSON.stringify({ name, input }) });
    const body = (await res.json()) as CanvasAgentToolResponse;
    if (!body.ok) throw new Error(body.error || "tool call failed");
    return body.result;
}
