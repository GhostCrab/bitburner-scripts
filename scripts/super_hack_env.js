export const debug = true;
export const TSPACER = 50;
export const WEAKENNS = "weaken.js";
export const GROWNS = "grow.js";
export const HACKNS = "hack.js";

export const HackState = {
    UNSET: "UNDEFINED STATE",
    W: "Weaken",
    GW: "Grow and Weaken",
    HW: "Hack and Weaken",
    HGW: "Hack, Grow, and Weaken",
};

class Host {
    /** @param {import(".").NS } ns */
    constructor(ns, hostname, threadSize) {
        this.hostname = hostname;
        this.threadSize = threadSize;
        this.maxThreads = Math.floor(ns.getServerMaxRam(this.hostname) / this.threadSize);
        this.reservedScriptCalls = [];

        // if this host is home, reserve 64GB of ram for other stuff
        if (this.hostname === "home") {
            let homeram = ns.getServerMaxRam(this.hostname) - 64;
            this.maxThreads = Math.max(0, Math.floor(homeram / this.threadSize));
        }
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

    /** @param {import(".").NS } ns */
    executeScripts(ns, target) {
        for (const scriptCall of this.reservedScriptCalls) {
            ns.exec(scriptCall.script, this.hostname, scriptCall.threads, target, scriptCall.offset);
        }
    }

    async prep(ns, force = false) {
        if (force || !ns.fileExists(GROWNS, this.hostname)) await ns.scp(GROWNS, "home", this.hostname);
        if (force || !ns.fileExists(WEAKENNS, this.hostname)) await ns.scp(WEAKENNS, "home", this.hostname);
        if (force || !ns.fileExists(HACKNS, this.hostname)) await ns.scp(HACKNS, "home", this.hostname);
    }
}

export class SuperHackEnv {
    /** @param {import(".").NS } ns */
    constructor(ns, targetname, hostnames) {
        this.targetname = targetname;
        this.highMoney = ns.getServerMaxMoney(this.targetname);
        this.lowMoney = ns.getServerMaxMoney(this.targetname) * 0.5;
        this.tspacer = TSPACER; // CONST

        this.cores = 1; // Simplify

        this.weakenRam = ns.getScriptRam(WEAKENNS);
        this.growRam = ns.getScriptRam(GROWNS);
        this.hackRam = ns.getScriptRam(HACKNS);
        this.threadSize = Math.max(this.weakenRam, this.growRam, this.hackRam);

        this.updateHosts(ns, hostnames);

        // Target Info
        this.targetSec = 0;
        this.targetSecMin = 0;
        this.targetMoneyAvailable = 0;

        // Weaken Info
        this.weakenStartSec = 0;
        this.weakenAmountPerThread = 0;
        this.weakenThreads = 0;
        this.weakenThreadsGrow = 0;
        this.weakenThreadsHack = 0;
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
        this.hackTotalEst = 0;
        this.hackTotal = 0;
        this.hackThreads = 0;
        this.hackSecIncrease = 0;
        this.hackTime = 0;
        this.hackPercentPerThread = 0;

        // Batch Cycle Info
        this.threadsPerCycle = 0;
        this.cycleSpacer = this.tspacer * 4;
        this.cycleFullTime = 0; // this.weakenTime + this.tspacer * 2;
        this.cycleFitTime = 0; // this.weakenTime - this.tspacer
        this.cycleMax = 0; // Math.floor(this.cycleFitTime / this.cycleSpacer)
        this.cycleTotal = 0;
        this.cycleBatchTime = 0; // this.cycleFullTime + this.cycleSpacer * this.cycleTotal

        // State Info
        this.state = HackState.UNSET;

        // Simulator Info
        this.simEnabled = false;
        this.simHost = ns.getServer(this.hostname);
        this.simTarget = ns.getServer(this.targetname);
        this.simPlayer = ns.getPlayer();
        this.simTime = 0;
        this.simIncome = 0;
        this.simForceState = HackState.UNSET;
    }

    updateHosts(ns, hostnames) {
        if (hostnames)
            this.hosts = hostnames
                .map((x) => new Host(ns, x, this.threadSize), this)
                .filter((x) => x.maxThreads > 0)
                .sort((a, b) => b.maxThreads - a.maxThreads);

        this.maxThreads = 0;
        this.hosts.map((x) => (this.maxThreads += x.maxThreads), this);

        // if (debug) {
        //     this.hosts.map((x) => ns.tprintf("  %32s: %d", x.hostname, x.maxThreads));
        //     ns.tprintf("Max Threads: %d", this.maxThreads);
        // }
    }

    async init(ns, force = false) {
        for (const host of this.hosts) await host.prep(ns, force);
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

    saveSim(ns) {
        this.savedSimInfo = {
            simEnabled: this.simEnabled,
            simHost: this.simHost,
            simTarget: this.simTarget,
            simPlayer: this.simPlayer,
            simTime: this.simTime,
            simIncome: this.simIncome,
            simForceState: this.simForceState,
        };
    }

    loadSim(ns) {
        if (this.savedSimInfo) {
            this.simEnabled = this.savedSimInfo.simEnabled;
            this.simHost = this.savedSimInfo.simHost;
            this.simTarget = this.savedSimInfo.simTarget;
            this.simPlayer = this.savedSimInfo.simPlayer;
            this.simTime = this.savedSimInfo.simTime;
            this.simIncome = this.savedSimInfo.simIncome;
            this.simForceState = this.savedSimInfo.simForceState;

            delete this.savedSimInfo;
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
        if (this.simEnabled) return ns.formulas.hacking.weakenTime(this.simTarget, this.simPlayer);

        return ns.getWeakenTime(this.targetname);
    }

    getGrowTime(ns) {
        if (this.simEnabled) return ns.formulas.hacking.growTime(this.simTarget, this.simPlayer);

        return ns.getGrowTime(this.targetname);
    }

    getHackTime(ns) {
        if (this.simEnabled) return ns.formulas.hacking.hackTime(this.simTarget, this.simPlayer);

        return ns.getHackTime(this.targetname);
    }

    hackAnalyze(ns) {
        if (this.simEnabled) return ns.formulas.hacking.hackPercent(this.simTarget, this.simPlayer);

        return ns.hackAnalyze(this.targetname);
    }

    /** @param {import(".").NS } ns */
    calcGrowThreads(ns) {
        let growThreads = Math.ceil(ns.growthAnalyze(this.targetname, this.growMult, this.cores));

        // growThreads in a simulation will probably overshoot because the actual security is too high.
        // start with the bad estimate and reduce grow threads until the result from growPercent is less
        // than growMult, then increase it back by 1
        if (this.simEnabled) {
            while (
                ns.formulas.hacking.growPercent(this.simTarget, --growThreads, this.simPlayer, this.cores) >
                this.growMult
            );

            // correct overshoot
            growThreads++;
        }
        return growThreads;
    }

    /** @param {import(".").NS } ns */
    setState(ns) {
        if (this.isWRunning(ns)) {
            // Process is running on this target, dont update the state
            return;
        }

        if (!this.doneWeaken(ns)) {
            this.state = HackState.W;
            this.weakenStartSec = this.getServerSecurityLevel(ns);
        } else if (!this.doneGrow(ns)) {
            this.state = HackState.GW;
            this.growStartMoney = this.getServerMoneyAvailable(ns);
        } else {
            this.hackStartMoney = this.getServerMoneyAvailable(ns);

            if (this.simForceState !== HackState.UNSET) {
                this.state = this.simForceState;

                if (this.state === HackState.HGW)
                    // force skips the hgw update, so do it here
                    this.updateForHGW(ns);
                return;
            }

            this.updateForHW(ns);
            let hwIncome = this.hackTotal / ((this.weakenTime * 2) / 1000); // weaken time * 2 to account for grow cycle
            this.updateForHGW(ns);
            let hgwIncome = (this.hackTotal * this.cycleTotal) / (this.cycleFullTime / 1000);

            if (hwIncome > hgwIncome) this.state = HackState.HW;
            else this.state = HackState.HGW;
        }
    }

    /** @param {import(".").NS } ns */
    refresh(ns) {
        if (this.isWRunning(ns)) {
            // process in progress, wait for next refresh to update
            return;
        }

        this.setState(ns);
        switch (this.state) {
            case HackState.W:
                this.updateForW(ns);
                this.execW(ns);
                break;
            case HackState.GW:
                this.updateForGW(ns);
                this.execGW(ns);
                break;
            case HackState.HW:
                this.updateForHW(ns);
                this.execHW(ns);
                break;
            case HackState.HGW:
                // setState calls updateForHGW() to do evaluation, dont call it again here
                //this.updateForHGW(ns);
                this.execHGW(ns);
                break;
            default:
            // Do Nothing
        }

        if (debug) {
            switch (this.state) {
                case HackState.W:
                    ns.tprintf(
                        "WEAKEN: %s => Lowered Security from %.2f to %.2f (min: %.2f); Total Threads %d",
                        this.targetname,
                        this.weakenStartSec,
                        this.getServerSecurityLevel(ns),
                        ns.getServerMinSecurityLevel(this.targetname),
                        this.threadsPerCycle
                    );
                    break;
                case HackState.GW:
                    ns.tprintf(
                        "GROW-WEAKEN: %s => Grow %d; Weaken %d; Total Threads %d",
                        this.targetname,
                        this.growThreads,
                        this.weakenThreadsGrow,
                        this.threadsPerCycle
                    );
                    ns.tprintf(
                        "GROW-WEAKEN: %s => Increased available money from %s to %s/%s [Sec: %.2f]",
                        this.targetname,
                        ns.nFormat(this.growStartMoney, "($0.000a)"),
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(this.highMoney, "($0.000a)"),
                        this.getServerSecurityLevel(ns)
                    );
                    break;
                case HackState.HW:
                    let totalHack = this.hackStartMoney - this.getServerMoneyAvailable(ns);
                    ns.tprintf(
                        "HACK-WEAKEN: %s => Hack %d; Weaken %d; Total Threads %d",
                        this.targetname,
                        this.hackThreads,
                        this.weakenThreadsHack,
                        this.threadsPerCycle
                    );
                    ns.tprintf(
                        "HACK-WEAKEN: %s => Decreased available money from %s to %s; %s Total (%.2f%% of max) [Sec: %.2f]",
                        this.targetname,
                        ns.nFormat(this.hackStartMoney, "($0.000a)"),
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(totalHack, "($0.000a)"),
                        (totalHack / ns.getServerMaxMoney(this.targetname)) * 100,
                        this.getServerSecurityLevel(ns)
                    );
                    break;
                case HackState.HGW:
                    ns.tprintf(
                        "HACK-GROW-WEAKEN: %s => Hack %d; Grow %d; Hack/Grow Weaken %d/%d; Total Threads %d/%d; Total Cycles %d/%d",
                        this.targetname,
                        this.hackThreads,
                        this.growThreads,
                        this.weakenThreadsHack,
                        this.weakenThreadsGrow,
                        this.threadsPerCycle,
                        this.threadsPerCycle * this.cycleTotal,
                        this.cycleTotal,
                        this.cycleMax
                    );
                    ns.tprintf(
                        "HACK-GROW-WEAKEN: %s => Cycle Complete; %s Available; Hacked %s (%.2f%% of max) [Sec: %.2f]",
                        this.targetname,
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(this.hackTotal, "($0.000a)"),
                        (this.hackTotal / ns.getServerMaxMoney(this.targetname)) * 100,
                        this.getServerSecurityLevel(ns)
                    );
                    break;
                default:
                    // Do Nothing
                    break;
            }
        }
    }

    doneWeaken(ns) {
        return this.getServerSecurityLevel(ns) - 0.01 <= ns.getServerMinSecurityLevel(this.targetname);
    }

    doneGrow(ns) {
        return this.getServerMoneyAvailable(ns) + 100 >= this.highMoney;
    }

    /** @param {import(".").NS } ns */
    updateForW(ns) {
        // Target Info
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreads = this.maxThreads;

        this.threadsPerCycle = this.weakenThreads;

        // return true if this cycle will fully weaken the target
        return this.weakenThreads * this.weakenAmountPerThread >= secDiff;
    }

    /** @param {import(".").NS } ns */
    updateForGW(ns) {
        // Target Info
        this.targetMoneyAvailable = this.getServerMoneyAvailable(ns);
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Grow Info
        this.growTime = this.getGrowTime(ns);
        this.growMult = this.highMoney / this.targetMoneyAvailable;
        let growThreadsFull = this.calcGrowThreads(ns);
        this.growThreads = this.maxThreads;
        this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreadsGrow = Math.ceil((this.growSecIncrease + secDiff) / this.weakenAmountPerThread);

        this.threadsPerCycle = this.growThreads + this.weakenThreadsGrow;

        while (this.threadsPerCycle > this.maxThreads) {
            this.growThreads--;
            this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);
            this.weakenThreadsGrow = Math.ceil((this.growSecIncrease + secDiff) / this.weakenAmountPerThread);
            this.threadsPerCycle = this.growThreads + this.weakenThreadsGrow;
        }

        // Returning true if this grow cycle will max out the target server
        return this.growThreads >= growThreadsFull;
    }

    /** @param {import(".").NS } ns */
    updateForHW(ns) {
        // Find out how much money I can gain back in a single GW cycle and never hack more than that
        this.updateForGW(ns); // to set this.growThreads
        this.growMult = ns.formulas.hacking.growPercent(
            ns.getServer(this.targetname),
            this.growThreads,
            ns.getPlayer(),
            this.cores
        );

        // Target Info
        this.targetMoneyAvailable = this.getServerMoneyAvailable(ns);
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Hack Info
        this.hackTime = this.getHackTime(ns);
        this.hackPercentPerThread = this.hackAnalyze(ns);
        this.hackTotalEst = this.targetMoneyAvailable - this.lowMoney;
        let hackThreadsFull = Math.ceil(ns.hackAnalyzeThreads(this.targetname, this.hackTotalEst));
        this.hackThreads = this.maxThreads;
        this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
        if (this.hackTotal >= this.targetMoneyAvailable) {
            this.hackThreads = 1 / this.hackPercentPerThread - 1;
            this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
        }
        this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);

        // Grow Info
        let growRecoveryMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);

        this.threadsPerCycle = this.hackThreads + this.weakenThreadsHack;

        while (this.threadsPerCycle > this.maxThreads || growRecoveryMult > this.growMult) {
            this.hackThreads--;
            this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
            growRecoveryMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
            this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);
            this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);
            this.threadsPerCycle = this.hackThreads + this.weakenThreadsHack;
        }

        // Returning true if this hack cycle will bottom out the target server
        return this.hackThreads >= hackThreadsFull;
    }

    /** @param {import(".").NS } ns */
    updateForHGW(ns) {
        console.time(`updateForHGW ${this.targetname}`);
        console.time(`updateForHGW PRE ${this.targetname}`);
        // Target Info
        this.targetMoneyAvailable = this.getServerMoneyAvailable(ns);
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Hack Info
        this.hackTime = this.getHackTime(ns);
        this.hackPercentPerThread = this.hackAnalyze(ns);
        this.hackTotalEst = this.targetMoneyAvailable - this.lowMoney;
        let hackThreadsFull = Math.ceil(ns.hackAnalyzeThreads(this.targetname, this.hackTotalEst));
        this.hackThreads = this.maxThreads;
        this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
        if (this.hackTotal >= this.targetMoneyAvailable) {
            this.hackThreads = 1 / this.hackPercentPerThread - 1;
            this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
        }
        this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);

        // Grow Info
        this.growTime = this.getGrowTime(ns);
        this.growMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
        this.growThreads = this.calcGrowThreads(ns);
        this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);
        this.weakenThreadsGrow = Math.ceil(this.growSecIncrease / this.weakenAmountPerThread);

        // Cycle Info
        this.cycleFullTime = this.weakenTime + this.tspacer * 2;
        this.cycleFitTime = this.weakenTime - this.tspacer * 2; // Start hack start script on last cycle before this time
        let hackStartTime = this.weakenTime - this.hackTime - this.tspacer;
        this.cycleMax = Math.floor((this.cycleFitTime - hackStartTime) / this.cycleSpacer) + 1;

        this.threadsPerCycle = this.hackThreads + this.weakenThreadsHack + this.growThreads + this.weakenThreadsGrow;
        console.timeEnd(`updateForHGW PRE ${this.targetname}`);

        let hackReduceCounter = 0;
        let setCycle = function () {
            if (this.cycleTotal <= 0) return 0;
            let cycleThreadAllowance = Math.floor((this.maxThreads / this.cycleTotal) * 100) / 100;

            this.hackThreads = cycleThreadAllowance;
            this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
            if (this.hackTotal >= this.targetMoneyAvailable) {
                this.hackThreads = 1 / this.hackPercentPerThread - 1;
                this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
            }
            this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);

            this.growMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
            this.growThreads = this.calcGrowThreads(ns);
            this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);

            this.weakenThreadsHack = Math.ceil(this.hackSecIncrease / this.weakenAmountPerThread);
            this.weakenThreadsGrow = Math.ceil(this.growSecIncrease / this.weakenAmountPerThread);

            this.threadsPerCycle =
                this.hackThreads + this.weakenThreadsHack + this.growThreads + this.weakenThreadsGrow;

            // attempt to estimate the optimal number of hack threads by reducing the hack thread count
            // by the current ratio of hack threads to grow + weaken threads. Overestimate a little bit
            // and let the reducer take care of the extra.
            if (this.threadsPerCycle > cycleThreadAllowance) {
                //let hackRatio = this.maxThreads * (this.hackThreads / this.threadsPerCycle);
                //this.hackThreads = Math.min(this.maxThreads * hackRatio * 1.1, this.hackThreads);
                this.hackThreads = cycleThreadAllowance * (this.hackThreads / this.threadsPerCycle);
            }

            while (this.threadsPerCycle > cycleThreadAllowance) {
                hackReduceCounter++
                this.hackThreads--;

                if (this.hackThreads <= 0) return 0;

                this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
                this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);
                this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);
                this.growMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
                this.growThreads = this.calcGrowThreads(ns);
                this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);
                this.weakenThreadsGrow = Math.ceil(this.growSecIncrease / this.weakenAmountPerThread);

                this.threadsPerCycle =
                    this.hackThreads + this.weakenThreadsHack + this.growThreads + this.weakenThreadsGrow;
            }

            this.cycleBatchTime = this.cycleFullTime + this.cycleSpacer * this.cycleTotal;
            if (this.cycleTotal === 1) this.cycleBatchTime = this.cycleFullTime;

            return (this.hackTotal * this.cycleTotal) / this.cycleBatchTime;
        }.bind(this);

        let cycleIncomes = new Array(this.cycleMax + 1);

        console.time(`updateForHGW Cycle Max Calc ${this.targetname}`);
        // find first cycle counting down from the top where income > 0, since the algorithm doesnt like
        // flat lines and any cylcle count that results in a ram allocation less than a threshold automatically
        // returns 0
        let cycleMax;
        for (cycleMax = this.cycleMax; cycleMax >= 0; cycleMax--) {
            this.cycleTotal = cycleMax;
            cycleIncomes[cycleMax] = setCycle();

            if (cycleIncomes[cycleMax] > 0) break;
        }
        cycleMax++;

        console.timeEnd(`updateForHGW Cycle Max Calc ${this.targetname}`);

        console.time(`updateForHGW Cycle Target Calc ${this.targetname}`);

        // find local maximum of cycleIncomes
        // target center value,
        //  if value to left of target is larger than target, recenter target to left of current target
        //  if value to right of target is larger than target, recenter target to right of current target
        //  if values to left and right of target are both less than target, keep target
        let cycleMin = 0;
        let cycleTarget = 0;
        let cycleSearch = 0;
        while (true) {
            cycleSearch++;
            cycleTarget = cycleMin + Math.floor((cycleMax - cycleMin) / 2);

            if (cycleTarget === this.cycleMax || cycleTarget === 1) break;

            if (cycleIncomes[cycleTarget - 1] === undefined) {
                this.cycleTotal = cycleTarget - 1;
                cycleIncomes[cycleTarget - 1] = setCycle();
            }
            if (cycleIncomes[cycleTarget] === undefined) {
                this.cycleTotal = cycleTarget;
                cycleIncomes[cycleTarget] = setCycle();
            }
            if (cycleIncomes[cycleTarget + 1] === undefined) {
                this.cycleTotal = cycleTarget + 1;
                cycleIncomes[cycleTarget + 1] = setCycle();
            }

            if (cycleIncomes[cycleTarget] < cycleIncomes[cycleTarget + 1]) {
                cycleMin = cycleTarget;
                continue;
            }

            if (cycleIncomes[cycleTarget] < cycleIncomes[cycleTarget - 1]) {
                cycleMax = cycleTarget;
                continue;
            }

            break;
        }

        this.cycleTotal = cycleTarget;
        setCycle();
        console.log(`${this.targetname} cycleSearch: ${cycleSearch}; hackReduceCounter: ${hackReduceCounter}`);

        console.timeEnd(`updateForHGW Cycle Target Calc ${this.targetname}`);

        console.timeEnd(`updateForHGW ${this.targetname}`);
        return this.cycleTotal === 1 ? this.hackThreads >= hackThreadsFull : true;
    }

    reserveThreadsForExecution(ns, script, threads, offset = 0) {
        let unallocatedThreads = threads;
        for (const host of this.hosts) {
            unallocatedThreads -= host.tryReserveThreads(ns, script, unallocatedThreads, offset);
            if (unallocatedThreads === 0) {
                return true;
            }
        }

        ns.tprintf("WARNING: Only able to allocate %d/%d %s threads", threads - unallocatedThreads, threads, script);
        return false;
    }

    execute(ns) {
        for (const host of this.hosts) {
            host.executeScripts(ns, this.targetname);
        }
    }

    resetThreads() {
        for (const host of this.hosts) {
            host.reset();
        }
    }

    /** @param {import(".").NS } ns */
    execW(ns) {
        if (this.simEnabled) {
            this.simTarget.hackDifficulty -= this.weakenThreads * this.weakenAmountPerThread;
            this.simTarget.hackDifficulty = Math.max(
                this.simTarget.hackDifficulty,
                ns.getServerMinSecurityLevel(this.targetname)
            );

            this.simTime += this.weakenTime;

            ns.tprintf("WEAKEN: Sim Time: %s", ns.tFormat(this.simTime, true));
            return;
        }

        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreads);
        this.execute(ns);
        this.resetThreads();
    }

    /** @param {import(".").NS } ns */
    execGW(ns) {
        if (this.simEnabled) {
            let simGrowMult = ns.formulas.hacking.growPercent(
                this.simTarget,
                this.growThreads,
                this.simPlayer,
                this.cores
            );
            this.simTarget.moneyAvailable *= simGrowMult;
            this.simTarget.moneyAvailable = Math.min(
                this.simTarget.moneyAvailable,
                ns.getServerMaxMoney(this.targetname)
            );

            this.simTarget.hackDifficulty += this.growSecIncrease;
            this.simTarget.hackDifficulty -= this.weakenThreadsGrow * this.weakenAmountPerThread;
            this.simTarget.hackDifficulty = Math.max(
                this.simTarget.hackDifficulty,
                ns.getServerMinSecurityLevel(this.targetname)
            );

            this.simTime += this.weakenTime + this.tspacer;

            ns.tprintf("GROW-WEAKEN: Sim Time: %s", ns.tFormat(this.simTime, true));

            return;
        }

        // start grow such that it finishes slightly before weaken
        let growOffsetTime = this.weakenTime - this.tspacer - this.growTime;
        this.reserveThreadsForExecution(ns, GROWNS, this.growThreads, growOffsetTime);
        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsGrow);
        this.execute(ns);
        this.resetThreads();
    }

    /** @param {import(".").NS } ns */
    execHW(ns) {
        if (this.simEnabled) {
            let hackChance = ns.formulas.hacking.hackChance(this.simTarget, this.simPlayer);
            let hackTotal = 0;

            if (Math.random() <= hackChance) hackTotal = this.hackTotal;

            this.simTarget.moneyAvailable -= hackTotal;

            this.simTarget.hackDifficulty += this.hackSecIncrease;
            this.simTarget.hackDifficulty -= this.weakenThreadsHack * this.weakenAmountPerThread;
            this.simTarget.hackDifficulty = Math.max(
                this.simTarget.hackDifficulty,
                ns.getServerMinSecurityLevel(this.targetname)
            );

            this.simTime += this.weakenTime;
            this.simIncome += hackTotal;

            ns.tprintf(
                "HACK-WEAKEN: Sim Time: %s; Sim Income: %s (%s/s)",
                ns.tFormat(this.simTime, true),
                ns.nFormat(this.simIncome, "($0.000a)"),
                ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)")
            );

            return;
        }

        // start hack such that it finishes slightly before weaken
        let hackOffsetTime = this.weakenTime - this.tspacer - this.hackTime;
        this.reserveThreadsForExecution(ns, HACKNS, this.hackThreads, hackOffsetTime);
        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsHack);
        this.execute(ns);
        this.resetThreads();
    }

    /** @param {import(".").NS } ns */
    execHGW(ns) {
        if (this.simEnabled) {
            // HACK
            let hackChance = ns.formulas.hacking.hackChance(this.simTarget, this.simPlayer);
            let hackTotal = 0;

            for (let i = 0; i < this.cycleTotal; i++) {
                if (Math.random() <= hackChance) {
                    hackTotal += this.hackTotal;
                    this.simTarget.moneyAvailable -= this.hackTotal;
                }

                // GROW
                let simGrowMult = ns.formulas.hacking.growPercent(
                    this.simTarget,
                    this.growThreads,
                    this.simPlayer,
                    this.cores
                );
                this.simTarget.moneyAvailable *= simGrowMult;
                this.simTarget.moneyAvailable = Math.min(
                    this.simTarget.moneyAvailable,
                    ns.getServerMaxMoney(this.targetname)
                );

                // SECURITY
                this.simTarget.hackDifficulty += this.hackSecIncrease;
                this.simTarget.hackDifficulty -= this.weakenThreadsHack * this.weakenAmountPerThread;
                this.simTarget.hackDifficulty = Math.max(
                    this.simTarget.hackDifficulty,
                    ns.getServerMinSecurityLevel(this.targetname)
                );
                this.simTarget.hackDifficulty += this.growSecIncrease;
                this.simTarget.hackDifficulty -= this.weakenThreadsGrow * this.weakenAmountPerThread;
                this.simTarget.hackDifficulty = Math.max(
                    this.simTarget.hackDifficulty,
                    ns.getServerMinSecurityLevel(this.targetname)
                );
            }

            this.simTime += this.cycleBatchTime + this.tspacer;
            this.simIncome += hackTotal;

            ns.tprintf(
                "HACK-GROW-WEAKEN: Sim Time: %s; Sim Income: %s (%s/s)",
                ns.tFormat(this.simTime, true),
                ns.nFormat(this.simIncome, "($0.000a)"),
                ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)")
            );

            return;
        }

        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        for (let i = this.cycleTotal - 1; i >= 0; i--) {
            let cycleOffsetTime = i * this.cycleSpacer;

            this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsHack, cycleOffsetTime);
            this.reserveThreadsForExecution(
                ns,
                WEAKENNS,
                this.weakenThreadsGrow,
                cycleOffsetTime + weakenGrowOffsetTime
            );
            this.reserveThreadsForExecution(ns, HACKNS, this.hackThreads, cycleOffsetTime + hackOffsetTime);
            this.reserveThreadsForExecution(ns, GROWNS, this.growThreads, cycleOffsetTime + growOffsetTime);
        }

        this.execute(ns);
        this.resetThreads();
    }

    /** @param {import(".").NS } ns */
    isWRunning(ns) {
        if (this.simEnabled) return false;

        for (const host of this.hosts) {
            let ps = ns.ps(host.hostname);
            for (let psInfo of ps) {
                if (psInfo.filename === WEAKENNS && psInfo.args.includes(this.targetname)) {
                    return true;
                }
            }
        }

        return false;
    }

    /** @param {import(".").NS } ns */
    async waitW(ns) {
        while (this.isWRunning(ns)) {
            await ns.sleep(this.tspacer);
        }
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

            // ns.tprintf(
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

            // ns.tprintf(
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

            // ns.tprintf(
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

            // ns.tprintf(
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
