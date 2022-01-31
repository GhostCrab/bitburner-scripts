export const debug = false;
export const TSPACER = 100;
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
    tryReserveThreads(ns, script, threads, offset) {
        let reservedThreadCount = this.getReservedThreadCount();

        if (reservedThreadCount === this.maxThreads) return 0;

        let newThreadCount = Math.min(this.maxThreads - reservedThreadCount, threads);
        this.reservedScriptCalls.push({ script: script, threads: newThreadCount, offset: offset });

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

        return this.maxThreads;
        //return (this.maxThreads = 2859);
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

    hackAnalyze(ns) {
        if (this.simEnabled) return ns.formulas.hacking.hackPercent(this.simTarget, this.simPlayer);

        return ns.hackAnalyze(this.targetname);
    }

    /** @param {import(".").NS } ns */
    calcGrowThreads(ns, _growMult) {
        let growMult = _growMult !== undefined ? _growMult : this.growMult;
        if (growMult <= 1) return 0;
        let growThreads = Math.ceil(ns.growthAnalyze(this.targetname, growMult, this.cores));

        // growThreads in a simulation will probably overshoot because the actual security is too high.
        // start with the bad estimate and reduce grow threads until the result from growPercent is less
        // than growMult, then increase it back by 1
        if (this.simEnabled) {
            while (
                ns.formulas.hacking.growPercent(this.simTarget, --growThreads, this.simPlayer, this.cores) > growMult
            );

            // correct overshoot
            growThreads++;
        }
        return growThreads;
    }

    /** @param {import(".").NS } ns */
    async refresh(ns) {
        if (this.isWRunning(ns)) {
            // process in progress, wait for next refresh to update
            await ns.sleep(1000);
            return;
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
        this.hackPercentPerThread = this.hackAnalyze(ns);
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

        if (primaryThreadsTotal > this.maxThreads) {
            ns.tprintf("ERROR: Unable to allocate enough threads to primary cycle, use super_hack_adv algorithm");
            return false;
        }

        let allCycles = [];
        //let cycleStep = Math.max(Math.floor(this.cycleMax / 10), 1)
        let cycleStep = 1;
        for (let cycleTotal = 1; cycleTotal <= this.cycleMax; cycleTotal += cycleStep) {
            if (cycleTotal === 1 && primaryThreadsTotal > 0) {
                allCycles.push({
                    cycleTotal: cycleTotal,
                    production: 1,
                });
                continue;
            }

            let usableThreads = this.maxThreads - primaryThreadsTotal;
            let usableCycles = primaryThreadsTotal > 0 ? cycleTotal - 1 : cycleTotal;

            let cycleThreadAllowance = Math.floor(usableThreads / usableCycles);

            let hackThreads = Math.floor(1 / this.hackPercentPerThread - 1);
            //let hackThreadStep = Math.max(Math.floor(hackThreads / 25), 1);
            let hackThreadStep = 1;
            let hackTotal = this.hackPercentPerThread * hackThreads * this.highMoney;
            let hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);

            let growMult = Math.max(this.highMoney / (this.highMoney - hackTotal), 1);
            let growThreads = this.calcGrowThreads(ns, growMult);
            let growSecIncrease = ns.growthAnalyzeSecurity(growThreads);

            let weakenHackThreads = Math.ceil(hackSecIncrease / this.weakenAmountPerThread);
            let weakenGrowThreads = Math.ceil(growSecIncrease / this.weakenAmountPerThread);

            let totalThreads = hackThreads + weakenHackThreads + growThreads + weakenGrowThreads;

            while (totalThreads > cycleThreadAllowance) {
                hackThreads -= hackThreadStep;

                if (hackThreads <= 0) break;

                hackTotal = this.hackPercentPerThread * hackThreads * this.highMoney;
                hackSecIncrease = ns.hackAnalyzeSecurity(hackThreads);

                growMult = Math.max(this.highMoney / (this.highMoney - hackTotal), 1);
                growThreads = this.calcGrowThreads(ns, growMult);
                growSecIncrease = ns.growthAnalyzeSecurity(growThreads);

                weakenHackThreads = Math.ceil(hackSecIncrease / this.weakenAmountPerThread);
                weakenGrowThreads = Math.ceil(growSecIncrease / this.weakenAmountPerThread);

                totalThreads = hackThreads + weakenHackThreads + growThreads + weakenGrowThreads;
            }

            if (hackThreads <= 0) {
                allCycles.push({
                    cycleTotal: cycleTotal,
                    production: 0,
                });

                continue;
            }

            let fullCycleTime = this.cycleFullTime + this.cycleSpacer * (cycleTotal - 1);

            allCycles.push({
                cycleTotal: cycleTotal,
                production: (usableCycles * hackTotal) / (fullCycleTime / 1000),
                fullCycleTime: fullCycleTime,
                hackThreads: hackThreads,
                growThreads: growThreads,
                weakenHackThreads: weakenHackThreads,
                weakenGrowThreads: weakenGrowThreads,
                percentPerCycle: (hackTotal / ns.getServerMaxMoney(this.targetname)) * 100,
            });
        }

        allCycles = allCycles.sort((a, b) => b.production - a.production);

        for (const cycle of allCycles) {
            break;
            let batchThreads =
                cycle.hackThreads + cycle.growThreads + cycle.weakenHackThreads + cycle.weakenGrowThreads;
            if (cycle.hackThreads === undefined) batchThreads = 0;
            let cycleThreads = primaryThreadsTotal + batchThreads * (cycle.cycleTotal - 1);
            if (primaryThreadsTotal === 0) {
                cycleThreads = batchThreads * cycle.cycleTotal;
            }
            let cycleMem = cycleThreads * this.threadSize;
            ns.tprintf(
                "%3d  %9s/s %5.2f %d/%4d/%5d %6dGB",
                cycle.cycleTotal,
                ns.nFormat(cycle.production, "($0.000a)"),
                cycle.percentPerCycle ? cycle.percentPerCycle : 0,
                primaryThreadsTotal,
                batchThreads,
                cycleThreads,
                cycleMem
            );
        }

        let cycleTarget = allCycles[0];
        this.hackThreads = cycleTarget.hackThreads;
        this.growThreads = cycleTarget.growThreads;
        this.weakenHackThreads = cycleTarget.weakenHackThreads;
        this.weakenGrowThreads = cycleTarget.weakenGrowThreads;
        this.cycleTotal = cycleTarget.cycleTotal;
        this.cycleBatchTime = cycleTarget.fullCycleTime;

        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        if (primaryThreadsTotal > 0) {
            if (primaryGrowThreads > 0)
                this.host.tryReserveThreads(ns, GROWNS, primaryGrowThreads, growOffsetTime);
            if (primaryWeakenThreads > 0)
                this.host.tryReserveThreads(ns, WEAKENNS, primaryWeakenThreads, weakenGrowOffsetTime);

            ns.print(
                ns.sprintf(
                    "%8s SMART-PRIMARY: %s => Grow %d; Weaken %d; Total Threads %d",
                    new Date().toLocaleTimeString("it-IT"),
                    this.targetname,
                    primaryGrowThreads,
                    primaryWeakenThreads,
                    primaryThreadsTotal
                )
            );
        }

        for (let i = 0; i < this.cycleTotal; i++) {
            if (primaryThreadsTotal > 0 && i === 0) continue;
            let cycleOffsetTime = i * this.cycleSpacer;
            this.host.tryReserveThreads(ns, HACKNS, this.hackThreads, cycleOffsetTime + hackOffsetTime);
            this.host.tryReserveThreads(ns, GROWNS, this.growThreads, cycleOffsetTime + growOffsetTime);
            this.host.tryReserveThreads(ns, WEAKENNS, this.weakenHackThreads, cycleOffsetTime);
            this.host.tryReserveThreads(ns, WEAKENNS, this.weakenGrowThreads, cycleOffsetTime + weakenGrowOffsetTime);
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

        ns.print(
            ns.sprintf(
                "%8s SMART: %s => Hack %d; Grow %d; Hack/Grow Weaken %d/%d; Total Threads %d/%d; Total Cycles %d/%d; Time +%s:+%s [%s:%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.hackThreads,
                this.growThreads,
                this.weakenHackThreads,
                this.weakenGrowThreads,
                this.threadsPerCycle,
                this.threadsPerCycle * this.cycleTotal,
                this.cycleTotal,
                this.cycleMax,
                stFormat(ns, this.weakenTime),
                stFormat(ns, this.cycleBatchTime),
                stdFormat(ns, this.weakenTime),
                stdFormat(ns, this.cycleBatchTime)
            )
        );

        await this.execute(ns);
        this.resetThreads();
    }

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
            });
        }

        execs = execs.sort((a, b) => a.delay - b.delay);

        let startTime = Date.now();
        for (let exec of execs) {
            while (Date.now() - startTime < exec.delay) await ns.sleep(20);

            ns.exec(exec.script, exec.host, exec.threads, exec.target, exec.pos, startTime);
        }
    }

    resetThreads() {
        this.host.reset();
    }

    /** @param {import(".").NS } ns */
    isWRunning(ns) {
        if (this.simEnabled) return false;

        let ps = ns.ps(this.host.hostname);
        for (let psInfo of ps) {
            if (psInfo.filename === WEAKENNS && psInfo.args.includes(this.targetname)) {
                return true;
            }
        }

        return false;
    }

    /** @param {import(".").NS } ns */
    fastSim(ns, time) {
        this.resetSim(ns);
        this.simEnabled = true;

        this.updateForW(ns);
        while (!this.doneWeaken(ns)) {
            this.simTarget.hackDifficulty -= this.weakenThreads * this.weakenAmountPerThread;
            this.simTarget.hackDifficulty = Math.max(
                this.simTarget.hackDifficulty,
                ns.getServerMinSecurityLevel(this.targetname)
            );

            this.simTime += this.weakenTime + this.tspacer;

            // ns.print(ns.sprintf(
            //     "WEAKEN: Fast Sim Time: %s (%s + %s)",
            //     ns.tFormat(this.simTime, true),
            //     ns.tFormat(this.weakenTime, true),
            //     ns.tFormat(this.tspacer, true)
            // );

            if (this.simTime > time) return this.simIncome;
        }

        this.updateForGW(ns);
        let simGrowMult = ns.formulas.hacking.growPercent(this.simTarget, this.growThreads, this.simPlayer, this.cores);
        while (!this.doneGrow(ns)) {
            this.simTarget.moneyAvailable *= simGrowMult;
            this.simTarget.moneyAvailable = Math.min(
                this.simTarget.moneyAvailable,
                ns.getServerMaxMoney(this.targetname)
            );

            this.simTime += this.weakenTime + this.tspacer;
            this.simTarget.hackDifficulty = this.simTarget.minDifficulty;

            // ns.print(ns.sprintf(
            //     "GROW-WEAKEN: Fast Sim Time: %s (%s + %s)",
            //     ns.tFormat(this.simTime, true),
            //     ns.tFormat(this.weakenTime, true),
            //     ns.tFormat(this.tspacer, true)
            // );

            if (this.simTime > time) return this.simIncome;
        }

        this.updateForHW(ns);
        let hwTotal = this.hackTotal;
        let hwTime = this.weakenTime * 2 + this.tspacer * 2;
        let hwIncome = hwTotal / hwTime;
        this.updateForHGW(ns);
        let hgwTotal = this.hackTotal * this.cycleTotal;
        let hgwTime = this.cycleBatchTime + this.tspacer;
        let hgwIncome = hgwTotal / hgwTime;

        let timeRemaining = time - this.simTime;
        let hackCycles = 0;
        if (hwIncome > hgwIncome) {
            hackCycles = Math.floor(timeRemaining / hwTime);
            this.simTime += hackCycles * hwTime;
            this.simIncome += hackCycles * hwTotal;

            // ns.print(ns.sprintf(
            //     "HACK-WEAKEN: Fast Sim Time: %s; Fast Sim Income: %s (%s/s); Fast Sim Hack Cycles: %d; Cycle Time: %s",
            //     ns.tFormat(this.simTime, true),
            //     ns.nFormat(this.simIncome, "($0.000a)"),
            //     ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)"),
            //     hackCycles,
            //     ns.tFormat(hwTime, true)
            // );
        } else {
            hackCycles = Math.ceil(timeRemaining / hgwTime);
            this.simTime += hackCycles * hgwTime;
            this.simIncome += hackCycles * hgwTotal;

            // ns.print(ns.sprintf(
            //     "HACK-GROW-WEAKEN: Fast Sim Time: %s; Fast Sim Income: %s (%s/s); Fast Sim Hack Cycles: %d; Cycle Time: %s",
            //     ns.tFormat(this.simTime, true),
            //     ns.nFormat(this.simIncome, "($0.000a)"),
            //     ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)"),
            //     hackCycles,
            //     ns.tFormat(hgwTime, true)
            // );
        }

        return this.simIncome / (this.simTime / 1000);
    }
}
