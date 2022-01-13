/** @type import("./index.d").NS */
let ns = null;

function serverIsHackable(hostName) {
    const server = ns.getServer(hostName);
    return server.hasAdminRights && ns.getHackingLevel() >= server.requiredHackingSkill;
}

function canExecuteOnServer(hostName) {
    const server = ns.getServer(hostName);
    return server.hasAdminRights;
}

function serverValueSort(h1, h2) {
    const s1 = ns.getServer(h1);
    const s2 = ns.getServer(h2);

    if (s1.moneyMax > s2.moneyMax) return -1;
    if (s1.moneyMax < s2.moneyMax) return 1;
    return 0;
}

function matchWeakenTarget(a, target) {
    let epsilon = 0.1;
    let targetMin = target - epsilon;
    let targetMax = target + epsilon;

    return a > targetMin && a < targetMax;
}

function assessHack(hostNames) {
    let hackableHosts = hostNames.filter(serverIsHackable).sort(serverValueSort);
    let hackRam = ns.getScriptRam("hack.js");
    let growRam = ns.getScriptRam("grow.js");
    let weakenRam = ns.getScriptRam("weaken.js");

    let fundThres = 0.9;
    let targetServer = ns.getServer(hackableHosts[0]);
    let targetFunds = targetServer.moneyMax * fundThres;
    let availableFunds = targetServer.moneyAvailable <= 1 ? 1 : targetServer.moneyAvailable;
    let growthRequired = targetFunds / availableFunds;
    let growThreadsNeeded = 0;
    if (growthRequired > 1) growThreadsNeeded = Math.ceil(ns.growthAnalyze(targetServer.hostname, growthRequired));

    let targetGrowTime = ns.getGrowTime(targetServer.hostname);
    let targetWeakenTime = ns.getWeakenTime(targetServer.hostname);

    ns.tprintf("%s:", targetServer.hostname);
    ns.tprintf(
        "  %25s: %s/%s [%2.0f%% | %s]",
        "Target Funds",
        ns.nFormat(targetServer.moneyAvailable, "($0.000a)"),
        ns.nFormat(targetFunds, "($0.000a)"),
        fundThres * 100,
        ns.nFormat(targetServer.moneyMax, "($0.000a)")
    );
    ns.tprintf("  %25s: %.2fx, %d Threads", "Growth Required", growthRequired, growThreadsNeeded);
    ns.tprintf("  %25s: %s @ %s", "Server Growth", targetServer.serverGrowth, ns.tFormat(targetGrowTime));
    ns.tprintf("  %25s: %s", "Weaken Time", ns.tFormat(targetWeakenTime));
    ns.tprintf(
        "  %25s: %s / %s / %s",
        "Hack Difficulty [M/B/H]",
        targetServer.minDifficulty,
        targetServer.baseDifficulty,
        targetServer.hackDifficulty
    );
    ns.tprintf("  %25s: %d/%d", "Ram Available", targetServer.maxRam - targetServer.ramUsed, targetServer.maxRam);
}

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    const hostSet = new Set(["home"]);
    let hostQueue = ["home"];
    let currentHost;
    while ((currentHost = hostQueue.shift())) {
        let newHosts = ns.scan(currentHost);

        for (const newHost of newHosts) {
            if (!hostSet.has(newHost)) {
                hostQueue.push(newHost);
                hostSet.add(newHost);
            }
        }
    }

    let hostNames = Array.from(hostSet);
    //assessHack(hostNames)

    let serverName = ns.args[0];
    let targetServer = ns.getServer(serverName);
    assessHack([targetServer.hostname]);
}
