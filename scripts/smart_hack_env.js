export const debug = false;
export const TSPACER = 400;
export const WEAKENNS = "weaken.js";
export const GROWNS = "grow.js";
export const HACKNS = "hack.js";

function stFormat(ns, ms, showms = true, showfull = false) {
    let timeLeft = ms;
    let hours = Math.floor(ms / (1000 * 60 * 60));
    timeLeft -= hours * (1000 * 60 * 60);
    let minutes = Math.floor(timeLeft / (1000 * 60));
    timeLeft -= minutes * (1000 * 60);
    let seconds = Math.floor(timeLeft / 1000);
    timeLeft -= seconds * 1000;
    let milliseconds = timeLeft;

    if (showms) {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d.%03d", minutes, seconds, milliseconds);
        return ns.sprintf("%02d.%03d", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d", minutes, seconds);
        return ns.sprintf("%02d", seconds);
    }
}

function stdFormat(ns, offset = 0, showms = true) {
    let date = new Date(new Date().getTime() + offset);

    if (showms) {
        let ms = ns.sprintf("%03d", date.getUTCMilliseconds());
        return date.toLocaleTimeString("it-IT") + "." + ms;
    } else {
        return date.toLocaleTimeString("it-IT");
    }
}

// {targetname: {hack stat, production lookup table}}
const CYCLE_PRODUCTION_LOOKUP = {};

function getCycleProductionLookup(ns, env) {
    if (
        CYCLE_PRODUCTION_LOOKUP[env.targetname] &&
        CYCLE_PRODUCTION_LOOKUP[env.targetname].hack === ns.getPlayer().hacking
    ) {
        return CYCLE_PRODUCTION_LOOKUP[env.targetname].prod;
    }

    // memoize cycle production statistics indexed by cycleThreadAllowance
    let cycleProductionLookup = new Array(env.maxThreads + 1).fill(null);

    let hackThreads = Math.min(env.maxThreads, Math.floor(1 / env.hackPercentPerThread));

    while (hackThreads > 0) {
        hackThreads--;
        let hackTotal = env.hackPercentPerThread * hackThreads * env.highMoney;
        let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);

        let growMult = Math.max(env.highMoney / (env.highMoney - hackTotal), 1);
        let growThreads = env.calcGrowThreads(ns, growMult, true);

        if (hackThreads + growThreads > env.maxThreads) {
            //ns.tprintf("h %d | g %d", hackThreads, growThreads)
            continue;
        }

        let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);

        let weakenHackThreads = Math.ceil(hackSecIncrease / env.weakenAmountPerThread);
        let weakenGrowThreads = Math.ceil(growSecIncrease / env.weakenAmountPerThread);

        let totalThreads = hackThreads + weakenHackThreads + growThreads + weakenGrowThreads;

        if (totalThreads > env.maxThreads) continue;

        if (cycleProductionLookup[totalThreads] !== null) {
            // do nothing
        } else {
            cycleProductionLookup[totalThreads] = {
                totalThreads: totalThreads,
                hackTotal: hackTotal,
                hackThreads: hackThreads,
                growThreads: growThreads,
                weakenHackThreads: weakenHackThreads,
                weakenGrowThreads: weakenGrowThreads,
            };
        }
    }

    // Fill in the blanks
    const zeroThread = {
        totalThreads: 0,
        hackTotal: 0,
        hackThreads: 0,
        growThreads: 0,
        weakenHackThreads: 0,
        weakenGrowThreads: 0,
    };
    let fillDict = zeroThread;
    for (let idx = 0; idx < cycleProductionLookup.length; idx++) {
        if (cycleProductionLookup[idx] === null) cycleProductionLookup[idx] = fillDict;
        else fillDict = cycleProductionLookup[idx];
    }

    let endTime = new Date().getTime();

    // ns.tprintf(
    //     "Calculated %20s:%d in %4dms | %d values | %4d",
    //     env.targetname,
    //     ns.getPlayer().hacking,
    //     endTime - startTime,
    //     env.maxThreads,
    //     Math.floor(1 / env.hackPercentPerThread)
    // );

    CYCLE_PRODUCTION_LOOKUP[env.targetname] = { hack: ns.getPlayer().hacking, prod: cycleProductionLookup };
    return CYCLE_PRODUCTION_LOOKUP[env.targetname].prod;
}

class Host {
    /** @param {import(".").NS } ns */
    constructor(ns, hostname, threadSize) {
        this.hostname = hostname;
        this.threadSize = threadSize;
        this.reservedScriptCalls = [];
        this.getMaxThreads(ns);
    }

    reset() {
        this.reservedScriptCalls = [];
    }

    getReservedThreadCount() {
        let reservedThreadCount = 0;
        for (const scriptCall of this.reservedScriptCalls) {
            reservedThreadCount += scriptCall.threads;
        }

        return reservedThreadCount;
    }

    // return # of threads successfully allocated
    tryReserveThreads(ns, script, threads, offset, length, batchId) {
        let reservedThreadCount = this.getReservedThreadCount();

        if (reservedThreadCount === this.maxThreads) return 0;

        let newThreadCount = Math.min(this.maxThreads - reservedThreadCount, threads);
        this.reservedScriptCalls.push({
            script: script,
            threads: newThreadCount,
            offset: offset,
            length: length,
            batchId: batchId,
        });

        return newThreadCount;
    }

    // update max threads in case server size has changed
    getMaxThreads(ns) {
        this.maxThreads = Math.floor(ns.getServerMaxRam(this.hostname) / this.threadSize);

        // if this host is home, reserve 64GB of ram for other stuff
        if (this.hostname === "home") {
            let homeram = ns.getServerMaxRam(this.hostname) - 64;
            this.maxThreads = Math.max(0, Math.floor(homeram / this.threadSize));
        }

        this.maxThreads = Math.min(1000000, this.maxThreads);

        return this.maxThreads;
    }

    async prep(ns, force = false) {
        if (force || !ns.fileExists(GROWNS, this.hostname)) await ns.scp(GROWNS, "home", this.hostname);
        if (force || !ns.fileExists(WEAKENNS, this.hostname)) await ns.scp(WEAKENNS, "home", this.hostname);
        if (force || !ns.fileExists(HACKNS, this.hostname)) await ns.scp(HACKNS, "home", this.hostname);
    }
}

export class SmartHackEnv {
    /** @param {import(".").NS } ns */
    constructor(ns, targetname, hostname) {
        this.targetname = targetname;
        this.highMoney = ns.getServerMaxMoney(this.targetname);
        this.lowMoney = ns.getServerMaxMoney(this.targetname) * 0.5;
        this.tspacer = TSPACER; // CONST

        this.weakenRam = ns.getScriptRam(WEAKENNS);
        this.growRam = ns.getScriptRam(GROWNS);
        this.hackRam = ns.getScriptRam(HACKNS);
        this.threadSize = Math.max(this.weakenRam, this.growRam, this.hackRam);

        this.host = new Host(ns, hostname, this.threadSize);
        this.cores = ns.getServer(this.host.hostname).cores;
        this.maxThreads = this.host.maxThreads;

        this.waitPID = 0;

        // Target Info
        this.security = 0;
        this.lowSecurity = 0;
        this.money = 0;

        // Weaken Info
        this.weakenStartSec = 0;
        this.weakenAmountPerThread = 0;
        this.weakenThreads = 0;
        this.weakenGrowThreads = 0;
        this.weakenHackThreads = 0;
        this.weakenTime = 0;
        this.weakenTimeFullCycle = 0;

        // Grow Info
        this.growStartMoney = 0;
        this.growMult = 0;
        this.growThreads = 0;
        this.growSecIncrease = 0;
        this.growTime = 0;

        // Hack Info
        this.hackStartMoney = 0;
        this.hackTotal = 0;
        this.hackThreads = 0;
        this.hackSecIncrease = 0;
        this.hackTime = 0;
        this.hackPercentPerThread = 0;

        // Batch Cycle Info
        this.threadsPerCycle = 0;
        this.cycleSpacer = this.tspacer * 4;
        this.cycleFullTime = 0; // this.weakenTime + this.tspacer * 2;
        this.cycleMax = 0; // Math.floor(this.cycleFitTime / this.cycleSpacer)
        this.cycleTotal = 0;
        this.cycleBatchTime = 0; // this.cycleFullTime + this.cycleSpacer * this.cycleTotal

        // Simulator Info
        this.simEnabled = false;
        this.simHost = ns.getServer(this.hostname);
        this.simTarget = ns.getServer(this.targetname);
        this.simPlayer = ns.getPlayer();
        this.simTime = 0;
        this.simIncome = 0;
    }

    async init(ns, force = false) {
        await this.host.prep(ns, force);
    }

    resetSim(ns) {
        this.state = HackState.UNSET;
        this.simHost = ns.getServer(this.hostname);
        this.simTarget = ns.getServer(this.targetname);
        this.simPlayer = ns.getPlayer();
        this.simTime = 0;
        this.simIncome = 0;
        this.simForceState = HackState.UNSET;
    }

    getServerSecurityLevel(ns) {
        if (this.simEnabled) return this.simTarget.hackDifficulty;

        return ns.getServerSecurityLevel(this.targetname);
    }

    getServerMoneyAvailable(ns) {
        if (this.simEnabled) return Math.max(this.simTarget.moneyAvailable, 1);

        return Math.max(ns.getServerMoneyAvailable(this.targetname), 1);
    }

    /** @param {import(".").NS } ns */
    getWeakenTime(ns) {
        if (this.simEnabled) return Math.ceil(ns.formulas.hacking.weakenTime(this.simTarget, this.simPlayer));

        return Math.ceil(ns.getWeakenTime(this.targetname));
    }

    getGrowTime(ns) {
        if (this.simEnabled) return Math.ceil(ns.formulas.hacking.growTime(this.simTarget, this.simPlayer));

        return Math.ceil(ns.getGrowTime(this.targetname));
    }

    getHackTime(ns) {
        if (this.simEnabled) return Math.ceil(ns.formulas.hacking.hackTime(this.simTarget, this.simPlayer));

        return Math.ceil(ns.getHackTime(this.targetname));
    }

    hackAnalyze(ns, assumeMinSec = false) {
        if (this.simEnabled) {
            if (assumeMinSec) {
                let simTarget = Object.assign({}, this.simTarget);
                simTarget.hackDifficulty = simTarget.minDifficulty;
                return ns.formulas.hacking.hackPercent(simTarget, this.simPlayer);
            }
            return ns.formulas.hacking.hackPercent(this.simTarget, this.simPlayer);
        }

        if (assumeMinSec) {
            let simTarget = ns.getServer(this.targetname);
            simTarget.hackDifficulty = simTarget.minDifficulty;
            return ns.formulas.hacking.hackPercent(simTarget, ns.getPlayer());
        }

        return ns.hackAnalyze(this.targetname);
    }

    numCycleForGrowth(ns, server, growth, player, cores = 1) {
        let ajdGrowthRate = 1 + (1.03 - 1) / server.hackDifficulty;
        if (ajdGrowthRate > 1.0035) {
            ajdGrowthRate = 1.0035;
        }

        const serverGrowthPercentage = server.serverGrowth / 100;

        const coreBonus = 1 + (cores - 1) / 16;
        const cycles =
            Math.log(growth) /
            (Math.log(ajdGrowthRate) *
                player.hacking_grow_mult *
                serverGrowthPercentage *
                ns.getBitNodeMultipliers().ServerGrowthRate *
                coreBonus);

        return cycles;
    }

    /** @param {import(".").NS } ns */
    calcGrowThreads(ns, _growMult, assumeMinSec = false) {
        let growMult = _growMult === undefined ? this.growMult : _growMult;
        if (growMult < 1) return 0;
        if (this.simEnabled) {
            if (assumeMinSec) {
                let simTarget = Object.assign({}, this.simTarget);
                simTarget.hackDifficulty = simTarget.minDifficulty;
                return Math.ceil(this.numCycleForGrowth(ns, simTarget, growMult, this.simPlayer));
            }
            return Math.ceil(this.numCycleForGrowth(ns, this.simTarget, growMult, this.simPlayer));
        }

        if (assumeMinSec) {
            let simTarget = ns.getServer(this.targetname);
            simTarget.hackDifficulty = simTarget.minDifficulty;
            return Math.ceil(this.numCycleForGrowth(ns, simTarget, growMult, ns.getPlayer()));
        }

        return Math.ceil(ns.growthAnalyze(this.targetname, growMult, this.cores));
    }

    /** @param {import(".").NS } ns */
    async refresh(ns) {
        if (this.isWRunning(ns)) {
            // process in progress, wait for next refresh to update
            await ns.sleep(1000);
            return true;
        }

        // Host state
        this.maxThreads = this.host.getMaxThreads(ns);
        this.cores = ns.getServer(this.host.hostname).cores;

        // Target Info
        this.highMoney = ns.getServerMaxMoney(this.targetname);
        this.lowMoney = ns.getServerMaxMoney(this.targetname) * 0.5;
        this.money = this.getServerMoneyAvailable(ns);
        this.lowSecurity = ns.getServerMinSecurityLevel(this.targetname);
        this.security = this.getServerSecurityLevel(ns);

        // Hack Info
        this.hackTime = this.getHackTime(ns);
        this.hackPercentPerThread = this.hackAnalyze(ns, true);

        this.hackThreads = 1 / this.hackPercentPerThread - 1;
        this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.money;
        this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);

        // Grow Info
        this.growTime = this.getGrowTime(ns);

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);

        // Cycle Info
        this.cycleFullTime = this.weakenTime + this.tspacer * 2;
        this.cycleMax = Math.floor((this.hackTime - this.tspacer) / this.cycleSpacer);

        this.threadsPerCycle = this.hackThreads + this.weakenHackThreads + this.growThreads + this.weakenGrowThreads;

        // Primary Cycle Info
        let primaryGrowMult = Math.max(this.highMoney / this.money, 1);
        let primaryGrowThreads = this.calcGrowThreads(ns, primaryGrowMult);
        let primaryGrowSecIncrease = ns.growthAnalyzeSecurity(primaryGrowThreads);
        let primarySecDiff = this.security - this.lowSecurity;
        let primaryWeakenThreads = Math.ceil((primaryGrowSecIncrease + primarySecDiff) / this.weakenAmountPerThread);
        let primaryThreadsTotal = primaryGrowThreads + primaryWeakenThreads;
        if (primarySecDiff < 1 && primaryGrowMult < 1.05) primaryThreadsTotal = 0; // dont bother with the grow/weaken cycle if we're already very close to optimal

        while (primaryThreadsTotal > this.maxThreads) {
            primaryGrowThreads--;
            primaryGrowSecIncrease = ns.growthAnalyzeSecurity(primaryGrowThreads);
            primarySecDiff = this.security - this.lowSecurity;
            primaryWeakenThreads = Math.ceil((primaryGrowSecIncrease + primarySecDiff) / this.weakenAmountPerThread);
            primaryThreadsTotal = primaryGrowThreads + primaryWeakenThreads;
        }

        // memoize cycle production statistics indexed by cycleThreadAllowance
        let cycleProductionLookup = getCycleProductionLookup(ns, this);

        // Get all cycle combination production statistics
        let allCycles = [];
        for (let cycleTotal = 1; cycleTotal <= this.cycleMax; cycleTotal++) {
            let usableThreads = this.maxThreads - primaryThreadsTotal;
            let usableCycles = primaryThreadsTotal > 0 ? cycleTotal - 1 : cycleTotal;
            let fullCycleTime = this.cycleFullTime + this.cycleSpacer * (cycleTotal - 1);

            let cycleThreadAllowance = Math.floor(usableThreads / usableCycles);

            let cycleStats = cycleProductionLookup[cycleThreadAllowance];

            if (cycleTotal === 1 && primaryThreadsTotal > 0) {
                allCycles.push({
                    cycleTotal: cycleTotal,
                    hackTotal: 1,
                    production: 1,
                    fullCycleTime: fullCycleTime,
                    hackThreads: 0,
                    growThreads: 0,
                    weakenHackThreads: 0,
                    weakenGrowThreads: 0,
                    percentPerCycle: 0,
                });
                continue;
            }

            if (cycleStats === undefined) {
                ns.print(ns.sprintf("WARNING: Thread Total %s is undefined", cycleThreadAllowance));
                continue;
            }
            allCycles.push({
                cycleTotal: cycleTotal,
                hackTotal: cycleStats.hackTotal,
                production: (usableCycles * cycleStats.hackTotal) / (fullCycleTime / 1000),
                fullCycleTime: fullCycleTime,
                hackThreads: cycleStats.hackThreads,
                growThreads: cycleStats.growThreads,
                weakenHackThreads: cycleStats.weakenHackThreads,
                weakenGrowThreads: cycleStats.weakenGrowThreads,
                percentPerCycle: (cycleStats.hackTotal / ns.getServerMaxMoney(this.targetname)) * 100,
            });
        }

        allCycles = allCycles.sort((a, b) => b.production - a.production);

        //this.debugPrintCycleStats(ns, primaryThreadsTotal, allCycles);

        let cycleTarget = allCycles[0];

        this.hackTotal = cycleTarget.hackTotal;
        this.hackThreads = cycleTarget.hackThreads;
        this.growThreads = cycleTarget.growThreads;
        this.weakenHackThreads = cycleTarget.weakenHackThreads;
        this.weakenGrowThreads = cycleTarget.weakenGrowThreads;
        this.cycleTotal = cycleTarget.cycleTotal;
        this.cycleBatchTime = cycleTarget.fullCycleTime;

        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        let primaryStats = {
            primaryThreadsTotal: primaryThreadsTotal,
            primaryGrowThreads: primaryGrowThreads,
            primaryWeakenThreads: primaryWeakenThreads,
        };

        if (primaryThreadsTotal > 0) {
            if (primaryGrowThreads > 0)
                this.host.tryReserveThreads(ns, GROWNS, primaryGrowThreads, growOffsetTime, this.growTime, 0);
            if (primaryWeakenThreads > 0)
                this.host.tryReserveThreads(
                    ns,
                    WEAKENNS,
                    primaryWeakenThreads,
                    weakenGrowOffsetTime,
                    this.weakenTime,
                    0
                );
        }

        for (let i = 0; i < this.cycleTotal; i++) {
            if (primaryThreadsTotal > 0 && i === 0) continue;
            let cycleOffsetTime = i * this.cycleSpacer;
            this.host.tryReserveThreads(
                ns,
                HACKNS,
                this.hackThreads,
                cycleOffsetTime + hackOffsetTime,
                this.hackTime,
                i
            );
            this.host.tryReserveThreads(
                ns,
                GROWNS,
                this.growThreads,
                cycleOffsetTime + growOffsetTime,
                this.growTime,
                i
            );
            this.host.tryReserveThreads(ns, WEAKENNS, this.weakenHackThreads, cycleOffsetTime, this.weakenTime, i);
            this.host.tryReserveThreads(
                ns,
                WEAKENNS,
                this.weakenGrowThreads,
                cycleOffsetTime + weakenGrowOffsetTime,
                this.weakenTime,
                i
            );
        }

        let port = ns.getPortHandle(1);
        port.clear();
        port.write([
            new Date(),
            this.cycleBatchTime,
            this.targetname,
            ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args),
            "SMART",
        ]);

        this.logStats(ns, primaryStats);

        await this.execute(ns);
        this.resetThreads();

        return true;
    }

    debugPrintCycleStats(ns, primaryThreadsTotal, allCycles) {
        for (const cycle of allCycles) {
            let batchThreads =
                cycle.hackThreads + cycle.growThreads + cycle.weakenHackThreads + cycle.weakenGrowThreads;
            if (cycle.hackThreads === undefined) batchThreads = 0;
            let cycleThreads = primaryThreadsTotal + batchThreads * (cycle.cycleTotal - 1);
            if (primaryThreadsTotal === 0) {
                cycleThreads = batchThreads * cycle.cycleTotal;
            }
            let cycleMem = cycleThreads * this.threadSize;
            ns.tprintf(
                "%3d  %9s/s %5.2f %d/%4d/%5d %6dGB, %s|%s|%s|%s",
                cycle.cycleTotal,
                ns.nFormat(cycle.production, "($0.000a)"),
                cycle.percentPerCycle ? cycle.percentPerCycle : 0,
                primaryThreadsTotal,
                batchThreads,
                cycleThreads,
                cycleMem,
                cycle.hackThreads,
                cycle.growThreads,
                cycle.weakenHackThreads,
                cycle.weakenGrowThreads
            );
        }
    }

    logStats(ns, primaryStats) {
        if (primaryStats.primaryThreadsTotal > 0) {
            ns.print(
                ns.sprintf(
                    "%8s SMART-PRIMARY: %s => Grow %d; Weaken %d; Total Threads %d",
                    new Date().toLocaleTimeString("it-IT"),
                    this.targetname,
                    primaryStats.primaryGrowThreads,
                    primaryStats.primaryWeakenThreads,
                    primaryStats.primaryThreadsTotal
                )
            );
        }

        ns.print(
            ns.sprintf(
                "%8s SMART: %s => H %d|%d; G %d|%d; T %d|%d; Cycles %s/%s; Complete [%s -%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.hackThreads,
                this.weakenHackThreads,
                this.growThreads,
                this.weakenGrowThreads,
                this.threadsPerCycle,
                this.threadsPerCycle * this.cycleTotal,
                this.cycleTotal,
                this.cycleMax,
                stdFormat(ns, this.cycleBatchTime),
                stFormat(ns, this.cycleBatchTime - this.weakenTime)
            )
        );
    }

    /** @param {import(".").NS } ns */
    async execute(ns) {
        let execs = [];
        for (const scriptCall of this.host.reservedScriptCalls) {
            execs.push({
                script: scriptCall.script,
                host: this.host.hostname,
                threads: scriptCall.threads,
                target: this.targetname,
                delay: scriptCall.offset,
                pos: execs.length,
                finish: scriptCall.offset + scriptCall.length,
                batchId: scriptCall.batchId,
            });
        }

        execs = execs.sort((a, b) => b.delay - a.delay);

        // for (const exec of execs) {
        //     ns.tprintf("%s %s %s %s", exec.script, exec.threads, exec.delay, exec.batchId);
        // }

        this.waitPID = 0;
        let waitPIDFinishTime = 0;
        let startTime = new Date().getTime();
        while (execs.length > 0) {
            let exec = execs.pop();

            while (new Date().getTime() - startTime < exec.delay) await ns.sleep(5);

            // script call has come up, make sure it is starting and finishing within +- tspacer / 2
            let curTOffset = new Date().getTime() - startTime;
            let delayDiff = Math.abs(curTOffset - exec.delay);
            if (delayDiff > this.tspacer / 2) {
                execs = execs.filter((a) => a.batchId !== exec.batchId);
                ns.print(
                    ns.sprintf(
                        "WARNING: %s:%s #%d start time was off by %dms (limit is +- %d) and the batch was canceled s: %s c: %s",
                        exec.target,
                        exec.script,
                        exec.batchId,
                        curTOffset - exec.delay,
                        this.tspacer / 2,
                        stFormat(ns, exec.delay, true),
                        stFormat(ns, curTOffset, true)
                    )
                );
                continue;
            }

            let finishTOffset = curTOffset;
            if (exec.script === WEAKENNS) finishTOffset += ns.getWeakenTime(exec.target);
            if (exec.script === GROWNS) finishTOffset += ns.getGrowTime(exec.target);
            if (exec.script === HACKNS) finishTOffset += ns.getHackTime(exec.target);

            let finishDiff = Math.abs(finishTOffset - exec.finish);
            if (finishDiff > this.tspacer / 2) {
                execs = execs.filter((a) => a.batchId !== exec.batchId);
                ns.print(
                    ns.sprintf(
                        "WARNING: %s:%s #%d finish time was off by %dms (limit is +- %d) and the batch was canceled  e: %s c: %s",
                        exec.target,
                        exec.script,
                        exec.batchId,
                        finishTOffset - exec.finish,
                        this.tspacer / 2,
                        stFormat(ns, exec.finish, true),
                        stFormat(ns, finishTOffset, true)
                    )
                );
                continue;
            }

            let pid = ns.exec(exec.script, exec.host, exec.threads, exec.target, exec.pos, startTime);
            if (waitPIDFinishTime < exec.finish) {
                this.waitPID = pid;
                waitPIDFinishTime = exec.finish;
            }
        }
    }

    resetThreads() {
        this.host.reset();
    }

    /** @param {import(".").NS } ns */
    isWRunning(ns) {
        if (this.simEnabled) return false;
        if (this.waitPID === 0) return false;

        if (ns.getRunningScript(this.waitPID)) {
            return true;
        }

        this.waitPID = 0;
        return false;
    }
}
