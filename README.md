<h1 align="center">无限画布 (infinite-canvas)</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f97316?style=flat-square" alt="License"></a>
  <a href="https://github.com/liujiacheng1234/infinite-canvas/tags"><img src="https://img.shields.io/github/v/tag/liujiacheng1234/infinite-canvas?style=flat-square&label=version" alt="Version"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-7-ca4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a> · <a href="docs/content/docs/overview/features.mdx">功能介绍</a> · <a href="docs/content/docs/overview/render.mdx">Render 部署</a> · <a href="docs/content/docs/overview/docker.mdx">Docker 部署</a> · <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布节点操作手册</a> · <a href="docs/content/docs/canvas/canvas-shortcuts.mdx">画布快捷键</a> · <a href="docs/content/docs/progress/todo.mdx">待办事项</a> · <a href="canvas-agent/README.md">本地 Canvas Agent</a>
</p>

无限画布是一款本地优先的 AI 视觉创作工作台：在无限画布上编排提示词、参考图和生成节点，浏览器直连你自己的 AI 接口完成图片、视频、音频和文本生成；再通过本机 Canvas Agent 把画布开放给任意 MCP 客户端操作。

- **数据本地优先**：画布、素材、生成记录和 API 配置默认保存在浏览器本地，不依赖项目后端。
- **MCP 优先的 Agent 接入**：不内置任何对话运行时，网页只作为画布执行端，把工具开放给 Codex CLI、Claude Code、pi 等任意 MCP 客户端。

## 核心功能

- 无限画布：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- AI 创作：浏览器前台直连你配置的 OpenAI 兼容接口，支持文生图、图生图、参考图编辑、文本问答、音频和视频生成。
- 本地 MCP 桥接：通过本机 Canvas Agent，让任意 MCP 客户端直接读取和操作当前画布，多标签页之间自动隔离。
- 插件系统：支持通过 URL 动态安装 / 启用 / 更新 / 卸载远程节点插件，并提供 TypeScript SDK 自行开发画布节点插件。
- 自定义接口调用：可自定义生图 / 视频接口的调用方式，灵活适配各类中转站与自建服务。
- 提示词库：内置 7 个开源提示词来源并支持自定义标准 JSON 来源，由浏览器前端直连并缓存到 IndexedDB。

完整功能说明见 [功能介绍](docs/content/docs/overview/features.mdx)。

## 相对上游的主要变化

本项目 fork 自 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，此后按自身方向独立演进，不再跟随上游更新。相对上游的主要变化：

- **移除内置 Codex 对话运行时**：删除 `@openai/codex` 依赖、Codex app-server 集成、Claude CLI 适配器和 Skills 存储，canvas-agent 精简为纯 MCP 桥接（HTTP 服务 + stdio MCP）。
- **移除网页右侧对话面板**：删除整个对话 UI（消息流、线程历史、Skills 面板、权限审批、附件上传等），网页只保留画布执行端职责。
- **Agent 连接自动化**：新增全局连接 hook，应用启动后自动静默连接本地 Agent；`#agentUrl=&agentToken=` URL 参数可引导连接；配置页和画布顶栏提供连接状态与配置入口。
- **MCP 工具面精简**：移除依赖对话附件的 `canvas_create_attachment_nodes` 工具；保留完整的画布读写、生成流程、工作台、提示词库和素材工具。
- **文档与治理对齐**：移除 Codex 插件与侧边栏对话相关文档，恢复并更新 `skills/` 提示词文档；版本检查、GitHub 链接、安全报告渠道全部指向本仓库。

## 快速开始

### 本地开发

```bash
git clone git@github.com:liujiacheng1234/infinite-canvas.git
cd infinite-canvas/web
npm install
npm run dev
```

### Docker 运行

```bash
git clone git@github.com:liujiacheng1234/infinite-canvas.git
cd infinite-canvas
docker compose up -d
```

运行后默认端口 3000，可访问 `http://localhost:3000`。

首次打开后进入右上角配置，填入自己的 OpenAI 兼容 `Base URL` 和 `API Key`。

### 连接 MCP 客户端

1. 构建并启动本地 Agent：

```bash
cd canvas-agent
npm install
npm run build
node dist/index.js
```

2. 打开画布网页，在配置页「本地 Agent 连接」或画布顶栏状态点中填入 `Local URL` 和 `Connect Token`（也可以用 `#agentUrl=<Local URL>&agentToken=<Connect token>` 打开网页自动连接）。

3. 在 MCP 客户端中注册 `infinite-canvas` MCP：

```bash
<client> mcp add infinite-canvas -- node /path/to/infinite-canvas/canvas-agent/dist/index.js mcp
```

之后 MCP 客户端即可读取和操作浏览器中打开的画布。详见 [Canvas Agent](canvas-agent/README.md)。

## 开源协议

本项目基于 [MIT License](LICENSE) 发布。

项目 fork 自 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，感谢原作者的工作；当前版本已按自身方向独立演进。
