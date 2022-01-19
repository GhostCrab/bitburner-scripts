import { allHosts, serverIsHackable, setns, canExecuteOnServer, cleanLogs } from "./util.js";
import { SuperHackEnv } from "./super_hack_env.js";

function calcIncome(ns, target, allHostnames, simMinutes = 2) {
    return new SuperHackEnv(ns, target, allHostnames.filter(canExecuteOnServer)).fastSim(ns, 1000 * 60 * simMinutes);
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    let allHostnames = allHosts();

    let orderedTargetArr = allHostnames
        .filter(serverIsHackable)
        .filter((x) => ns.getServerMaxMoney(x) > 1)
        .map((x) => [x, calcIncome(ns, x, allHostnames, ns.args[0])])
        .sort((a, b) => b[1] - a[1]);

    for (const [target, income] of orderedTargetArr) {
        ns.tprintf("%15s: %s/s", target, ns.nFormat(income, "($0.000a)"));
    }

    if (ns.args[1]) {

        let env = new SuperHackEnv(ns, orderedTargetArr[0][0], allHostnames.filter(canExecuteOnServer));
        //let env = new SuperHackEnv(ns, orderedTargetArr[0][0], ["home"])
        await env.init(ns);

        while (true) {
            env.refresh(ns);
            await ns.sleep(2000);
        }
    }
}
