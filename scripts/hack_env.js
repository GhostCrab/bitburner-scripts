export const debug = false;
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

export class HackEnv {
    /** @param {import("./index.d").NS } ns */
    constructor(ns, targetname, hostname = "", ramAllowance = -1, highMoney = -1, lowMoney = -1, tspacer = TSPACER) {
        this.targetname = targetname;
        this.hostname = hostname === "" ? ns.getHostname() : hostname;
        this.ramAllowance =
            ramAllowance === -1
                ? ns.getServerMaxRam(this.hostname) - ns.getServerUsedRam(this.hostname)
                : ramAllowance < 1
                ? (ns.getServerMaxRam(this.hostname) - ns.getServerUsedRam(this.hostname)) * ramAllowance
                : ramAllowance;
        this.highMoney = highMoney === -1 ? ns.getServerMaxMoney(this.targetname) : highMoney;
        this.lowMoney = lowMoney === -1 ? ns.getServerMaxMoney(this.targetname) * 0.5 : lowMoney;
        this.tspacer = tspacer; // CONST
        this.useAllRam = true;

        this.cores = ns.getServer(this.hostname).cpuCores;

        // Target Info
        this.targetSec = 0;
        this.targetSecMin = 0;
        this.targetMoneyAvailable = 0;

        // Weaken Info
        this.weakenRam = ns.getScriptRam(WEAKENNS);
        this.weakenStartSec = 0;
        this.weakenAmountPerThread = 0;
        this.weakenThreads = 0;
        this.weakenThreadsGrow = 0;
        this.weakenThreadsHack = 0;
        this.weakenTime = 0;
        this.weakenTimeFullCycle = 0;

        // Grow Info
        this.growRam = ns.getScriptRam(GROWNS);
        this.growStartMoney = 0;
        this.growMult = 0;
        this.growThreads = 0;
        this.growSecIncrease = 0;
        this.growTime = 0;

        // Hack Info
        this.hackRam = ns.getScriptRam(HACKNS);
        this.hackStartMoney = 0;
        this.hackTotalEst = 0;
        this.hackTotal = 0;
        this.hackThreads = 0;
        this.hackSecIncrease = 0;
        this.hackTime = 0;
        this.hackPercentPerThread = 0;

        // Batch Cycle Info
        this.ramPerCycle = 0;
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

    async prep(ns) {
        if (!ns.fileExists(GROWNS, this.hostname)) await ns.scp(GROWNS, "home", this.hostname);
        if (!ns.fileExists(WEAKENNS, this.hostname)) await ns.scp(WEAKENNS, "home", this.hostname);
        if (!ns.fileExists(HACKNS, this.hostname)) await ns.scp(HACKNS, "home", this.hostname);
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

    /** @param {import("./index.d").NS } ns */
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

    /** @param {import("./index.d").NS } ns */
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

    /** @param {import("./index.d").NS } ns */
    refresh(ns) {
        if (this.isWRunning(ns)) {
            // process in progress, wait for next refresh to update
            return;
        }

        if (debug) {
            switch (this.state) {
                case HackState.W:
                    ns.tprintf(
                        "WEAKEN: %s:%s => Lowered Security from %.2f to %.2f (min: %.2f)",
                        this.hostname,
                        this.targetname,
                        this.weakenStartSec,
                        this.getServerSecurityLevel(ns),
                        ns.getServerMinSecurityLevel(this.targetname)
                    );
                    break;
                case HackState.GW:
                    ns.tprintf(
                        "GROW-WEAKEN: %s:%s => Grow %d; Weaken %d; Total RAM %.2f",
                        this.hostname,
                        this.targetname,
                        this.growThreads,
                        this.weakenThreadsGrow,
                        this.ramPerCycle
                    );
                    ns.tprintf(
                        "GROW-WEAKEN: %s:%s => Increased available money from %s to %s/%s [Sec: %.2f]",
                        this.hostname,
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
                        "HACK-WEAKEN: %s:%s => Hack %d; Weaken %d; Total RAM %.2f",
                        this.hostname,
                        this.targetname,
                        this.hackThreads,
                        this.weakenThreadsHack,
                        this.ramPerCycle
                    );
                    ns.tprintf(
                        "HACK-WEAKEN: %s:%s => Decreased available money from %s to %s; %s Total (%.2f%% of max) [Sec: %.2f]",
                        this.hostname,
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
                        "HACK-GROW-WEAKEN: %s:%s => Hack %d; Grow %d; Hack/Grow Weaken %d/%d; Total RAM %.2f/%.2f; Total Cycles %d/%d",
                        this.hostname,
                        this.targetname,
                        this.hackThreads,
                        this.growThreads,
                        this.weakenThreadsHack,
                        this.weakenThreadsGrow,
                        this.ramPerCycle,
                        this.ramPerCycle * this.cycleTotal,
                        this.cycleTotal,
                        this.cycleMax
                    );
                    ns.tprintf(
                        "HACK-GROW-WEAKEN: %s:%s => Cycle Complete; %s Available; Hacked %s (%.2f%% of max) [Sec: %.2f]",
                        this.hostname,
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

    printRamOverride(ns) {
        let maxRam = ns.getServerMaxRam(this.hostname);
        let ramFraction = maxRam / this.ramAllowance;
        ns.tprintf(
            "Overriding availble host RAM max to %.2f (%.2f%% of %.2f)",
            this.ramAllowance,
            (this.ramAllowance / maxRam) * 100,
            maxRam
        );
    }

    doneWeaken(ns) {
        return this.getServerSecurityLevel(ns) - 0.01 <= ns.getServerMinSecurityLevel(this.targetname);
    }

    doneGrow(ns) {
        return this.getServerMoneyAvailable(ns) >= this.highMoney;
    }

    /** @param {import("./index.d").NS } ns */
    updateForW(ns) {
        // Target Info
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreads = Math.ceil(secDiff / this.weakenAmountPerThread);

        this.ramPerCycle = this.weakenThreads * this.weakenRam;

        if (this.ramPerCycle > this.ramAllowance || this.useAllRam) {
            this.weakenThreads = Math.floor(this.ramAllowance / this.weakenRam);
            this.ramPerCycle = this.weakenThreads * this.weakenRam;
        }

        // return true if this cycle will fully weaken the target
        return this.weakenThreads * this.weakenAmountPerThread >= secDiff;
    }

    /** @param {import("./index.d").NS } ns */
    updateForGW(ns) {
        // Target Info
        this.targetMoneyAvailable = this.getServerMoneyAvailable(ns);
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Grow Info
        this.growTime = this.getGrowTime(ns);
        this.growMult = this.highMoney / this.targetMoneyAvailable;
        this.growThreads = this.calcGrowThreads(ns);
        let growThreadsFull = this.growThreads;
        if (this.useAllRam) this.growThreads = Math.floor(this.ramAllowance / this.growRam);
        this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);

        // Weaken Info
        this.weakenTime = this.getWeakenTime(ns);
        this.weakenAmountPerThread = ns.weakenAnalyze(1, this.cores);
        this.weakenThreadsGrow = Math.ceil((this.growSecIncrease + secDiff) / this.weakenAmountPerThread);

        this.ramPerCycle = this.growThreads * this.growRam + this.weakenThreadsGrow * this.weakenRam;

        while (this.ramPerCycle > this.ramAllowance) {
            this.growThreads--;
            this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);
            this.weakenThreadsGrow = Math.ceil((this.growSecIncrease + secDiff) / this.weakenAmountPerThread);
            this.ramPerCycle = this.growThreads * this.growRam + this.weakenThreadsGrow * this.weakenRam;
        }

        // Returning true if this grow cycle will max out the target server
        return this.growThreads >= growThreadsFull;
    }

    /** @param {import("./index.d").NS } ns */
    updateForHW(ns) {
        // Find out how much money I can gain back in a single GW cycle and never hack more than that
        let useAllRamState = this.useAllRam;
        this.useAllRam = true;
        this.updateForGW(ns); // to set this.growThreads
        this.growMult = ns.formulas.hacking.growPercent(
            ns.getServer(this.targetname),
            this.growThreads,
            ns.getPlayer(),
            this.cores
        );
        this.useAllRam = useAllRamState;

        // Target Info
        this.targetMoneyAvailable = this.getServerMoneyAvailable(ns);
        this.targetSec = this.getServerSecurityLevel(ns);
        this.targetSecMin = ns.getServerMinSecurityLevel(this.targetname);
        let secDiff = this.targetSec - this.targetSecMin;

        // Hack Info
        this.hackTime = this.getHackTime(ns);
        this.hackPercentPerThread = this.hackAnalyze(ns);
        this.hackTotalEst = this.targetMoneyAvailable - this.lowMoney;
        this.hackThreads = Math.ceil(ns.hackAnalyzeThreads(this.targetname, this.hackTotalEst));
        let hackThreadsFull = this.hackThreads;
        this.hackThreads = Math.floor(this.ramAllowance / this.hackRam);
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

        this.ramPerCycle = this.hackThreads * this.hackRam + this.weakenThreadsHack * this.weakenRam;

        while (this.ramPerCycle > this.ramAllowance || growRecoveryMult > this.growMult) {
            this.hackThreads--;
            this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
            growRecoveryMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
            this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);
            this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);
            this.ramPerCycle = this.hackThreads * this.hackRam + this.weakenThreadsHack * this.weakenRam;
        }

        // Returning true if this hack cycle will bottom out the target server
        return this.hackThreads >= hackThreadsFull;
    }

    /** @param {import("./index.d").NS } ns */
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
        this.hackThreads = Math.ceil(ns.hackAnalyzeThreads(this.targetname, this.hackTotalEst));
        let hackThreadsFull = this.hackThreads;
        this.hackThreads = Math.floor(this.ramAllowance / this.hackRam);
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

        let setCycle = function () {
            if (this.cycleTotal <= 0) return 0;
            let ramCycleAllowance = Math.floor((this.ramAllowance / this.cycleTotal) * 100) / 100;
            if (ramCycleAllowance < 16) return 0;

            this.hackThreads = Math.floor(ramCycleAllowance / this.hackRam);
            this.hackThreadStep = Math.floor(this.hackThreads * .01)
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

            this.ramPerCycle =
                this.hackThreads * this.hackRam +
                this.growThreads * this.growRam +
                this.weakenThreadsHack * this.weakenRam +
                this.weakenThreadsGrow * this.weakenRam;

            let failcycles = 0

            if (this.ramPerCycle > ramCycleAllowance) {
                let failRatio = ramCycleAllowance / this.ramPerCycle;
                this.hackThreads = Math.min(this.hackThreads * (failRatio * 1.1), this.hackThreads);
            }

            while (this.ramPerCycle > ramCycleAllowance) {
                failcycles++;
                this.hackThreads -= this.hackThreadStep
                this.hackTotal = this.hackPercentPerThread * this.hackThreads * this.targetMoneyAvailable;
                this.hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);
                this.weakenThreadsHack = Math.ceil((this.hackSecIncrease + secDiff) / this.weakenAmountPerThread);
                this.growMult = this.highMoney / (this.targetMoneyAvailable - this.hackTotal);
                this.growThreads = this.calcGrowThreads(ns);
                this.growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);
                this.weakenThreadsGrow = Math.ceil(this.growSecIncrease / this.weakenAmountPerThread);

                this.ramPerCycle =
                    this.hackThreads * this.hackRam +
                    this.growThreads * this.growRam +
                    this.weakenThreadsHack * this.weakenRam +
                    this.weakenThreadsGrow * this.weakenRam;
            }

            //ns.tprintf("failcycles: %d", failcycles)

            this.cycleBatchTime = this.cycleFullTime + this.cycleSpacer * this.cycleTotal;
            if (this.cycleTotal === 1) this.cycleBatchTime = this.cycleFullTime;

            let cycleIncome = (this.hackTotal * this.cycleTotal) / this.cycleBatchTime;

            return cycleIncome;
        }.bind(this);

        let cycleIncomes = new Array(this.cycleMax + 1);

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

        // find local maximum of cycleIncomes
        // target center value,
        //  if value to left of target is larger than target, recenter target to left of current target
        //  if value to right of target is larger than target, recenter target to right of current target
        //  if values to left and right of target are both less than target, keep target
        let cycleMin = 0;
        let cycleTarget = 0;
        while (true) {
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

        return this.cycleTotal === 1 ? this.hackThreads >= hackThreadsFull : true;
    }

    /** @param {import("./index.d").NS } ns */
    execW(ns) {
        if (this.simEnabled) {
            this.simTarget.hackDifficulty -= this.weakenThreads * this.weakenAmountPerThread;
            this.simTarget.hackDifficulty = Math.max(
                this.simTarget.hackDifficulty,
                ns.getServerMinSecurityLevel(this.targetname)
            );

            this.simTime += this.weakenTime;
            return;
        }

        ns.exec(WEAKENNS, this.hostname, this.weakenThreads, this.targetname);
    }

    /** @param {import("./index.d").NS } ns */
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

            this.simTime += this.weakenTime;

            return;
        }

        // start grow such that it finishes slightly before weaken
        let growOffsetTime = this.weakenTime - this.tspacer - this.growTime;
        ns.exec(GROWNS, this.hostname, this.growThreads, this.targetname, growOffsetTime);
        ns.exec(WEAKENNS, this.hostname, this.weakenThreadsGrow, this.targetname);
    }

    /** @param {import("./index.d").NS } ns */
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

            return;
        }

        // start hack such that it finishes slightly before weaken
        let hackOffsetTime = this.weakenTime - this.tspacer - this.hackTime;
        ns.exec(HACKNS, this.hostname, this.hackThreads, this.targetname, hackOffsetTime);
        ns.exec(WEAKENNS, this.hostname, this.weakenThreadsHack, this.targetname);
    }

    /** @param {import("./index.d").NS } ns */
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

            this.simTime += this.cycleBatchTime;
            this.simIncome += hackTotal;

            return;
        }

        let weakenGrowOffsetTime = this.tspacer * 2;
        let growOffsetTime = this.weakenTime + this.tspacer - this.growTime;
        let hackOffsetTime = this.weakenTime - this.hackTime - this.tspacer;

        for (let i = this.cycleTotal - 1; i >= 0; i--) {
            let cycleOffsetTime = i * this.cycleSpacer;

            ns.exec(WEAKENNS, this.hostname, this.weakenThreadsHack, this.targetname, cycleOffsetTime); // hack weaken, Start 1st (0ms offset), finish 2nd
            ns.exec(
                WEAKENNS,
                this.hostname,
                this.weakenThreadsGrow,
                this.targetname,
                cycleOffsetTime + weakenGrowOffsetTime
            ); // grow weaken, Start 2nd, finish 4th
            ns.exec(GROWNS, this.hostname, this.growThreads, this.targetname, cycleOffsetTime + growOffsetTime); // Start 3rd, finish 3rd
            ns.exec(HACKNS, this.hostname, this.hackThreads, this.targetname, cycleOffsetTime + hackOffsetTime); // Start 4th, finish 1st
        }
    }

    /** @param {import("./index.d").NS } ns */
    isWRunning(ns) {
        if (this.simEnabled) return false;

        let ps = ns.ps(this.hostname);
        for (let psInfo of ps) {
            if (psInfo.filename === WEAKENNS && psInfo.args.includes(this.targetname)) {
                return true;
            }
        }
        return false;
    }

    /** @param {import("./index.d").NS } ns */
    async waitW(ns) {
        while (this.isWRunning(ns)) {
            await ns.sleep(this.tspacer);
        }
    }

    /** @param {import("./index.d").NS } ns */
    fastSim(ns, time) {
        this.resetSim(ns);
        this.simEnabled = true;

        if (!this.doneWeaken(ns)) {
            this.weakenTime = this.getWeakenTime(ns);
            this.simTime += this.weakenTime + this.tspacer;
            this.simTarget.hackDifficulty = this.simTarget.minDifficulty;
        }

        if (this.simTime > time) 
            return this.simIncome;

            //x = pow(y, 5)
            //y = pow(x, 1/5)

        if (!this.doneGrow(ns)) {
            this.updateForGW(ns);

            while ((this.simTarget.moneyAvailable + 1000) < ns.getServerMaxMoney(this.targetname)) {
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

                this.simTime += this.weakenTime + this.tspacer;
                this.simTarget.hackDifficulty = this.simTarget.minDifficulty;
            }
        }

        if (this.simTime > time) 
            return this.simIncome;

        this.updateForHW(ns);
        let hwTotal = this.hackTotal;
        let hwTime = this.weakenTime * 2 + this.tspacer * 2;
        let hwIncome = hwTotal / hwTime;
        this.updateForHGW(ns);
        let hgwTotal = this.hackTotal * this.cycleTotal;
        let hgwTime = this.cycleFullTime;
        let hgwIncome = hgwTotal / hgwTime;

        let timeRemaining = time - this.simTime
        let hackCycles = 0;
        if (hwIncome > hgwIncome) {
            hackCycles = Math.floor(timeRemaining / hwTime)
            this.simTime += hackCycles * hwTime
            this.simIncome += hackCycles * hwTotal
        } else {
            hackCycles = Math.floor(timeRemaining / hgwTime)
            this.simTime += hackCycles * hgwTime
            this.simIncome += hackCycles * hwTotal
        }

        return this.simIncome;
    }
}