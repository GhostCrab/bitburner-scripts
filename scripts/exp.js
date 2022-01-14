import { setns, cleanLogs } from "./util.js";
import { SuperHackEnv } from "./super_hack_env.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    // do full weaken

    // Find out how much money I can gain back in a single GW cycle and never hack more than that

    let hackScript = "hack.js";
    let weakenScript = "weaken.js";
    let targetname = "n00dles";
    let hostname = "home";
    let hostRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    if (hostname === "home") {
        hostRam -= 64;
    }
    let hostCores = ns.getServer(hostname).cores;
    let hackRam = ns.getScriptRam(hackScript);
    let weakenRam = ns.getScriptRam(weakenScript);
    let startTime = ns.getTimeSinceLastAug();

    while (ns.getServerSecurityLevel(targetname) - 0.1 > ns.getServerMinSecurityLevel(targetname)) {
        while (ns.scriptRunning(weakenScript, hostname)) {
            await ns.sleep(20);
        }

        let weakenThreads = Math.floor(hostRam / weakenRam);
        ns.exec(weakenScript, hostname, weakenThreads, targetname);
        let curTime = ns.getTimeSinceLastAug() - startTime;
        ns.print(`${curTime}: Weakening on ${weakenThreads} threads`);
    }

    while (true) {
        while (ns.scriptRunning(weakenScript, hostname)) {
            await ns.sleep(20);
        }

        // Hack Info
        let hackThreads = Math.floor(hostRam / hackRam);
        let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);

        // Weaken Info
        let weakenAmountPerThread = ns.weakenAnalyze(1, hostCores);
        let weakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);

        let hackRamCycle = hackThreads * hackRam + weakenThreads * weakenRam;

        while (hackRamCycle > hostRam) {
            hackThreads--;
            hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
            weakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
            hackRamCycle = hackThreads * hackRam + weakenThreads * weakenRam;
        }

        ns.exec(weakenScript, hostname, weakenThreads, targetname);
        ns.exec(hackScript, hostname, hackThreads, targetname);
        let curTime = ns.getTimeSinceLastAug() - startTime;
        ns.print(`${curTime}: Hacking on ${hackThreads}/${weakenThreads} threads`);
    }
}
