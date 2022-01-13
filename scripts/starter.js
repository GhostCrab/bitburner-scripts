import { allHosts, canExecuteOnServer, serverIsHackable, serverMaxMoneySortDesc, setns, softenServer } from "./util.js";

/** @type import(".").NS */
export async function main(ns) {
    setns(ns);

    let hostnames = allHosts();
    for (const hostname of hostnames) {
        softenServer(hostname);
    }

    let hackableHosts = hostnames
        .filter(serverIsHackable)
        .filter((hostname) => ns.getServerMaxMoney(hostname) > 0)
        .sort(serverMaxMoneySortDesc);
    let rootHostsNoPurchased = hostnames
        .filter(canExecuteOnServer)
        .filter((hostname) => (hostname.indexOf("pserv") === -1 && hostname !== "home"));
    let hackMeRam = ns.getScriptRam("hack_me.js", "home");

    let roundRobin = 0;
    for (const hostname of rootHostsNoPurchased) {
        let execMaxArgs = ["hack_me.js", hostname, hackableHosts[roundRobin % hackableHosts.length]];
        ns.tprintf("%s %s %s", "exec_maxjns", "home", execMaxArgs.toString());

        while (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") < ns.getScriptRam("exec_max.js"))
            await ns.sleep(500);

        ns.exec("exec_maxjns", "home", 1, ...execMaxArgs);
        roundRobin += 1;
    }

    let homeRam = ns.getServerMaxRam("home") - 64;
    let ramSlice = homeRam / hackableHosts.length;
    let hackMeHomeThreads = Math.floor(ramSlice / hackMeRam);

    if (hackMeHomeThreads <= 0) return;
    for (const hostName of hackableHosts) {
        ns.exec("hack_me.js", "home", 1, hostName, ramSlice);
    }
}