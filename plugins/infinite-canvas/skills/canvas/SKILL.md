---
name: canvas
description: 操作 Infinite Canvas 当前网页画布，读取节点、选区、创建文本节点、创建生成流程、连接节点或触发生成。
---

# Infinite Canvas

你正在帮助用户操作 Infinite Canvas 网页画布。需要理解或改动画布时，优先使用已配置的 `infinite-canvas` MCP 工具；不要让用户手动复制 JSON、URL 或 token。

## 读取画布

- 读取分三层：先用 `canvas_get_state` 拿结构概览（表头行文本，节点 id 为短引用 n1、n2…）；需要某个节点的提示词、生成参数或文本全文时，用 `canvas_get_nodes` 按 id 定点读取（可传 1~20 个 id，返回结果附带上下游邻居）；需要看图片内容（评判生成效果、参考风格）时用 `canvas_read_image`，一次只读一张。
- 画布结构没有变化时不要重复调用 `canvas_get_state`；写入工具的回执已经包含结果，不要靠重新读取来确认写入是否成功。
- 节点元数据里的图片相关字段只有提示词和状态，不含图像数据；判断图片效果必须用 `canvas_read_image`。

## 引用节点

- 所有工具的节点入参直接使用 `canvas_get_state` 或写入回执里返回的短引用（n1、n2…）；真实节点 id 同样可用。
- 提示词里引用其他节点时写 `@[node:短引用]`，会被自动改写为真实引用并连线。
- 如果用户明确提到选中内容或"这个"，先用 `canvas_get_selection`。

## 修改画布

- 创建单个文本内容优先用 `canvas_create_text_node`。
- 创建生成内容优先用 `canvas_generate_text`、`canvas_generate_image`、`canvas_generate_video`、`canvas_generate_audio`。
- 需要把提示词、配置和生成节点串成流程时，使用 `canvas_create_generation_flow`。
- 需要批量增删改、移动、连接节点或设置视口时，使用 `canvas_apply_ops`；ops 按顺序执行。
- 删除节点或改动连线前，先用 `canvas_get_nodes` 查看该节点的上下游邻居，评估影响。
- 写入工具返回执行回执：每个 op 的成功/失败/原因、新建节点的短引用 id、被断开的连线，不再返回全量快照；需要看最新结构时再调 `canvas_get_state`，需要看内容时用 `canvas_get_nodes`。
- 回执 `note` 为"连线已存在"表示重复连线被跳过，按成功处理即可。
- 不要模拟鼠标点击，不要要求用户手动复制 JSON。
- 写入画布的操作会由网页侧边栏做二次确认，按当前工具结果继续推进即可。

## 风格

- 页面文案和画布节点内容默认使用中文。
- 生成节点、配置节点和提示词节点要保持结构清晰，方便用户继续编辑。
- 批量创建节点时注意给节点留出间距，不要堆叠在同一个位置。
- 图片、视频、音频等媒体节点默认保留原始比例；只有用户明确要求自由变形时才改变比例。
- 生成流程尽量少而清楚，优先让用户一眼能看懂节点关系。
