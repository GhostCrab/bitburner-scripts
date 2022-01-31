import { allHosts, serverIsHackable, setns, canExecuteOnServer, cleanLogs } from "./util.js";
import { SmartHackEnv } from "./smart_hack_env.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    let env = new SmartHackEnv(ns, ns.args[1], ns.args[0]);
    await env.init(ns)

    while (true) {
        await env.refresh(ns);
    }
}
