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

## 相对上游的优势

本项目 fork 自 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，此后按自身方向独立演进，不再跟随上游更新。相比上游 main 分支：

| 维度 | 上游 main | 本 fork |
|---|---|---|
| Agent 接入 | 内置 Codex app-server 运行时和右侧对话面板，重、绑定单一客户端，界面被对话 UI 占据 | **纯 MCP 桥接**：拆掉全部内置运行时，任何 MCP 客户端（Codex CLI / Claude Code / pi…）平等接入；网页回到纯画布，连接全自动（启动即连、URL 引导、配置页与顶栏随时改） |
| Agent 读画布 | 概览一次性返回大 JSON，节点 id 为长 UUID，无法看图、读不到全文 | **分层读取**：表头行概览 + 稳定短引用（150 节点概览再省约 1K token）；`canvas_get_nodes` 按需读全文和上下游邻居，`canvas_read_image` 直接看图 |
| Agent 写画布 | 返回全量快照，写失败要靠重读才发现 | **逐条执行回执**：每个 op 的成功/失败/原因、新建节点 id、被断开的连线一次返回，失败立即修正，不用猜 |
| 画布性能 | 状态变更全量广播，拖拽/缩放帧内重渲染所有可见节点 | **world store 分片订阅**：拖拽、缩放零节点重渲染，连线 memo 化、滚轮 rAF 节流、小地图延迟渲染，大画布依然顺滑 |
| 依赖健康度 | 捆绑 `@openai/codex` 运行时，`@ant-design/pro-components` 触发 antd 6 peer 冲突导致 npm install 失败 | 移除全部对话运行时依赖，npm install 一次通过 |

逐项变更记录见 [CHANGELOG](CHANGELOG.md) 的 `Unreleased` 段落，最早一条为「移除未使用的 `@ant-design/pro-components` 依赖」；该段落之后的「上游遗留」与历史版本条目来自原项目，仅作参考。

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
