import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_PORT = 17371;
export const CONFIG_DIR = path.join(os.homedir(), ".infinite-canvas");
export const CONFIG_FILE = path.join(CONFIG_DIR, "canvas-agent.json");
export const VERSION = readPackageVersion();
export const AGENT_PROMPT = fs.readFileSync(new URL("../agent-instructions.md", import.meta.url), "utf8");

export type CanvasAgentConfig = { url: string; origins?: string[] };

/** 读取本地 Canvas Agent 配置，不存在时生成默认配置。 */
export function loadConfig(create = false): CanvasAgentConfig {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as CanvasAgentConfig;
    } catch {
        const config = { url: `http://127.0.0.1:${Number(process.env.PORT) || DEFAULT_PORT}` };
        if (create) saveConfig(config);
        return config;
    }
}

/** 将 Canvas Agent 配置写入用户配置目录。 */
export function saveConfig(config: CanvasAgentConfig) {
    writeConfigFile(CONFIG_DIR, CONFIG_FILE, config);
}

/** 服务单实例锁：Windows 允许重复绑定同一端口，用锁文件避免两个实例抢浏览器连接；锁残留但进程已死时自动清理。 */
export function acquireInstanceLock(): boolean {
    const lockFile = `${CONFIG_FILE}.lock`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            fs.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
            return true;
        } catch {
            const pid = Number(fs.readFileSync(lockFile, "utf8"));
            let alive = false;
            if (pid > 0 && pid !== process.pid) {
                try {
                    process.kill(pid, 0);
                    alive = true;
                } catch {
                    // pid 不再存在，锁为陈旧残留。
                }
            }
            if (alive) return false;
            try {
                fs.unlinkSync(lockFile);
            } catch {
                // 无残留可清理。
            }
        }
    }
    return false;
}

/** 写入配置并强制目录 0700、文件 0600，包括纠正已有宽松权限。 */
export function writeConfigFile(dir: string, file: string, config: CanvasAgentConfig) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.chmodSync(dir, 0o700);
    fs.chmodSync(file, 0o600);
}

/** 从当前包信息中读取 Canvas Agent 版本号。 */
function readPackageVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
        return pkg.version || "0.0.0";
    } catch {
        return "0.0.0";
    }
}
