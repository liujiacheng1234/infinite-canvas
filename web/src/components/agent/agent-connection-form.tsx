import { useState } from "react";
import { Button, Input } from "antd";
import { PlugZap, Unplug } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAgentStore } from "@/stores/use-agent-store";

/** 本地 Agent 连接表单：地址与 token 输入、连接/断开、实时状态；配置页卡片与画布顶栏 Popover 共用。 */
export function AgentConnectionForm({ className = "" }: { className?: string }) {
    const { t } = useTranslation();
    const url = useAgentStore((state) => state.url);
    const token = useAgentStore((state) => state.token);
    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const activity = useAgentStore((state) => state.activity);
    const connectError = useAgentStore((state) => state.connectError);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const disconnectAgent = useAgentStore((state) => state.disconnectAgent);
    const [draftUrl, setDraftUrl] = useState(url);
    const [draftToken, setDraftToken] = useState(token);
    const statusColor = connected ? "#16a34a" : enabled ? "#d97706" : undefined;
    const dotColor = connected ? "#22c55e" : enabled ? "#f59e0b" : "#a8a29e";
    const statusText = connected || enabled ? activity : t("agent.status.disconnected");

    const connect = () => {
        setAgentState({ url: draftUrl.trim(), token: draftToken.trim() });
        connectAgent();
    };

    return (
        <div className={className}>
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5" style={{ color: statusColor }}>
                    <span className="size-2 rounded-full" style={{ background: dotColor }} />
                    {statusText}
                </span>
                {connectError ? <span className="truncate text-red-500">{connectError}</span> : null}
            </div>
            <label className="mt-2 block">
                <span className="mb-1 block text-xs text-stone-500">{t("agent.connection.url")}</span>
                <Input size="small" value={draftUrl} placeholder="http://127.0.0.1:17371" onChange={(event) => setDraftUrl(event.target.value)} />
            </label>
            <label className="mt-2 block">
                <span className="mb-1 block text-xs text-stone-500">{t("agent.connection.token")}</span>
                <Input.Password size="small" value={draftToken} placeholder="Connect token" onChange={(event) => setDraftToken(event.target.value)} />
            </label>
            <div className="mt-3 flex items-center gap-2">
                <Button size="small" type="primary" icon={<PlugZap className="size-3.5" />} onClick={connect}>
                    {t("agent.connection.connect")}
                </Button>
                <Button size="small" icon={<Unplug className="size-3.5" />} disabled={!enabled} onClick={() => disconnectAgent()}>
                    {t("agent.connection.disconnect")}
                </Button>
            </div>
        </div>
    );
}
