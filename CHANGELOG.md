# CHANGELOG

## Unreleased

本段记录本 fork 独立演进后的全部改动，最早一条为「移除未使用的 `@ant-design/pro-components` 依赖」；上游的未发布条目与历史版本记录在本段之后，仅作参考。

+ [调整] 文档与门面对齐独立项目：重写 README（新增「相对上游的主要变化」小节），文档站移除上游 logo/图标、在线体验与 QQ 链接及旧 UI 截图，GitHub 链接与贡献者/Star History 改为指向本仓库，清理原作者安全报告邮箱与无引用的赞助商图片，MCP 接入文档统一为本地构建方式。

+ [新增] 配置页新增「本地 Agent 连接」卡片：填写地址与 token、连接/断开、实时查看连接状态；画布顶栏状态点可点击展开连接表单，画布页内即可修改连接配置。恢复 `skills/` 下的 canvas、open-canvas skill 文档，内容对齐仅保留 MCP 后的现状。

+ [调整] 移除内置 Codex 与网页右侧对话面板：canvas-agent 仅保留 MCP 桥接能力（HTTP 服务 + stdio MCP），删除 Codex/Claude 适配器、Skills 存储与附件工具 `canvas_create_attachment_nodes`；网页端改为启动时自动静默连接本地 Agent 并在后台执行 MCP 工具调用，相关 Codex 插件文档与规划文档一并移除。

+ [修复] Canvas Agent `generation_get_status` 的 `nodeIds` 现与画布工具入参一致接受节点短引用（n1、n2…），转发前统一解析为真实节点 id。

+ [优化] 画布大节点/连线数量下的拖拽与缩放性能：面板渲染回调改读 refs、`@` 引用与连接节点改为按需计算、滚轮缩放加 rAF 节流、左侧元素列表延迟渲染，拖拽时不再全量重渲染所有可见节点。
+ [优化] 缩放/平移不再重渲染任何节点：节点 scale 改为稳定 getScale 读取（仅拉伸手柄时取实时值）、连线 ConnectionPath 改 memo 化稳定回调、节点层加 will-change 提升为合成层、小地图节点矩形延迟渲染。
+ [优化] 画布状态架构重构：节点/连线/选区/视口迁移到独立 world store 分片订阅，拖拽与缩放帧不再重渲染页面本体；Agent 快照改防抖推送，历史/自动保存改订阅驱动，操作签名保持兼容。
+ [修复] Canvas Agent `canvas_update_node_text` 对非文本节点只更新标题，不再覆盖图片、视频等节点的 metadata.content 媒体地址。
+ [修复] 图片参考链读取优先使用 IndexedDB 的 storageKey 原图，dataUrl/url 仅作回退，避免内容字段被污染后拿到坏地址。
+ [修复] Canvas Agent `canvas_read_image` 服务端缺少透传分支，工具声明后运行时始终报「未知工具」；现转发至页面执行（页面读图实现早已就绪：读 IndexedDB → 降采样 1024 → base64，经 MCP 层包装为 image content），Agent 看图与图片落盘验证链路恢复。
+ [调整] Codex 插件 canvas 技能改为分层读取（概览→节点全文→看图）、短引用和执行回执的新指引，open-canvas 技能与插件 MCP 命令统一加 `@latest` 并补充版本不匹配排查。
+ [新增] Canvas Agent 节点 id 改用稳定短引用（n1、n2…）：概览/回执/邻居全部输出短引用，所有工具入参短引用与真实 id 均可，prompt 中的 @[node:短引用] 自动改写，150 节点画布概览再省约 1K token 且缩短 Agent 输出。
+ [优化] Canvas Agent 画布概览改用表头行文本返回（连线用节点行号引用、status 空值省略），`canvas_get_nodes` 剔除 storageKey/bytes/mimeType 并对重复的 prompt 去重，大幅降低大画布下的返回 token。
+ [新增] Canvas Agent 新增 `canvas_get_nodes` 和 `canvas_read_image` 工具：按 id 读取节点完整 metadata 和上下游邻居，按需读取一张图片内容；Agent 首次具备读全文和看图能力。
+ [新增] Canvas Agent 新增 `canvas_disconnect_nodes` 工具，按 from/to 断开节点连线。
+ [调整] 画布写入工具统一返回执行回执（每个 op 的成功/失败/原因、新建节点 id、被断开的连线），不再返回全量快照，避免大画布下上下文爆炸，也让 Agent 能立即发现失败的操作。
+ [调整] `canvas_get_state` 改为纯结构概览（含节点状态和图片摘要），不再携带节点内容；移除与读状态重复的 `canvas_export_snapshot` 工具。
+ [修复] 移除未使用的 `@ant-design/pro-components` 依赖，npm 安装不再因 antd 6 peer 依赖冲突失败。

## 上游遗留（fork 前的未发布条目）

以下条目来自上游 basketikun/infinite-canvas 未发布的变更，仅供对照历史，不再是本项目的维护范围。

+ [修复] 文档站默认英文路径不再因内部语言重写产生重定向循环。
+ [优化] 文档站移动端折叠菜单新增分类切换入口，桌面端增加随滚动高亮的本页目录。
+ [优化] 画布左侧元素列表按组展示树形层级，组内节点支持展开和收起。
+ [优化] Canvas Agent 生成流程复用仅由现有节点引用构成的提示词，避免创建重复文本节点。
+ [新增] 节点输入框上方新增参考内容栏，可预览、移除或从画布连续选择参考节点；组引用会展开组内全部内容，移除任一项即断开整组。
+ [新增] 视频节点右键菜单支持截取首帧、尾帧和当前帧并生成图片节点，方便衔接连续镜头。
+ [调整] 移除文本节点右上角的生图按钮，让正文区域保持简洁完整。
+ [调整] 多次文本生成合并为单个文本节点，其他结果作为可展开切换的备选文本。
+ [新增] 组节点可作为生成输入并通过单条连线或 `@` 一次性引用组内全部有效资源。
+ [修复] 透明图片在多图备选展开时保持透明背景，不再显示白色卡片底色。
+ [修复] Canvas Agent 转发 CLI 错误日志前脱敏常见凭据，避免调试日志和浏览器事件流泄露密钥。
+ [修复] Canvas Agent 配置目录和配置文件收紧访问权限，降低本地连接 Token 被其他系统用户读取的风险。
+ [修复] Canvas Agent 自动连接凭据改用 URL fragment 传递并在读取后立即清除，避免 Token 进入服务器日志、Referer 和浏览器历史。
+ [修复] GPT Image 模型请求不再发送不受支持的 `response_format` 参数。
+ [修复] 图片接口返回临时外链时统一下载、校验并本地保存，支持取消下载，跨域无法读取时保留可显示的原链接。

## v0.16.0