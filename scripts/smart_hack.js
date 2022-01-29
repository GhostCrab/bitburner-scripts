import { allHosts, serverIsHackable, setns, canExecuteOnServer, cleanLogs } from "./util.js";
import { SmartHackEnv } from "./smart_hack_env.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    let env = new SmartHackEnv(ns, "phantasy", "home");

    await env.refresh(ns);
}
