# Infinite Canvas Agent

本地 Canvas Agent 是一个运行在本机的桥接服务：它把 `infinite-canvas` MCP 工具调用转发到浏览器中已打开的画布网页执行，从而让任意支持 MCP 的客户端（如 Codex CLI、Claude Code、pi 等）直接操作当前画布。

## 启动

```bash
cd canvas-agent
npm install
npm run build
node dist/index.js
```

启动后输出本机地址：

```txt
Local URL: http://127.0.0.1:17371
```

浏览器打开无限画布网页后会自动连接本地 Agent（连接地址由网页保存，默认 `http://127.0.0.1:17371`），也可以通过 URL 参数 `#agentUrl=...` 引导连接。

日常使用无需手动保持这个终端：MCP 客户端启动 `canvas-agent mcp` 时，若本地服务未运行，会自动以独立后台进程拉起并等待就绪；MCP 客户端退出后后台服务继续运行，网页画布保持连接。停止后台服务可在任务管理器结束对应的 node 进程。

需要排查连接或工具调用问题时，可开启 Debug 模式：

```bash
node dist/index.js --debug
```

Debug 日志会以 `[DEBUG][HH:mm:ss]` 等格式输出到终端，并按启动日期保存到 `~/.infinite-canvas/logs/canvas-agent-YYYY-MM-DD.log`；日志中的图片 Data URL 会自动隐藏。

## 注册 MCP

在 MCP 客户端中把 Canvas Agent 注册为 `infinite-canvas` MCP 服务：

```bash
<client> mcp add infinite-canvas -- node /path/to/infinite-canvas/canvas-agent/dist/index.js mcp
```

## 安全

- 不使用连接 token：本地服务默认只监听 `127.0.0.1`，仅接受本机访问。
- 网页首次连接后，Canvas Agent 会记录该网页 Origin 并写入允许列表；之后其他 Origin 不能复用这个本地 Agent，除非清理 `~/.infinite-canvas/canvas-agent.json` 里的 `origins`。
- 服务用锁文件保证单实例（`~/.infinite-canvas/canvas-agent.json.lock`）；锁残留但原进程已退出时会自动清理。

## Skills 提示词文档

仓库根目录 `skills/` 下提供两个给 MCP 客户端参考的 skill 文档：

- `skills/canvas/SKILL.md`：画布操作技巧（分层读取、短引用、写入回执、生成流程组织）。
- `skills/open-canvas/SKILL.md`：打开画布并自动连接本地 Agent 的完整步骤。

支持 skills 的 MCP 客户端可以把这两个目录复制或链接到自己的 skill 目录；不支持的客户端可把内容直接粘进系统提示词。

## 发布

`canvas-agent` 使用自己的 `package.json` 版本号，不跟仓库根目录 `VERSION` 绑定。
