import { stFormat, stdFormat } from "./util.js";

export const TSPACER = 400;
export const WEAKENNS = "weaken.js";
export const GROWNS = "grow.js";
export const HACKNS = "hack.js";

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

    getReservedThreads() {
        return this.reservedScriptCalls.reduce((a, b) => a + b.threads, 0);
    }

    getAvailableThreads() {
        return this.reservedScriptCalls.reduce((a, b) => a - b.threads, this.maxThreads);
    }

    // return # of threads successfully allocated
    tryReserveThreads(ns, script, threads, offset, length, batchId) {
        let allocateThreads = Math.min(this.getAvailableThreads(), threads);

        if (allocateThreads === 0) return allocateThreads;

        this.reservedScriptCalls.push({
            script: script,
            threads: allocateThreads,
            offset: offset,
            length: length,
            batchId: batchId,
        });

        return allocateThreads;
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

function generateHosts(ns, hostnames, threadSize) {
    let hosts = [];
    let maxThreads = 0;
    if (hostnames)
        hosts = hostnames
            .map((x) => new Host(ns, x, threadSize))
            .filter((x) => x.maxThreads > 0)
            .sort((a, b) => b.maxThreads - a.maxThreads);

    hosts.map((x) => (maxThreads += x.maxThreads));

    // Too many threads causes problems
    maxThreads = Math.min(1000000, maxThreads);

    return [hosts, maxThreads];
}

function getMaxThreads(ns, hosts) {
    let maxThreads = 0;
    hosts.map((x) => (maxThreads += x.getMaxThreads(ns)));

    // Too many threads causes problems
    maxThreads = Math.min(1000000, maxThreads);

    return maxThreads;
}

function reserveThreadsForExecution(ns, hosts, script, threads, offset, length, batchId) {
    let unallocatedThreads = threads;
    for (const host of hosts) {
        unallocatedThreads -= host.tryReserveThreads(ns, script, unallocatedThreads, offset, length, batchId);
        if (unallocatedThreads === 0) {
            return true;
        }
    }

    ns.tprintf("WARNING: Only able to allocate %d/%d %s threads", threads - unallocatedThreads, threads, script);
    return false;
}

export class SmartHackEnv {
    /** @param {import(".").NS } ns */
    constructor(ns, targetname, hostnames) {
        this.targetname = targetname;
        this.highMoney = ns.getServerMaxMoney(this.targetname);
        this.lowMoney = ns.getServerMaxMoney(this.targetname) * 0.5;
        this.tspacer = TSPACER; // CONST

        this.weakenRam = ns.getScriptRam(WEAKENNS);
        this.growRam = ns.getScriptRam(GROWNS);
        this.hackRam = ns.getScriptRam(HACKNS);
        this.threadSize = Math.max(this.weakenRam, this.growRam, this.hackRam);

        this.cores = 1; // Simplify
        [this.hosts, this.maxThreads] = generateHosts(ns, hostnames, this.threadSize);

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

        this.primaryStats = {
            primaryThreadsTotal: 0,
            primaryGrowThreads: 0,
            primaryWeakenThreads: 0,
        };

        // Simulator Info
        this.simEnabled = false;
        this.simTarget = ns.getServer(this.targetname);
        this.simPlayer = ns.getPlayer();
    }

    async init(ns, force = false) {
        for (const host of this.hosts) {
            await host.prep(ns, force);
        }
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
        this.maxThreads = getMaxThreads(ns, this.hosts);

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

        if (!cycleTarget) {
            ns.tprintf(
                "ERROR: Encountered a bad cycle target, targeting %s, [0]%s [1]%s",
                this.targetname,
                allCycles[0],
                allCycles[1]
            );

            this.hackTotal = 0;
            this.hackThreads = 0;
            this.growThreads = 0;
            this.weakenHackThreads = 0;
            this.weakenGrowThreads = 0;
            this.cycleTotal = 1;
            this.cycleBatchTime = this.weakenTime;
            this.primaryStats = {
                primaryThreadsTotal: primaryThreadsTotal,
                primaryGrowThreads: primaryGrowThreads,
                primaryWeakenThreads: primaryWeakenThreads,
            };

            return false;
        }

        this.hackTotal = cycleTarget.hackTotal;
        this.hackThreads = cycleTarget.hackThreads;
        this.growThreads = cycleTarget.growThreads;
        this.weakenHackThreads = cycleTarget.weakenHackThreads;
        this.weakenGrowThreads = cycleTarget.weakenGrowThreads;
        this.cycleTotal = cycleTarget.cycleTotal;
        this.cycleBatchTime = cycleTarget.fullCycleTime;
        this.primaryStats = {
            primaryThreadsTotal: primaryThreadsTotal,
            primaryGrowThreads: primaryGrowThreads,
            primaryWeakenThreads: primaryWeakenThreads,
        };

        // dont do thread reservation and execution if this is a simulation
        if (this.simEnabled) return true;

        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        if (primaryThreadsTotal > 0) {
            if (primaryGrowThreads > 0)
                reserveThreadsForExecution(
                    ns,
                    this.hosts,
                    GROWNS,
                    primaryGrowThreads,
                    growOffsetTime,
                    this.growTime,
                    0
                );
            if (primaryWeakenThreads > 0)
                reserveThreadsForExecution(
                    ns,
                    this.hosts,
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
            reserveThreadsForExecution(
                ns,
                this.hosts,
                HACKNS,
                this.hackThreads,
                cycleOffsetTime + hackOffsetTime,
                this.hackTime,
                i
            );
            reserveThreadsForExecution(
                ns,
                this.hosts,
                GROWNS,
                this.growThreads,
                cycleOffsetTime + growOffsetTime,
                this.growTime,
                i
            );
            reserveThreadsForExecution(
                ns,
                this.hosts,
                WEAKENNS,
                this.weakenHackThreads,
                cycleOffsetTime,
                this.weakenTime,
                i
            );
            reserveThreadsForExecution(
                ns,
                this.hosts,
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

        this.logStats(ns);

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
                "%3d;%s  %9s/s %5.2f %d/%4d/%5d %6dGB, %s|%s|%s|%s",
                cycle.cycleTotal,
                this.targetname,
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

    logStats(ns) {
        if (this.primaryStats.primaryThreadsTotal > 0) {
            ns.print(
                ns.sprintf(
                    "%8s SMART-PRIMARY: %s => Grow %d; Weaken %d; Total Threads %d",
                    new Date().toLocaleTimeString("it-IT"),
                    this.targetname,
                    this.primaryStats.primaryGrowThreads,
                    this.primaryStats.primaryWeakenThreads,
                    this.primaryStats.primaryThreadsTotal
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
                stdFormat(ns, this.cycleBatchTime, true),
                stFormat(ns, this.cycleBatchTime - this.weakenTime, true)
            )
        );
    }

    /** @param {import(".").NS } ns */
    async execute(ns) {
        let execs = [];
        for (const host of this.hosts) {
            for (const scriptCall of host.reservedScriptCalls) {
                execs.push({
                    script: scriptCall.script,
                    host: host.hostname,
                    threads: scriptCall.threads,
                    target: this.targetname,
                    delay: scriptCall.offset,
                    pos: execs.length,
                    finish: scriptCall.offset + scriptCall.length,
                    batchId: scriptCall.batchId,
                });
            }
        }

        execs = execs.sort((a, b) => b.delay - a.delay);

        // for (const exec of execs) {
        //     ns.tprintf(
        //         "%20s:%02d-%9s %4d %s %s",
        //         exec.host,
        //         exec.batchId,
        //         exec.script,
        //         exec.threads,
        //         stFormat(ns, exec.delay),
        //         stFormat(ns, exec.finish)
        //     );
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
            if (waitPIDFinishTime <= exec.finish) {
                this.waitPID = pid;
                waitPIDFinishTime = exec.finish;
            }
        }
    }

    resetThreads() {
        for (const host of this.hosts) {
            host.reset();
        }
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

    resetSim(ns) {
        this.simTarget = ns.getServer(this.targetname);
        this.simPlayer = ns.getPlayer();
    }

    /** @param {import(".").NS } ns */
    async fastSim(ns, time) {
        this.resetSim(ns);
        this.simEnabled = true;

        let simIncome = 0;
        let simTime = 0;
        let simState = 0; // 0: primary, 1: no-primary

        while (true) {
            if (simState === 0) {
                await this.refresh(ns);
                if (simTime + this.cycleBatchTime > time) break;

                if (this.primaryStats.primaryThreadsTotal === 0) this.simState = 1;

                simIncome += this.hackTotal * (this.cycleTotal - 1);
                simTime += this.cycleBatchTime;
            } else {
                let timeRemaining = time - simTime;
                let cyclesRemaining = Math.floor(timeRemaining / this.cycleBatchTime);

                simIncome += this.hackTotal * this.cycleTotal * cyclesRemaining;
                simTime += this.cycleBatchTime * cyclesRemaining;

                break;
            }
        }

        this.simEnabled = false;

        if (simTime === 0) {
            ns.tprintf("%s - %s", this.targetname, stFormat(ns, this.cycleBatchTime));
            return 0;
        }

        return simIncome / (simTime / 1000);
    }
}
