import { allHosts, serverIsHackable, canExecuteOnServer, cleanLogs } from "./util.js";
import { SmartHackEnv } from "./smart_hack_env.js";

async function calcIncome(ns, target, hosts, simMinutes = 2) {
    return await new SmartHackEnv(ns, target, hosts).fastSim(ns, 1000 * 60 * simMinutes);
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    cleanLogs(ns);

    let allHostnames = allHosts(ns);
    let executableHosts = allHostnames.filter(canExecuteOnServer.bind(null, ns)).filter((x) => x.indexOf("hacknet-node") === -1);
    let targetArr = allHostnames.filter(serverIsHackable.bind(null, ns)).filter((x) => ns.getServerMaxMoney(x) > 1);

    let orderedTargetArr = [];
    for (const target of targetArr) {
        let income = await calcIncome(ns, target, executableHosts, ns.args[0]);
        orderedTargetArr.push([target, income]);
    }

    orderedTargetArr = orderedTargetArr.sort((a, b) => b[1] - a[1]);

    for (const [target, income] of orderedTargetArr) {
        ns.tprintf("%15s: %s/s", target, ns.nFormat(income, "($0.000a)"));
    }

    if (ns.args[1] === "check") {
        return;
    }

    let env = new SmartHackEnv(ns, orderedTargetArr[0][0], executableHosts);
    await env.init(ns);
    while (await env.refresh(ns));
}
