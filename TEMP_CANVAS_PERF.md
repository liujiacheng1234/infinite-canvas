# 画布性能优化临时笔记

> 临时文档：记录"节点/连线多时画布卡顿"的诊断结论和优化梯队。优化完成、测试通过后可删除或归档。

## 现象

画布节点和连线数量多时，拖拽、缩放明显卡顿。

## 诊断结论（按影响排序）

画布是纯 DOM 渲染（React div + SVG 连线）。卡顿根源不是 DOM 本身，而是**高频路径打破了 `CanvasNode` 的 `React.memo`**，导致拖一个节点 / 缩放一下，所有可见节点全部重渲染。

### 1. `renderNodePanel` / `renderNodeContentPanel` 每帧换新引用（最大头）

- 位置：`web/src/pages/canvas/project.tsx`
- 两个 `useCallback` 依赖包含 `nodes`、`configInputsById`、`mentionReferencesByNodeId`、`runningNodeId` 等。
- 拖拽时每帧 `setNodes` → 依赖全部重建 → 所有 `CanvasNode` 的 `renderPanel` prop 变化 → memo 全破，每帧全量重渲染所有可见节点（每节点 20+ DOM 元素）。

### 2. `mentionReferencesByNodeId` 每帧全量重建，O(n²)

- 位置：`web/src/pages/canvas/project.tsx`
- 对每个节点调 `buildNodeMentionReferences`（内部扫描全部 nodes + connections）。
- 每个节点拿到的是新数组，作为 prop 传入 `CanvasNode`，即使 callback 稳定也会打破 memo。
- `configInputsById`、`connectedNodesByNodeId` 同理每帧重建。

### 3. 滚轮缩放没有 rAF 节流

- 位置：`web/src/components/canvas/infinite-canvas.tsx` 的 `handleWheel`
- 每个 wheel 事件直接 `setViewport`（触控板每秒 60+ 次），`scale` 是 `CanvasNode` 的 prop，缩放时所有节点每帧重渲染。
- 对比：平移（pan）已做 rAF 节流。

### 4. `CanvasSidePanel` 每帧重渲染

- 位置：`web/src/components/canvas/canvas-side-panel.tsx`
- 未包 `memo`，接收 `nodes` prop，拖拽期间每帧重算整个列表。

### 5. 每帧重复的派生计算

- 每次 `nodes` 变化，`nodeById`、`groupChildCountById`、`relatedHighlight`、`mentionReferencesByNodeId` 等 Map/Set 全部重建，叠加产生大量垃圾和 CPU。

## 优化梯队

### 第一梯队（低风险，已完成）

1. 稳定 `renderNodePanel`/`renderNodeContentPanel`：内部改从 `nodesRef` 和 ref 版派生数据读取，依赖清空，拖拽时节点 memo 不再被打破。
2. `mentionReferences` 按需计算：只有打开面板的节点和正在编辑的文本节点需要，其余传稳定 `EMPTY_REFERENCES`；`configInputsById`/`connectedNodesByNodeId` 只为需要的节点计算。
3. 滚轮缩放加 rAF 节流（照抄 pan 的写法）。
4. `CanvasSidePanel` 包 `memo`，收起时不渲染列表。

### 第二梯队（已完成）

5. `scale` 改为稳定的 `getScale()` 读取（resize 时才取实时值），缩放/平移完全不触发节点重渲染；插件 `ctx.scale` 在节点重渲染时取值，当前无插件消费该字段。
6. `ConnectionPath` 包 memo + 稳定回调（带 connection id），拖拽时只重渲染端点变化的连线。

附加：

- 节点层容器加 `will-change: transform`，平移/缩放走 GPU 合成，不再逐帧重绘整个画布层。
- 小地图节点矩形拆为 memo 组件 + `useDeferredValue`，拖拽期间静止、结束后同步。

### 第三梯队（架构级，暂不动）

7. 节点数据迁移到 zustand 分片订阅（每节点只订阅自身数据），视口变换直接写 style，即 React Flow 的模型。效果好但改动大。

## 验证方式

本地打开包含大量节点 + 连线的画布，对比优化前后：拖拽节点、框选、滚轮缩放、悬停节点的流畅度（可通过 React DevTools Profiler 或 Performance 面板确认拖拽期间不再全量重渲染）。
