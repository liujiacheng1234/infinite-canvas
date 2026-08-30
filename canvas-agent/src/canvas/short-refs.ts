import type { CanvasNode } from "./types.js";

/** 为画布节点分配稳定短引用（n1、n2…），Agent 输入短引用或真实 id 均可，真实 id 始终原样透传。 */
export class ShortIdRegistry {
    private projectId = "";
    private realToShort = new Map<string, string>();
    private shortToReal = new Map<string, string>();
    private next = 1;

    /** 画布切换时重置映射，并为新出现的节点分配短引用。 */
    ensure(projectId: string, nodes: CanvasNode[]) {
        if (this.projectId !== projectId) {
            this.projectId = projectId;
            this.realToShort.clear();
            this.shortToReal.clear();
            this.next = 1;
        }
        nodes.forEach((node) => this.register(node.id));
    }

    /** 为真实 id 分配稳定短引用；删除节点后编号不回收，保证引用稳定。 */
    register(realId: string) {
        const existing = this.realToShort.get(realId);
        if (existing) return existing;
        let short = "";
        do {
            short = `n${this.next++}`;
        } while (this.shortToReal.has(short));
        this.realToShort.set(realId, short);
        this.shortToReal.set(short, realId);
        return short;
    }

    /** 短引用转真实 id；非短引用原样返回。 */
    resolve(id: string) {
        return this.shortToReal.get(id) ?? id;
    }

    /** 真实 id 转短引用；未登记的先登记。 */
    shorten(realId: string) {
        return this.register(realId);
    }
}
