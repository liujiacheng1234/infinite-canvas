import type { CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { resolveImageUrl } from "@/services/image-storage";

const MAX_EDGE = 1024;

/** 读取图片节点的一张图片，最长边缩放到 1024 后转 base64，作为 MCP 结果的 image 字段返回。 */
export async function readCanvasNodeImage(snapshot: CanvasAgentSnapshot, input: { nodeId?: string; imageId?: string }) {
    const node = snapshot.nodes.find((item) => item.id === input.nodeId);
    if (!node) throw new Error(`图片节点不存在：${input.nodeId}`);
    const images = node.metadata?.images || [];
    if (!images.length) throw new Error(`节点“${node.title}”没有可读取的图片`);
    const imageId = input.imageId || node.metadata?.primaryImageId || images[0].id;
    const image = images.find((item) => item.id === imageId);
    if (!image) throw new Error(`图片不存在：${imageId}`);
    if (image.status === "loading") throw new Error(`图片“${image.id}”仍在生成中`);
    const url = await resolveImageUrl(image.storageKey);
    if (!url) throw new Error(`图片“${image.id}”内容缺失`);
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const scale = Math.min(1, MAX_EDGE / bitmap.width, MAX_EDGE / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片读取失败");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const mimeType = image.mimeType === "image/png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mimeType, 0.85);
    return {
        node: { id: node.id, title: node.title },
        imageId: image.id,
        image: { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType, width, height },
    };
}
