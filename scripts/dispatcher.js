var debug = false;

function fltEq(a, b) {
    let epsilon = 0.05;
    return a > b - epsilon && a < b + epsilon;
}

/** @param {import("./index.d").NS } ns */
function doWeaken(ns, _hostname, _targetname, ramAllowance) {
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB

    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);
    let weakenThreads = Math.min(
        Math.ceil((target.hackDifficulty - target.minDifficulty) / weakenAmountPerThread),
        Math.floor(ramAllowance / weakenRam)
    );

    if (debug) {
        let tweaken = ns.getWeakenTime(target.hostname);
        let estSecLevelAfterWeaken = Math.max(
            target.minDifficulty,
            target.hackDifficulty - weakenThreads * weakenAmountPerThread
        );
        ns.tprintf("Weaken Process:");
        ns.tprintf(
            "  Lowering Security on %s from %.2f to %.2f with %d (%.2fGB) threads running on %s for %s",
            target.hostname,
            target.hackDifficulty,
            estSecLevelAfterWeaken,
            weakenThreads,
            weakenThreads * weakenRam,
            host.hostname,
            ns.tFormat(tweaken)
        );
    }

    ns.exec("weaken.js", host.hostname, weakenThreads, target.hostname);
}

/** @param {import("./index.d").NS } ns */
function doGrowAndWeaken(ns, _hostname, _targetname, ramAllowance, highMoney) {
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let growRam = ns.getScriptRam("grow.js"); // 1.75GB
    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB

    let currentMoney = Math.max(1.0, target.moneyAvailable);
    let targetGrowMult = highMoney / currentMoney;
    let fullGrowThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));
    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);
    let growThreads = fullGrowThreads + 1,
        weakenThreads,
        growRamCycle,
        growSecIncrease;

    do {
        growThreads -= 1;
        growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
        weakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
        growRamCycle = growThreads * growRam + weakenThreads * weakenRam;
    } while (growRamCycle > ramAllowance);

    if (debug) {
        let tweaken = ns.getWeakenTime(target.hostname);
        ns.tprintf("Grow Process:");
        ns.tprintf(
            "  Grow assuming low money is %s, multiplier from low money x%.8f",
            ns.nFormat(currentMoney, "($0.000a)"),
            targetGrowMult
        );
        ns.tprintf(
            "  Current Money: %s/%s; Target Money: %s (x%.2f); Running at %.0f%% of fullGrowThreads (%d/%d)",
            ns.nFormat(target.moneyAvailable, "($0.000a)"),
            ns.nFormat(target.moneyMax, "($0.000a)"),
            ns.nFormat(highMoney, "($0.000a)"),
            targetGrowMult,
            (growThreads / fullGrowThreads) * 100,
            growThreads,
            fullGrowThreads
        );
        ns.tprintf(
            "  Calling Grow with %d threads (%.2fGB) and Weaken with %d threads (%.2fGB); Total %.2fGB for %s",
            growThreads,
            growThreads * growRam,
            weakenThreads,
            weakenThreads * weakenRam,
            growRamCycle,
            ns.tFormat(tweaken)
        );
    }

    ns.exec("weaken.js", host.hostname, weakenThreads, target.hostname);
    ns.exec("grow.js", host.hostname, growThreads, target.hostname);
}

/** @param {import("./index.d").NS } ns */
function doHackAndWeaken(ns, _hostname, _targetname) {
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB
    let hackRam = ns.getScriptRam("hack.js"); // 1.70GB

    let fullHackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, target.moneyAvailable - lowMoney));
    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);
    let hackThreads = fullHackThreads + 1,
        weakenThreads,
        hackRamCycle;

    do {
        hackThreads -= 1;
        hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
        weakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
        hackRamCycle = hackThreads * hackRam + weakenThreads * weakenRam;
    } while (hackRamCycle > ramAllowance);

    if (debug) {
        let tweaken = ns.getWeakenTime(target.hostname);
        ns.tprintf("Hack Process:");
        ns.tprintf(
            "  Calling Hack with %d threads (%.2fGB) and Weaken with %d threads (%.2fGB); Total %.2fGB for %s",
            hackThreads,
            hackThreads * hackRam,
            weakenThreads,
            weakenThreads * weakenRam,
            hackRamCycle,
            ns.tFormat(tweaken)
        );
    }

    ns.exec("weaken.js", host.hostname, weakenThreads, target.hostname);
    ns.exec("hack.js", host.hostname, hackThreads, target.hostname);
}

/** @param {import("./index.d").NS } ns */
function doHGW(ns, _hostname, _targetname, highMoney, lowMoney, ramAllowance, tspacer) {
    /*//////////// ALGO ////////////
        if hackRamCycle is greater than ramAllowance
        brute - compute ramAllowance / hackRamCycle ratio and reduce targetHackAmount by that ratio
        while hackRamCycle > ramAllowance
        recompute everything up to hackRamCycle
        if hackRamCycle > ramAllowance
            reduce targetHackAmount by .1% of original targetHackAmount
    //////////////////////////////*/
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let growRam = ns.getScriptRam("grow.js"); // 1.75GB
    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB
    let hackRam = ns.getScriptRam("hack.js"); // 1.70GB

    let targetHackAmount = target.moneyAvailable - lowMoney;
    let targetHackAmountStep = targetHackAmount * 0.001;
    let hackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, targetHackAmount));
    let hackAmount = ns.hackAnalyze(target.hostname) * hackThreads * target.moneyAvailable;

    let targetGrowMult = highMoney / (target.moneyAvailable - hackAmount);
    let growThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));

    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);

    let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
    let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
    let hackWeakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
    let growWeakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
    let hackRamCycle =
        hackThreads * hackRam + growThreads * growRam + (hackWeakenThreads + growWeakenThreads) * weakenRam;

    if (debug) {
        ns.tprintf("Hack Process: ");
        ns.tprintf(
            "  Grow assuming low money is %s, multiplier from low money x%.8f",
            ns.nFormat(target.moneyAvailable - hackAmount, "($0.000a)"),
            targetGrowMult
        );
    }

    if (hackRamCycle > ramAllowance) {
        let failRatio = ramAllowance / hackRamCycle;
        targetHackAmount = Math.min(targetHackAmount * (failRatio * 1.1), targetHackAmount);
        if (debug)
            ns.tprintf("  ramAllowance / hackRamCycle = %.0f%% (%.0f%%)", failRatio * 100, failRatio * 1.1 * 100);
    }

    let cycles = 0;
    while (hackRamCycle > ramAllowance) {
        targetHackAmount -= targetHackAmountStep;
        hackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, targetHackAmount));
        hackAmount = ns.hackAnalyze(target.hostname) * hackThreads * target.moneyAvailable;

        targetGrowMult = highMoney / (target.moneyAvailable - hackAmount);
        growThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));

        hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
        growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
        hackWeakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
        growWeakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
        hackRamCycle =
            hackThreads * hackRam + growThreads * growRam + (hackWeakenThreads + growWeakenThreads) * weakenRam;
        cycles++;
    }

    if (debug) {
        let tweaken = ns.getWeakenTime(target.hostname);
        if (cycles > 0)
            ns.tprintf(
                "  targetHackAmount ratio: %.0f%%; Cycles: %d",
                (targetHackAmount / (target.moneyAvailable - lowMoney)) * 100,
                cycles
            );
        ns.tprintf(
            "  Calling Hack with %d threads (%.2fGB), Grow with %d threads (%.2fGB), and Weaken with %d/%d threads (%.2fGB); Total %.2fGB for %s",
            hackThreads,
            hackThreads * hackRam,
            growThreads,
            growThreads * growRam,
            hackWeakenThreads,
            growWeakenThreads,
            (hackWeakenThreads + growWeakenThreads) * weakenRam,
            hackRamCycle,
            ns.tFormat(tweaken)
        );
        ns.tprintf(
            "  Hack will increase security from %.2f to %.2f (%.5f per hack thread), weaken should decrease security level by %.2f",
            target.hackDifficulty,
            target.hackDifficulty + hackSecIncrease + growSecIncrease,
            ns.hackAnalyzeSecurity(1),
            weakenThreads * weakenAmountPerThread
        );
    }

    let tweaken = ns.getWeakenTime(target.hostname);
    let tgrow = ns.getGrowTime(target.hostname);
    let thack = ns.getHackTime(target.hostname);

    let tHackOffset = tweaken - thack - tspacer;
    let tGrowOffset = tweaken + tspacer - tgrow;
    let tGrowWeakenOffset = tspacer + tspacer;

    ns.exec("weaken.js", host.hostname, hackWeakenThreads, target.hostname, 0); // hack weaken, 0ms offset, finish 2nd
    ns.exec("weaken.js", host.hostname, growWeakenThreads, target.hostname, tGrowWeakenOffset); // grow weaken, --ms offset, finish 4th
    ns.exec("grow.js", host.hostname, growThreads, target.hostname, tGrowOffset); // --ms offset, finish 3rd
    ns.exec("hack.js", host.hostname, hackThreads, target.hostname, tHackOffset); // --ms offset, finish 1st
}

/** @param {import("./index.d").NS } ns */
function calcHGWThreads(ns, _hostname, _targetname, highMoney, lowMoney) {
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let targetHackAmount = target.moneyAvailable - lowMoney;
    let hackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, targetHackAmount));
    let hackAmount = ns.hackAnalyze(target.hostname) * hackThreads * target.moneyAvailable;

    let targetGrowMult = highMoney / (target.moneyAvailable - hackAmount);
    let growThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));

    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);

    let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
    let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
    let hackWeakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
    let growWeakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);

    return [hackWeakenThreads, growWeakenThreads, hackThreads, growThreads];
}

/** @param {import("./index.d").NS } ns */
function calcHGWThreadsSmart(ns, _hostname, _targetname, ramAllowance, tspacer) {
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let growRam = ns.getScriptRam("grow.js"); // 1.75GB
    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB
    let hackRam = ns.getScriptRam("hack.js"); // 1.70GB

    let targetHackAmount = target.moneyMax * 0.9;
    let targetHackAmountStep = targetHackAmount * 0.001;
    let hackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, targetHackAmount));
    let hackAmount = ns.hackAnalyze(target.hostname) * hackThreads * target.moneyAvailable;

    let targetGrowMult = target.moneyMax / (target.moneyMax - hackAmount);
    let growThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));

    let weakenAmountPerThread = ns.weakenAnalyze(1, host.cpuCores);

    let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
    let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
    let hackWeakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
    let growWeakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
    let hackRamCycle =
        hackThreads * hackRam + growThreads * growRam + (hackWeakenThreads + growWeakenThreads) * weakenRam;

    let tweaken = ns.getWeakenTime(target.hostname);
    let tweakenFullCycle = tweaken + tspacer * 3;
    let tCycleSpacer = tspacer * 4;
    let targetCycles = Math.floor(tweakenFullCycle / tCycleSpacer);
    let ramFit = Math.floor(ramAllowance / targetCycles);

    // dont force a cycle into less than 16GB
    while (ramFit < 16) {
        targetCycles--;
        ramFit = Math.floor(ramAllowance / targetCycles);
    }

    if (hackRamCycle > ramFit) {
        let crunchRatio = ramFit / hackRamCycle;
        targetHackAmount = Math.min(targetHackAmount * (crunchRatio * 1.1), targetHackAmount);
        if (debug) ns.tprintf("  ramFit / hackRamCycle = %.0f%% (%.0f%%)", crunchRatio * 100, crunchRatio * 1.1 * 100);
    }

    while (hackRamCycle > ramFit) {
        targetHackAmount -= targetHackAmountStep;
        hackThreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, targetHackAmount));
        hackAmount = ns.hackAnalyze(target.hostname) * hackThreads * target.moneyAvailable;

        targetGrowMult = target.moneyMax / (target.moneyMax - hackAmount);
        let dobreak = false;
        if (targetGrowMult < 1) {
            targetGrowMult = 1.0000001;
            dobreak = true;
        }

        growThreads = Math.ceil(ns.growthAnalyze(target.hostname, targetGrowMult, host.cpuCores));

        hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
        growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
        hackWeakenThreads = Math.ceil(hackSecIncrease / weakenAmountPerThread);
        growWeakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
        hackRamCycle =
            hackThreads * hackRam + growThreads * growRam + (hackWeakenThreads + growWeakenThreads) * weakenRam;

        if (dobreak) break;
    }

    //if (debug) {
    ns.tprintf(
        "  Calling Hack (%.4f%% of Max) with %d threads (%.2fGB), Grow with %d threads (%.2fGB), and Weaken with %d/%d threads (%.2fGB); Total %.2fGB for %s over %d Cycles",
        (hackAmount / target.moneyMax) * 100,
        hackThreads,
        hackThreads * hackRam,
        growThreads,
        growThreads * growRam,
        hackWeakenThreads,
        growWeakenThreads,
        (hackWeakenThreads + growWeakenThreads) * weakenRam,
        hackRamCycle,
        ns.tFormat(tweaken),
        targetCycles
    );
    //}

    return [targetCycles, hackWeakenThreads, growWeakenThreads, hackThreads, growThreads];
}

/** @param {import("./index.d").NS } ns */
function launchHGW(
    ns,
    hostname,
    targetname,
    tspacer,
    tag,
    hackWeakenThreads,
    growWeakenThreads,
    hackThreads,
    growThreads
) {
    let tweaken = ns.getWeakenTime(targetname);
    let tgrow = ns.getGrowTime(targetname);
    let thack = ns.getHackTime(targetname);

    let tHackOffset = tweaken - thack - tspacer;
    let tGrowOffset = tweaken + tspacer - tgrow;
    let tGrowWeakenOffset = tspacer + tspacer;

    ns.exec("weaken.js", hostname, hackWeakenThreads, targetname, 0, tag); // hack weaken, 0ms offset, finish 2nd
    ns.exec("weaken.js", hostname, growWeakenThreads, targetname, tGrowWeakenOffset, tag); // grow weaken, --ms offset, finish 4th
    ns.exec("grow.js", hostname, growThreads, targetname, tGrowOffset, tag); // --ms offset, finish 3rd
    ns.exec("hack.js", hostname, hackThreads, targetname, tHackOffset, tag); // --ms offset, finish 1st
}

//** @param {NS} ns **/
/** @param {import("./index.d").NS } ns */
export async function main(ns) {
    let ramOverride = ns.args[1];
    let _hostname = ns.getHostname();
    let _targetname = ns.args[0];
    if (!_targetname) _targetname = "lexo-corp";
    let host = ns.getServer(_hostname);
    let target = ns.getServer(_targetname);

    let lowThresholdFactor = 0.94;
    let highThresholdFactor = 1;
    let lowMoney = target.moneyMax * lowThresholdFactor;
    let highMoney = target.moneyMax * highThresholdFactor;

    if (!ns.fileExists("grow.js", host.hostname)) await ns.scp("grow.js", "home", host.hostname);
    if (!ns.fileExists("weaken.js", host.hostname)) await ns.scp("weaken.js", "home", host.hostname);
    if (!ns.fileExists("hack.js", host.hostname)) await ns.scp("hack.js", "home", host.hostname);

    let growRam = ns.getScriptRam("grow.js"); // 1.75GB
    let weakenRam = ns.getScriptRam("weaken.js"); // 1.75GB
    let hackRam = ns.getScriptRam("hack.js"); // 1.70GB

    let ramAllowance = host.maxRam - host.ramUsed;
    //if (host.hostname === "home") ramAllowance -= 48;

    if (ramOverride) {
        if (ramOverride < 1) {
            let ramFraction = Math.floor(ramAllowance * ramOverride * 100) / 100.0;
            if (debug)
                ns.tprintf(
                    "Overriding availble host RAM max to %.2f (%.2f%% of %.2f)",
                    ramFraction,
                    ramOverride,
                    ramAllowance
                );
            ramAllowance = ramFraction;
        } else {
            if (debug) ns.tprintf("Overriding availble host RAM max to %.2f", ramOverride);
            ramAllowance = Math.min(ramOverride, ramAllowance);
        }
    }

    if (debug) ns.tprintf("INFO: Availble host RAM %.2f", ramAllowance);

    // Weaken to minimum security
    target = ns.getServer(target.hostname);
    while (target.hackDifficulty > target.minDifficulty) {
        doWeaken(ns, host.hostname, target.hostname, ramAllowance);
        while (ns.isRunning("weaken.js", host.hostname, target.hostname)) await ns.sleep(500);

        if (debug) {
            let oldHackDifficulty = target.hackDifficulty;
            target = ns.getServer(target.hostname);
            ns.tprintf("  Lowered Security from %.2f to %.2f", oldHackDifficulty, target.hackDifficulty);
        } else {
            target = ns.getServer(target.hostname);
        }
    }

    // Grow to high threshold money
    target = ns.getServer(target.hostname);
    while (target.moneyAvailable < highMoney) {
        doGrowAndWeaken(ns, host.hostname, target.hostname, ramAllowance, highMoney);
        while (ns.isRunning("weaken.js", host.hostname, target.hostname)) await ns.sleep(500);

        if (debug) {
            let oldMoney = target.moneyAvailable;
            target = ns.getServer(target.hostname);
            ns.tprintf(
                "  Increased %s available money from %s to %s (%.2f%% of Max); Current Security: %.2f (min: %.2f)",
                target.hostname,
                ns.nFormat(oldMoney, "($0.000a)"),
                ns.nFormat(target.moneyAvailable, "($0.000a)"),
                (target.moneyAvailable / target.moneyMax) * 100,
                target.hackDifficulty,
                target.minDifficulty
            );
        } else {
            target = ns.getServer(target.hostname);
        }
    }

    // Hack the world
    let tspacer = 200;
    let tCycleSpacer = tspacer * 4;
    let tweaken = ns.getWeakenTime(target.hostname);
    let tweakenFullCycle = tweaken + tspacer * 3;
    let hgwCycles, hackWeakenThreads, growWeakenThreads, hackThreads, growThreads;
    [hgwCycles, hackWeakenThreads, growWeakenThreads, hackThreads, growThreads] = calcHGWThreadsSmart(
        ns,
        host.hostname,
        target.hostname,
        ramAllowance,
        tspacer
    );
    while (true) {
        for (let i = 0; i < hgwCycles; i++) {
            if (i !== 0) await ns.sleep(tCycleSpacer);
            launchHGW(
                ns,
                host.hostname,
                target.hostname,
                tspacer,
                i,
                hackWeakenThreads,
                growWeakenThreads,
                hackThreads,
                growThreads
            );
        }

        let sleepTimer = tweakenFullCycle - hgwCycles * tCycleSpacer + tCycleSpacer;
        if (sleepTimer > 0) await ns.sleep(sleepTimer);

        // while (ns.isRunning("weaken.js", host.hostname, target.hostname, 400, "9")) {
        //     await ns.sleep(50)
        //     if (debug) {
        //         let oldMoney = target.moneyAvailable
        //         let oldSec = target.hackDifficulty
        //         target = ns.getServer(target.hostname)

        //         if (oldMoney != target.moneyAvailable)
        //             ns.tprintf("  Hack: %s available money changed from %s to %s (%.2f%% of Max)",
        //                 target.hostname, ns.nFormat(oldMoney, '($0.000a)'), ns.nFormat(target.moneyAvailable, '($0.000a)'), (target.moneyAvailable / target.moneyMax) * 100)

        //         if (oldSec != target.hackDifficulty)
        //             ns.tprintf("  Hack: %s security changed from %.2f to %.2f (min: %.2f)",
        //                 target.hostname, oldSec, target.hackDifficulty, target.minDifficulty)
        //     }
        // }
    }
}
