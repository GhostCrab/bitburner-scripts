import { setns, cleanLogs } from "./util.js";
import { SuperHackEnv } from "./super_hack_env.js";
/*
10:55:55: Attacking hong-fang-tea (Hacking EXP: 9421984.21)
10:55:55: Weakening on 18680 threads for 1 minutes 3 seconds, gaining 212841.99 Hacking EXP
10:56:59: hong-fang-tea fully weakened (Hacking EXP: 9634897.76)
10:56:59: WARNING: Current EXP 9634897.76 is not equal to Expected EXP 9634826.20 (diff: 71.56)
10:56:59: Growing on 17296/1384 threads for 34 seconds, gaining 212841.9921462314 Hacking EXP
10:57:34: hong-fang-tea available money maxed out (Hacking EXP: 9847778.21)
10:57:34: WARNING: Current EXP 9847778.21 is not equal to Expected EXP 9847739.75 (diff: 38.46)

10:58:36: Attacking sigma-cosmetics (Hacking EXP: 9847847.98)
10:58:36: Weakening on 18680 threads for 24 seconds, gaining 160574.66 Hacking EXP
10:59:01: sigma-cosmetics fully weakened (Hacking EXP: 10008449.93)
10:59:01: WARNING: Current EXP 10008449.93 is not equal to Expected EXP 10008422.64 (diff: 27.28)
10:59:01: Growing on 17296/1384 threads for 20 seconds, gaining 160574.66143082094 Hacking EXP
10:59:22: sigma-cosmetics available money maxed out (Hacking EXP: 10169048.29)
10:59:22: WARNING: Current EXP 10169048.29 is not equal to Expected EXP 10169024.59 (diff: 23.70)





*/

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    // do full weaken

    // Find out how much money I can gain back in a single GW cycle and never hack more than that

    const hackScript = "hack.js";
    const growScript = "grow.js";
    const weakenScript = "weaken.js";
    const targetname = "harakiri-sushi";
    const hostname = "home";
    const hostCores = ns.getServer(hostname).cores;
    const hackRam = ns.getScriptRam(hackScript);
    const growRam = ns.getScriptRam(growScript);
    const weakenRam = ns.getScriptRam(weakenScript);
    const tspacer = 50;

    let hostRam = ns.getServerMaxRam(hostname);
    if (hostname === "home") {
        hostRam -= 64;
    }

    let hostRamAvailable = function () {
        return hostRam - ns.getServerUsedRam(hostname);
    };

    ns.print(`${new Date().toLocaleTimeString("it-IT")}: Attacking ${targetname}`);

    // Full Weaken
    while (ns.getServerSecurityLevel(targetname) - 0.1 > ns.getServerMinSecurityLevel(targetname)) {
        let weakenThreads = Math.floor(hostRamAvailable() / weakenRam);

        let waitPID = ns.exec(weakenScript, hostname, weakenThreads, targetname);
        ns.print(
            `${new Date().toLocaleTimeString("it-IT")}: ` +
                `Weakening on ${weakenThreads} threads for ${ns.tFormat(ns.getWeakenTime(targetname))}`
        );

        while (ns.getRunningScript(waitPID)) {
            await ns.sleep(100);
        }
    }

    ns.print(`${new Date().toLocaleTimeString("it-IT")}: ${targetname} fully weakened`);

    // Full Grow
    while (ns.getServerMoneyAvailable(targetname) + 1000 < ns.getServerMaxMoney(targetname)) {
        const weakenAmountPerThread = ns.weakenAnalyze(1, hostCores);

        let growThreads = Math.floor(hostRamAvailable() / growRam);
        let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);

        let weakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);

        let cycleRam = growThreads * growRam + weakenThreads * weakenRam;

        while (cycleRam > hostRamAvailable()) {
            growThreads--;
            growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
            weakenThreads = Math.ceil(growSecIncrease / weakenAmountPerThread);
            cycleRam = growThreads * growRam + weakenThreads * weakenRam;
        }

        ns.print(
            `${new Date().toLocaleTimeString("it-IT")}: ` +
                `Growing on ${growThreads}/${weakenThreads} threads ` +
                `for ${ns.tFormat(ns.getWeakenTime(targetname))}`
        );

        let waitPID = ns.exec(weakenScript, hostname, weakenThreads, targetname);
        ns.exec(growScript, hostname, growThreads, targetname);

        while (ns.getRunningScript(waitPID)) {
            await ns.sleep(100);
        }
    }

    ns.print(`${new Date().toLocaleTimeString("it-IT")}: ${targetname} available money maxed out`);

	return

    let bst = Date.now();

    // return true if no processes are finishing within startbuf and endbuf
    let isProcessStartSafe = function (ps, startbuf, endbuf) {
        for (const processInfo of ps) {
            let psEndTime = processInfo.args[3];
            if (psEndTime > startbuf && psEndTime < endbuf) return false;
        }

        return true;
    };

    // BATCH!
    while (true) {
        await ns.sleep(200);

        let currentTime = Date.now() - bst;

        // collect all running HGW threads
        let ps = ns.ps(hostname);

        // if any processes are going to finish in the next 200ms, wait 200ms and try again
        if (!isProcessStartSafe(ps, currentTime, currentTime + 200)) continue;

        // The state of the player when both weakens are called (in the next 0 and 50 ms) should not change,
        // so getting weaken time unmodified should be fine
        let weakenTime = ns.getWeakenTime(targetname);
        let weakenHackOffsetTime = 0;
        let weakenGrowOffsetTime = tspacer * 2;

        // If any ps are finishing between weakenTime - tspacer * 2 and weakenTime + tspacer * 3, wait 200ms and try again
        // since this cycle's finish time will collide with a running cycle
        if (!isProcessStartSafe(ps, currentTime + weakenTime - tspacer * 2, currentTime + weakenTime + tspacer * 3))
            continue;

        // calculate grow time when grow is supposed to start
        let growPlayer = ns.getPlayer();
        let growServer = ns.getServer();
        let growTime, growOffsetTime, growStartTime;
        let oldGrowStartTime = currentTime;

        while (true) {
            growTime = ns.formulas.hacking.growTime(growServer, growPlayer);
            growOffsetTime = weakenTime + tspacer - growTime;
            growStartTime = currentTime + growOffsetTime;

            // check if any ps finish between oldGrowStartTime and growStartTime
            // if no, continue on
            // if yes, recalculate player.hacking_exp and player.hacking based on the amount of experience
            //   that will be received between oldGrowStartTime and growStartTime and then
            //   recalculate growTime and growStartTime

            let accumulatedExp = 0;
            for (const processInfo of ps) {
                let psEndTime = processInfo.args[3];
                let psExp = processInfo.args[4];
                if (psEndTime >= oldGrowStartTime && psEndTime < growStartTime) {
                    accumulatedExp += psExp;
                }
            }

            if (accumulatedExp > 0) {
                growPlayer.hacking_exp += accumulatedExp;
            }

            // check if our hacking level changed
            let newHackingLvl = ns.formulas.skills.calculateSkill(
                growPlayer.hacking_exp,
                growPlayer.hacking_mult * ns.getBitNodeMultipliers().HackingLevelMultiplier
            );

            if (newHackingLvl === growPlayer.hacking) break;

            growPlayer.hacking = newHackingLvl;
        }

        // if growStartTime is within +-tspacer of another process ending, wait 200ms and try again
        if (!isProcessStartSafe(ps, growStartTime - tspacer, growStartTime + tspacer)) continue;

        // calculate hack time when hack is supposed to start
        let hackPlayer = ns.getPlayer();
        let hackServer = ns.getServer();
        let hackTime, hackOffsetTime, hackStartTime;
        let oldHackStartTime = currentTime;

        while (true) {
            hackTime = ns.formulas.hacking.hackTime(hackServer, hackPlayer);
            hackOffsetTime = weakenTime - hackTime - tspacer;
            hackStartTime = currentTime + hackOffsetTime;

            // check if any ps finish between oldHackStartTime and hackStartTime
            // if no, continue on
            // if yes, recalculate player.hacking_exp and player.hacking based on the amount of experience
            //   that will be received between oldHackStartTime and hackStartTime and then
            //   recalculate hackTime and hackStartTime

            let accumulatedExp = 0;
            for (const processInfo of ps) {
                let psEndTime = processInfo.args[3];
                let psExp = processInfo.args[4];
                if (psEndTime >= oldHackStartTime && psEndTime < hackStartTime) {
                    accumulatedExp += psExp;
                }
            }

            if (accumulatedExp > 0) {
                hackPlayer.hacking_exp += accumulatedExp;
            }

            // check if our hacking level changed
            let newHackingLvl = ns.formulas.skills.calculateSkill(
                hackPlayer.hacking_exp,
                hackPlayer.hacking_mult * ns.getBitNodeMultipliers().HackingLevelMultiplier
            );

            if (newHackingLvl === hackPlayer.hacking) break;

            hackPlayer.hacking = newHackingLvl;
        }

        // if hackStartTime is within +-tspacer of another process ending, wait 200ms and try again
        if (!isProcessStartSafe(ps, hackStartTime - tspacer, hackStartTime + tspacer)) continue;

        // calculate and launch a cycle
        const weakenAmountPerThread = ns.weakenAnalyze(1, hostCores);
        const hackPercentPerThread = ns.formulas.hacking.hackPercent(hackServer, hackPlayer);
        const targetMaxMoney = ns.getServerMaxMoney(targetname);

        // hard code hack thread target being 50% of target's max money
        let hackThreads = 0.5 / hackPercentPerThread - 1;
        let hackTotal = hackPercentPerThread * hackThreads * targetMaxMoney;

        let growMult = targetMaxMoney / (targetMaxMoney - hackTotal);
        let growThreads = Math.ceil(ns.growthAnalyze(targetname, growMult, hostCores));

        let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);
        let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);
        let weakenThreadsHack = Math.ceil(hackSecIncrease / weakenAmountPerThread);
        let weakenThreadsGrow = Math.ceil(growSecIncrease / weakenAmountPerThread);

        let cycleRam =
            hackThreads * hackRam + growThreads * growRam + (weakenThreadsHack + weakenThreadsGrow) * weakenRam;

        // check if there is ram available to run the cycle
        if (hostRamAvailable() < cycleRam) continue;

		let hackEXP = ns.formulas.hacking.hackExp(ns.getServer(targetname), ns.getPlayer());

        // args are targetname, offset, ms since aug when process will start, ms since aug when process will end, exp gain
        let weakenArgsHack = [
            targetname,
            weakenHackOffsetTime,
            currentTime + weakenHackOffsetTime,
            currentTime + weakenTime + weakenHackOffsetTime,
            hackEXP * weakenThreadsHack,
        ];

        let weakenArgsGrow = [
            targetname,
            weakenGrowOffsetTime,
            currentTime + weakenGrowOffsetTime,
            currentTime + weakenTime + weakenGrowOffsetTime,
            hackEXP * weakenThreadsGrow,
        ];

        let growArgs = [
            targetname,
            growOffsetTime,
            currentTime + growOffsetTime,
            currentTime + growTime + growOffsetTime,
            hackEXP * growThreads,
        ];

        let hackArgs = [
            targetname,
            hackOffsetTime,
            currentTime + hackOffsetTime,
            currentTime + hackTime + hackOffsetTime,
            hackEXP * hackThreads,
        ];

        ns.print(`${new Date().toLocaleTimeString("it-IT")}: Starting Batch Cycle at ${ns.tFormat(currentTime, true)}`);

        ns.exec(weakenScript, hostname, weakenThreadsHack, ...weakenArgsHack);
        ns.exec(weakenScript, hostname, weakenThreadsGrow, ...weakenArgsGrow);
        ns.exec(growScript, hostname, growThreads, ...growArgs);
        ns.exec(hackScript, hostname, hackThreads, ...hackArgs);
    }
}
