import { useTranslation } from "react-i18next";

import { AgentConnectionForm } from "@/components/agent/agent-connection-form";

/** 配置页的本地 Agent 连接卡片：填写地址与 token，查看 MCP 桥接的连接状态。 */
export function AgentConnectionCard() {
    const { t } = useTranslation();

    return (
        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{t("agent.connection.title")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("agent.connection.description")}</p>
            <AgentConnectionForm className="mt-4 max-w-xl" />
        </section>
    );
}
