---
name: open-canvas
description: 打开 Infinite Canvas 在线或本地画布，并自动连接本地 Canvas Agent。用户要求打开、启动、进入或使用 Infinite Canvas 画布时使用。
---

# Open Infinite Canvas

默认打开在线版。只有用户明确要求使用本地项目时，才启动本地前端。

## 在线版

1. 启动本地 Canvas Agent 并保持运行：

```bash
npx -y @basketikun/canvas-agent@latest
```

2. 从启动输出取得 `Local URL` 和 `Connect token`。

3. 在浏览器打开：

```text
https://canvas.best/canvas?mode=new#agentUrl=<Local URL>&agentToken=<Connect token>
```

## 本地版

1. 在 Infinite Canvas 项目中启动前端，并使用 Vite 输出的 `Local` 地址：

```bash
cd web
npm install
npm run dev
```

2. 启动本地 Canvas Agent：

```bash
npx -y @basketikun/canvas-agent@latest
```

3. 从启动输出取得 `Local URL` 和 `Connect token`，在浏览器打开：

```text
<Vite Local 地址>/canvas?mode=new#agentUrl=<Local URL>&agentToken=<Connect token>
```

## MCP 与连接地址

画布操作通过 `infinite-canvas` MCP 提供。在 MCP 客户端中注册：

```bash
<client> mcp add infinite-canvas -- npx -y @basketikun/canvas-agent mcp
```

上面启动的普通 Canvas Agent 负责提供 `Local URL` 和 `Connect token`，并与 MCP 进程读取同一份本地配置。画布网页打开后会自动连接本地 Agent；带 `#agentUrl=&agentToken=` 打开时会自动保存地址和 token，无需手动填写。也可以在网页「配置 → 本地 Agent 连接」中手动填写。

## 打开模式

用户没有明确指定打开方式时，始终使用 `mode=new` 新建画布。只有用户明确要求时才替换为：

- 最近画布：`mode=recent`
- 自己选择：`mode=choose`

## 版本不匹配

画布页面与本地 Agent 的通信协议版本必须一致。如果页面提示 Agent 版本过旧或连接被拒绝，说明 npx 缓存或已安装的 canvas-agent 是旧版本：先结束旧进程，再用上面的 `@latest` 命令重启，并在画布页面硬刷新（Ctrl+Shift+R）后重新连接。
