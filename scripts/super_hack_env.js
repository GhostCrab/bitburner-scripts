export const debug = false;
export const TSPACER = 100;
export const WEAKENNS = "weaken.js";
export const GROWNS = "grow.js";
export const HACKNS = "hack.js";

export const HackState = {
    UNSET: "UNDEFINED STATE",
    W: "W",
    GW: "GW",
    HW: "HW",
    HGW: "HGW",
};

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
        this.maxThreads = Math.floor(
            (ns.getServerMaxRam(this.hostname) - ns.getServerUsedRam(this.hostname)) / this.threadSize
        );
        this.reservedScriptCalls = [];

        // if this host is home, reserve 64GB of ram for other stuff
        if (this.hostname === "home") {
            let homeram = ns.getServerMaxRam(this.hostname) - ns.getServerUsedRam(this.hostname) - 64;
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

    tryReserveThreadsExtended(ns, script, threads, args) {
        let reservedThreadCount = this.getReservedThreadCount();

        if (reservedThreadCount === this.maxThreads) return 0;

        let newThreadCount = Math.min(this.maxThreads - reservedThreadCount, threads);
        this.reservedScriptCalls.push({ script: script, threads: newThreadCount, args: args });

        return newThreadCount;
    }

    /** @param {import(".").NS } ns */
    executeScripts(ns, target) {
        for (const scriptCall of this.reservedScriptCalls) {
            if ("args" in scriptCall) ns.exec(scriptCall.script, this.hostname, scriptCall.threads, ...scriptCall.args);
            else ns.exec(scriptCall.script, this.hostname, scriptCall.threads, target, scriptCall.offset);
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

        // Debug Info
        this.bst = Date.now();
        this.currentTime = this.bst;
        this.batchID = 0;
        this.dataFile = false ? `${this.bst}_${this.targetname}.txt` : false;
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
        //     ns.print(ns.sprintf("Max Threads: %d", this.maxThreads));
        // }
    }

    async init(ns, force = false) {
        for (const host of this.hosts) await host.prep(ns, force);

        if (this.dataFile) {
            await ns.write(
                this.dataFile,
                "Target Name, UID, Batch ID, Offset Time, Start Time, " +
                    "End Time, Operation Time, Real Time Start, Real Time End, " +
                    "Real Time Operation, Diff, Exp Gain\n",
                "w"
            );
        }
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
    calcGrowThreads(ns) {
        if (this.growMult < 1)
            return 0
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

        switch (this.state) {
            case HackState.W:
                ns.print(
                    ns.sprintf(
                        "%8s WEAKEN: %s => Lowered Security from %.2f to %.2f (min: %.2f); Total Threads %s",
                        new Date().toLocaleTimeString("it-IT"),
                        this.targetname,
                        this.weakenStartSec,
                        this.getServerSecurityLevel(ns) ? this.getServerSecurityLevel(ns) : 0,
                        ns.getServerMinSecurityLevel(this.targetname)
                            ? ns.getServerMinSecurityLevel(this.targetname)
                            : 0,
                        this.threadsPerCycle
                    )
                );
                break;
            case HackState.GW:
                ns.print(
                    ns.sprintf(
                        "%8s GROW-WEAKEN: %s => Increased available money from %s to %s/%s [Sec: %.2f]",
                        new Date().toLocaleTimeString("it-IT"),
                        this.targetname,
                        ns.nFormat(this.growStartMoney, "($0.000a)"),
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(this.highMoney, "($0.000a)"),
                        this.getServerSecurityLevel(ns)
                    )
                );
                break;
            case HackState.HW:
                let totalHack = this.hackStartMoney - this.getServerMoneyAvailable(ns);
                ns.print(
                    ns.sprintf(
                        "%8s HACK-WEAKEN: %s => Decreased available money from %s to %s; %s Total (%.2f%% of max) [Sec: %.2f]",
                        new Date().toLocaleTimeString("it-IT"),
                        this.targetname,
                        ns.nFormat(this.hackStartMoney, "($0.000a)"),
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(totalHack, "($0.000a)"),
                        (totalHack / ns.getServerMaxMoney(this.targetname)) * 100,
                        this.getServerSecurityLevel(ns)
                    )
                );
                break;
            case HackState.HGW:
                ns.print(
                    ns.sprintf(
                        "%8s HACK-GROW-WEAKEN: %s => Cycle Complete; %s Available; Hacked %s/%s (%.2f%%/%.2f%% of max) [Sec: %.2f]",
                        new Date().toLocaleTimeString("it-IT"),
                        this.targetname,
                        ns.nFormat(this.getServerMoneyAvailable(ns), "($0.000a)"),
                        ns.nFormat(this.hackTotal, "($0.000a)"),
                        ns.nFormat(this.hackTotal * this.cycleTotal, "($0.000a)"),
                        (this.hackTotal / ns.getServerMaxMoney(this.targetname)) * 100,
                        ((this.hackTotal * this.cycleTotal) / ns.getServerMaxMoney(this.targetname)) * 100,
                        this.getServerSecurityLevel(ns)
                    )
                );
                break;
            default:
                // Do Nothing
                break;
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

        let setCycle = function (cycleTotal) {
            if (cycleTotal <= 0) return [0, 0, 0, Number.MAX_VALUE, 0, 0, 0, 0, 0];
            this.cycleTotal = cycleTotal;
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
            // if (this.threadsPerCycle > cycleThreadAllowance) {
            //     this.hackThreads = cycleThreadAllowance * (this.hackThreads / this.threadsPerCycle);
            // }

            while (this.threadsPerCycle > cycleThreadAllowance) {
                this.hackThreads--;

                if (this.hackThreads <= 0) return [0, 0, 0, Number.MAX_VALUE];

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

            return [
                (this.hackTotal * this.cycleTotal) / this.cycleBatchTime,
                this.hackTotal,
                this.cycleTotal,
                this.cycleBatchTime,
                this.threadsPerCycle,
                cycleThreadAllowance,
                this.hackThreads,
                cycleThreadAllowance * (this.hackThreads / this.threadsPerCycle),
            ];
        }.bind(this);

        let cycleIncomes = new Array(this.cycleMax + 1);
        let cycleTarget = 0;

        if (true) {
            // find first cycle counting down from the top where income > 0, since the algorithm doesnt like
            // flat lines and any cylcle count that results in a ram allocation less than a threshold automatically
            // returns 0
            let cycleMax;
            for (cycleMax = this.cycleMax; cycleMax >= 0; cycleMax--) {
                cycleIncomes[cycleMax] = setCycle(cycleMax);

                if (cycleIncomes[cycleMax][0] > 0) break;
            }
            cycleMax++;

            // find local maximum of cycleIncomes
            // target center value,
            //  if value to left of target is larger than target, recenter target to left of current target
            //  if value to right of target is larger than target, recenter target to right of current target
            //  if values to left and right of target are both less than target, keep target
            let cycleMin = 0;
            while (true) {
                cycleTarget = cycleMin + Math.floor((cycleMax - cycleMin) / 2);

                if (cycleTarget === this.cycleMax || cycleTarget === 1) break;

                if (cycleIncomes[cycleTarget - 1] === undefined) {
                    cycleIncomes[cycleTarget - 1] = setCycle(cycleTarget - 1);
                }
                if (cycleIncomes[cycleTarget] === undefined) {
                    cycleIncomes[cycleTarget] = setCycle(cycleTarget);
                }
                if (cycleIncomes[cycleTarget + 1] === undefined) {
                    cycleIncomes[cycleTarget + 1] = setCycle(cycleTarget + 1);
                }

                if (cycleIncomes[cycleTarget][0] < cycleIncomes[cycleTarget + 1][0]) {
                    cycleMin = cycleTarget;
                    continue;
                }

                if (cycleIncomes[cycleTarget][0] < cycleIncomes[cycleTarget - 1][0]) {
                    cycleMax = cycleTarget;
                    continue;
                }

                break;
            }
        } else {
            for (let cycle = 0; cycle < cycleIncomes.length; cycle++) {
                cycleIncomes[cycle] = setCycle(cycle);
            }

            cycleTarget = cycleIncomes.sort((a, b) => b[0] - a[0])[0][2];
        }

        setCycle(cycleTarget);

        // for (let cycle = 0; cycle < cycleIncomes.length; cycle++) {
        //     if (cycleIncomes[cycle] !== undefined && cycleIncomes[cycle][0] > 0) {
        //         let hackPercent = (cycleIncomes[cycle][1] / this.highMoney) * 100;
        //         let totalHackPercent = hackPercent * cycle;
        //         ns.tprintf(
        //             "%s => Cycle: %d --- Income: %s/s, Total: %s | %.2f%% | %.2f%%, Threads: %d | %d | %d (%d/%d), Hack Threads %d | est %s %s",
        //             this.targetname,
        //             cycle,
        //             ns.nFormat(cycleIncomes[cycle][0], "($0.000a)"),
        //             ns.nFormat(cycleIncomes[cycle][1], "($0.000a)"),
        //             hackPercent,
        //             totalHackPercent,
        //             cycleIncomes[cycle][4],
        //             cycleIncomes[cycle][4] * cycle,
        //             this.maxThreads,
        //             cycleIncomes[cycle][5],
        //             cycleIncomes[cycle][5] * cycle,
        //             cycleIncomes[cycle][6],
        //             cycleIncomes[cycle][7],
        //             (cycle === cycleTarget)?"WINNER":""
        //         );
        //     } else ns.tprintf(`${this.targetname} => Cycle: ${cycle} --- XX`);
        // }

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

        ns.print(
            ns.sprintf("WARNING: Only able to allocate %d/%d %s threads", threads - unallocatedThreads, threads, script)
        );
        return false;
    }

    reserveCycle(ns, cycleOffsetTime, batchID) {
        // Target Name, UID, Batch ID, Offset Time, Start Time, End Time, Operation Time, Real Time Start, Real Time End, Real Time Operation, Diff, Exp Gain
        let weakenHackOffsetTime = 0;
        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        let weakenArgsHack = [
            this.targetname,
            cycleOffsetTime + weakenHackOffsetTime,
            cycleOffsetTime + this.currentTime + weakenHackOffsetTime,
            cycleOffsetTime + this.currentTime + this.weakenTime + weakenHackOffsetTime,
            0,
            batchID,
            this.dataFile,
            this.bst,
            "0WH",
        ];

        let weakenArgsGrow = [
            this.targetname,
            cycleOffsetTime + weakenGrowOffsetTime,
            cycleOffsetTime + this.currentTime + weakenGrowOffsetTime,
            cycleOffsetTime + this.currentTime + this.weakenTime + weakenGrowOffsetTime,
            0,
            batchID,
            this.dataFile,
            this.bst,
            "1WG",
        ];

        let growArgs = [
            this.targetname,
            cycleOffsetTime + growOffsetTime,
            cycleOffsetTime + this.currentTime + growOffsetTime,
            cycleOffsetTime + this.currentTime + this.growTime + growOffsetTime,
            0,
            batchID,
            this.dataFile,
            this.bst,
            "2G",
        ];

        let hackArgs = [
            this.targetname,
            cycleOffsetTime + hackOffsetTime,
            cycleOffsetTime + this.currentTime + hackOffsetTime,
            cycleOffsetTime + this.currentTime + this.hackTime + hackOffsetTime,
            0,
            batchID,
            this.dataFile,
            this.bst,
            "3H",
        ];

        let totalThreads = this.weakenThreadsHack + this.weakenThreadsGrow + this.hackThreads + this.growThreads;
        let whReserved = false;
        let wgReserved = false;
        let hReserved = false;
        let gReserved = false;

        for (const host of this.hosts) {
            let freeThreads = host.maxThreads - host.getReservedThreadCount();
            if (!whReserved && freeThreads >= this.weakenThreadsHack) {
                freeThreads -= this.weakenThreadsHack;
                whReserved = true;
            }

            if (!wgReserved && freeThreads >= this.weakenThreadsGrow) {
                freeThreads -= this.weakenThreadsGrow;
                wgReserved = true;
            }

            if (!hReserved && freeThreads >= this.hackThreads) {
                freeThreads -= this.hackThreads;
                hReserved = true;
            }

            if (!gReserved && freeThreads >= this.growThreads) {
                freeThreads -= this.growThreads;
                gReserved = true;
            }

            if (whReserved && wgReserved && hReserved && gReserved) break;
        }

        if (!whReserved || !wgReserved || !hReserved || !gReserved) return false;

        whReserved = false;
        wgReserved = false;
        hReserved = false;
        gReserved = false;

        for (const host of this.hosts) {
            let freeThreads = host.maxThreads - host.getReservedThreadCount();
            if (!hReserved && freeThreads >= this.hackThreads) {
                hackArgs[8] = hackArgs[8] + "-" + host.hostname;
                host.tryReserveThreadsExtended(ns, HACKNS, this.hackThreads, hackArgs);
                freeThreads -= this.hackThreads;
                hReserved = true;
            }

            if (!gReserved && freeThreads >= this.growThreads) {
                growArgs[8] = growArgs[8] + "-" + host.hostname;
                host.tryReserveThreadsExtended(ns, GROWNS, this.growThreads, growArgs);
                freeThreads -= this.growThreads;
                gReserved = true;
            }

            if (!whReserved && freeThreads >= this.weakenThreadsHack) {
                weakenArgsHack[8] = weakenArgsHack[8] + "-" + host.hostname;
                host.tryReserveThreadsExtended(ns, WEAKENNS, this.weakenThreadsHack, weakenArgsHack);
                freeThreads -= this.weakenThreadsHack;
                whReserved = true;
            }

            if (!wgReserved && freeThreads >= this.weakenThreadsGrow) {
                weakenArgsGrow[8] = weakenArgsGrow[8] + "-" + host.hostname;
                host.tryReserveThreadsExtended(ns, WEAKENNS, this.weakenThreadsGrow, weakenArgsGrow);
                freeThreads -= this.weakenThreadsGrow;
                wgReserved = true;
            }

            if (whReserved && wgReserved && hReserved && gReserved) break;
        }

        return true;
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

            ns.print(ns.sprintf("WEAKEN: Sim Time: %s", ns.tFormat(this.simTime, true)));
            return;
        }

        let port = ns.getPortHandle(1);
        port.clear();
        port.write([
            new Date(),
            this.weakenTime,
            this.targetname,
            ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args),
            this.state
        ]);

        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreads);
        this.execute(ns);
        this.resetThreads();

        ns.print(
            ns.sprintf(
                "%8s WEAKEN: %s => Weaken %d; Time +%s [%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.weakenThreads,
                stFormat(ns, this.weakenTime),
                stdFormat(ns, this.weakenTime)
            )
        );
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

            ns.print(ns.sprintf("GROW-WEAKEN: Sim Time: %s", ns.tFormat(this.simTime, true)));

            return;
        }

        let port = ns.getPortHandle(1);
        port.clear();
        port.write([
            new Date(),
            this.weakenTime,
            this.targetname,
            ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args),
            this.state
        ]);

        // start grow such that it finishes slightly before weaken
        let growOffsetTime = this.weakenTime - this.tspacer - this.growTime;
        this.reserveThreadsForExecution(ns, GROWNS, this.growThreads, growOffsetTime);
        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsGrow);
        this.execute(ns);
        this.resetThreads();

        ns.print(
            ns.sprintf(
                "%8s GROW-WEAKEN: %s => Grow %d; Weaken %d; Total Threads %d; Time +%s [%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.growThreads,
                this.weakenThreadsGrow,
                this.threadsPerCycle,
                stFormat(ns, this.weakenTime),
                stdFormat(ns, this.weakenTime)
            )
        );
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

            ns.print(
                ns.sprintf(
                    "HACK-WEAKEN: Sim Time: %s; Sim Income: %s (%s/s)",
                    ns.tFormat(this.simTime, true),
                    ns.nFormat(this.simIncome, "($0.000a)"),
                    ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)")
                )
            );

            return;
        }

        let port = ns.getPortHandle(1);
        port.clear();
        port.write([
            new Date(),
            this.weakenTime,
            this.targetname,
            ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args),
            this.state
        ]);

        // start hack such that it finishes slightly before weaken
        let hackOffsetTime = this.weakenTime - this.tspacer - this.hackTime;
        this.reserveThreadsForExecution(ns, HACKNS, this.hackThreads, hackOffsetTime);
        this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsHack);
        this.execute(ns);
        this.resetThreads();

        ns.print(
            ns.sprintf(
                "%8s HACK-WEAKEN: %s => Hack %d; Weaken %d; Total Threads %d; Time +%s [%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.hackThreads,
                this.weakenThreadsHack,
                this.threadsPerCycle,
                stFormat(ns, this.weakenTime),
                stdFormat(ns, this.weakenTime)
            )
        );
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

            ns.print(
                ns.sprintf(
                    "HACK-GROW-WEAKEN: Sim Time: %s; Sim Income: %s (%s/s)",
                    ns.tFormat(this.simTime, true),
                    ns.nFormat(this.simIncome, "($0.000a)"),
                    ns.nFormat(this.simIncome / (this.simTime / 1000), "($0.000a)")
                )
            );

            return;
        }

        if (false) {
            this.currentTime = Date.now() - this.bst;

            for (let i = 0; i < this.cycleTotal; i++) {
                let cycleOffsetTime = i * this.cycleSpacer;

                this.reserveCycle(ns, cycleOffsetTime, this.batchID++);
            }
        } else {
            let weakenGrowOffsetTime = this.tspacer * 2;
            let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
            let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

            for (let i = this.cycleTotal - 1; i >= 0; i--) {
                let cycleOffsetTime = i * this.cycleSpacer;

                this.reserveThreadsForExecution(ns, HACKNS, this.hackThreads, cycleOffsetTime + hackOffsetTime);
                this.reserveThreadsForExecution(ns, GROWNS, this.growThreads, cycleOffsetTime + growOffsetTime);
                this.reserveThreadsForExecution(ns, WEAKENNS, this.weakenThreadsHack, cycleOffsetTime);
                this.reserveThreadsForExecution(
                    ns,
                    WEAKENNS,
                    this.weakenThreadsGrow,
                    cycleOffsetTime + weakenGrowOffsetTime
                );
                
            }
        }

        this.execute(ns);
        this.resetThreads();

        let port = ns.getPortHandle(1);
        port.clear();
        port.write([
            new Date(),
            this.cycleBatchTime,
            this.targetname,
            ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args),
            this.state
        ]);

        ns.print(
            ns.sprintf(
                "%8s HACK-GROW-WEAKEN: %s => Hack %d; Grow %d; Hack/Grow Weaken %d/%d; Total Threads %d/%d; Total Cycles %d/%d; Time +%s:+%s [%s:%s]",
                new Date().toLocaleTimeString("it-IT"),
                this.targetname,
                this.hackThreads,
                this.growThreads,
                this.weakenThreadsHack,
                this.weakenThreadsGrow,
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

    optimalHackPercent(ns) {
        this.resetSim(ns);
        this.simEnabled = true;
        this.simTarget.moneyAvailable = this.simTarget.moneyMax;
        this.simTarget.hackDifficulty = this.simTarget.minDifficulty;

        this.updateForHGW(ns);

        return this.hackTotal / ns.getServerMaxMoney(this.targetname);
    }
}
