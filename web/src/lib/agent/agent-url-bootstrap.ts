export function hasAgentUrlBootstrap(hash: string) {
    return new URLSearchParams(hash.replace(/^#/, "")).has("agentUrl");
}

export function readAgentUrlBootstrap(hash: string) {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (!params.has("agentUrl")) return null;
    const url = params.get("agentUrl")?.trim() || "";
    params.delete("agentUrl");
    const remaining = params.toString();
    return { url, remainingHash: remaining ? `#${remaining}` : "" };
}
