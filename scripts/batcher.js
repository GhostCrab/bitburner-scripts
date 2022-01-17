import { setns, cleanLogs } from "./util.js";
import { SuperHackEnv } from "./super_hack_env.js";

var DEBUG_OUTPUT = false;

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    cleanLogs();

    // do full weaken

    // Find out how much money I can gain back in a single GW cycle and never hack more than that

    const hackScript = "hack.js";
    const growScript = "grow.js";
    const weakenScript = "weaken.js";
    const targetname = ns.args[0];
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

    let bst = Date.now();
    const dataOut = `${bst}_${targetname}.txt`;

    if (DEBUG_OUTPUT) {
        await ns.write(
            dataOut,
            "Target Name, UID, Batch ID, Offset Time, Start Time, End Time, Operation Time, Real Time Start, Real Time End, Real Time Operation, Diff, Exp Gain\n",
            "w"
        );
    }

    // return true if no processes are finishing within startbuf and endbuf
    let isProcessStartSafe = function (ps, startbuf, endbuf) {
        for (const processInfo of ps) {
            let psEndTime = processInfo.args[3];
            if (psEndTime > startbuf && psEndTime < endbuf) return false;
        }

        return true;
    };

    let env = new SuperHackEnv(ns, targetname, [hostname]);
    let optimalHackPercent = env.optimalHackPercent(ns);
    let optimalLevelCheck = ns.getPlayer().hacking;
    const optimalTimerReset = 30 * 1000;
    let optimalTimer = optimalTimerReset;
    let batchID = 0;
    const batchSleep = 20;
    // BATCH!
    while (true) {
        await ns.sleep(batchSleep);

        if ((optimalTimer -= batchSleep <= 0)) {
            optimalTimer = optimalTimerReset;
            if (optimalLevelCheck != ns.getPlayer().hacking) {
                optimalLevelCheck = ns.getPlayer().hacking;
                optimalHackPercent = env.optimalHackPercent(ns);
                ns.print(`Optimal Hack Percent set to ${(optimalHackPercent * 100).toFixed(2)}%`);
            }
        }

        let currentTime = Date.now() - bst;

        // collect all running HGW threads
        let ps = ns.ps(hostname);

        // if any processes are going to finish in the next 150 ms, wait 150 ms and try again
        if (!isProcessStartSafe(ps, currentTime, currentTime + 150)) continue;

        // The state of the player when both weakens are called (in the next 0 and 50 ms) should not change,
        // so getting weaken time unmodified should be fine
        let weakenTime = Math.ceil(ns.getWeakenTime(targetname));
        let weakenHackOffsetTime = 0;
        let weakenGrowOffsetTime = tspacer * 2;

        // If any ps are finishing between weakenTime - tspacer * 2 and weakenTime + tspacer * 3, wait 200ms and try again
        // since this cycle's finish time will collide with a running cycle
        if (!isProcessStartSafe(ps, currentTime + weakenTime - tspacer * 2, currentTime + weakenTime + tspacer * 3))
            continue;

        // calculate grow time when grow is supposed to start
        let growPlayer = ns.getPlayer();
        let growServer = ns.getServer(targetname);
        let growTime, growOffsetTime, growStartTime;
        let oldGrowStartTime = currentTime;

        while (true) {
            growTime = Math.ceil(ns.formulas.hacking.growTime(growServer, growPlayer));
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
        let hackServer = ns.getServer(targetname);
        let hackTime, hackOffsetTime, hackStartTime;
        let oldHackStartTime = currentTime;

        while (true) {
            hackTime = Math.ceil(ns.formulas.hacking.hackTime(hackServer, hackPlayer));
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

        let hackThreads = optimalHackPercent / hackPercentPerThread;
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
            batchID,
            DEBUG_OUTPUT ? dataOut : false,
            bst,
            "0WH",
        ];

        let weakenArgsGrow = [
            targetname,
            weakenGrowOffsetTime,
            currentTime + weakenGrowOffsetTime,
            currentTime + weakenTime + weakenGrowOffsetTime,
            hackEXP * weakenThreadsGrow,
            batchID,
            DEBUG_OUTPUT ? dataOut : false,
            bst,
            "1WG",
        ];

        let growArgs = [
            targetname,
            growOffsetTime,
            currentTime + growOffsetTime,
            currentTime + growTime + growOffsetTime,
            hackEXP * growThreads,
            batchID,
            DEBUG_OUTPUT ? dataOut : false,
            bst,
            "2G",
        ];

        let hackArgs = [
            targetname,
            hackOffsetTime,
            currentTime + hackOffsetTime,
            currentTime + hackTime + hackOffsetTime,
            hackEXP * hackThreads,
            batchID,
            DEBUG_OUTPUT ? dataOut : false,
            bst,
            "3H",
        ];

        ns.print(
            ns.sprintf(
                "%8s HACK-GROW-WEAKEN: %s => Starting Batch Cycle; Hacking %s (%.2f%% of max)",
                new Date().toLocaleTimeString("it-IT"),
                targetname,
                ns.nFormat(hackTotal, "($0.000a)"),
                (hackTotal / ns.getServerMaxMoney(targetname)) * 100
            )
        );
        ns.print(
            ns.sprintf(
                "%8s HACK-GROW-WEAKEN: %s => Hack %d; Grow %d; Hack/Grow Weaken %d/%d; Total Threads %d; Time %s",
                new Date().toLocaleTimeString("it-IT"),
                targetname,
                hackThreads,
                growThreads,
                weakenThreadsHack,
                weakenThreadsGrow,
                hackThreads + growThreads + weakenThreadsHack + weakenThreadsGrow,
                ns.tFormat(weakenTime)
            )
        );

        ns.exec(weakenScript, hostname, weakenThreadsHack, ...weakenArgsHack);
        ns.exec(weakenScript, hostname, weakenThreadsGrow, ...weakenArgsGrow);
        ns.exec(growScript, hostname, growThreads, ...growArgs);
        ns.exec(hackScript, hostname, hackThreads, ...hackArgs);

        batchID++;

        // Allow space for interleaving batches
        await ns.sleep(300 - batchSleep)
    }
}
