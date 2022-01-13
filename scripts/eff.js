import { allHosts, serverIsHackable, setns, softenServer, doProgramBuys, canExecuteOnServer } from "./util.js";
import { HackEnv, TSPACER } from "./hack_env.js";

/** @param {import("./index.d").NS } ns */
async function calcHackRate(ns, hostname, targetname, ramAllowance, simMinutes = 2) {
    let env = new HackEnv(ns, targetname, hostname, ramAllowance);
    env.simEnabled = true;

    // simulate for 10 minutes
    ns.tprintf("Running fastSim on %s=>%s", env.hostname, env.targetname)
    await env.fastSim(ns, 1000 * 60 * simMinutes);

    // ns.tprintf(
    //     "Running Hack Rate on %s=>%s (%.2fGB Ram Allowance): %s/s",
    //     env.hostname,
    //     env.targetname,
    //     env.ramAllowance,
    //     ns.nFormat(env.simIncome / (env.simTime / 1000), "($0.000a)")
    // );

    return env.simIncome / (env.simTime / 1000);
}

/** @param {import("./index.d").NS } ns */
function getRamAllowance(ns, _host) {
    let host = _host;
    if (typeof host === "string" || host instanceof String) host = ns.getServer(host);

    let ramAllowance = host.maxRam;
    //if (host.hostname === "home") ramAllowance -= 64;

    return ramAllowance;
}

/** @param {import("./index.d").NS } ns */
async function getOrderedTargetArr(ns, _host, simMinutes) {
    let host = _host;
    if (typeof host === "string" || host instanceof String) host = ns.getServer(host);

    let ramAllowance = getRamAllowance(ns, host);
    let hackRates = [];
    let targetnames = allHosts()
        .filter(serverIsHackable)
        .filter((hostname) => ns.getServerMaxMoney(hostname) > 0);
    for (let targetname of targetnames) {
        hackRates.push([targetname, await calcHackRate(ns, host.hostname, targetname, ramAllowance, simMinutes)]);
    }

    return hackRates.sort((a, b) => b[1] - a[1]);
}

/** @param {import("./index.d").NS } ns */
export async function main(ns) {
    setns(ns);

    let allHostnames = allHosts();
    let attackScript = "super_hack_adv.js";
    let attackLib = "hack_env.js";

    doProgramBuys();

    // soften all servers
    for (const hostName of allHostnames) {
        softenServer(hostName);
    }

    // create a dictionary mapping server size to server name array (with a special bucket for "home")
    let hostSizeDict = {};
    for (let hostname of allHostnames
        .filter(canExecuteOnServer)
        .filter((hostname) => ns.getServerMaxRam(hostname) >= 32)) {
        let key = ns.getServerMaxRam(hostname);

        if (hostname === "home") key = "home";

        if (!(key in hostSizeDict)) hostSizeDict[key] = [];

        hostSizeDict[key].push(hostname);
    }

    // create a dictionary mapping host server sizes to ordered target arrays
    let targetArrDict = {};
    let badhosts = [];
    for (const [key, value] of Object.entries(hostSizeDict)) {
        let orderedTargetArr = await getOrderedTargetArr(ns, value[0], ns.args[0]);
        if (orderedTargetArr[0][1] === 0) {
            ns.tprintf(
                "Host %s does not have enough ram (%d) to execute a hack script",
                value[0],
                ns.getServerMaxRam(value[0])
            );
            badhosts.push(value[0]);
        } else {
            targetArrDict[key] = orderedTargetArr;
        }
    }

    // purge hosts that can't sustain hack scripts
    for (let hostname of badhosts) {
        delete hostSizeDict[hostname];
    }

    // collect target arrays into a single array ordered by value and including the server size bucket information
    let allTargets = [];
    for (const [key, values] of Object.entries(targetArrDict)) {
        for (let value of values) {
            allTargets.push({
                size: key,
                targetname: value[0],
                income: value[1],
            });
        }
    }
    allTargets = allTargets.sort((a, b) => b.income - a.income);

    // Set up tracker to decide how many targets are needed for each bucket
    let bucketTracker = {};
    for (const [key, value] of Object.entries(hostSizeDict)) {
        bucketTracker[key] = value.length;
    }

    // Iterate over allTargets, taking the next best target/bucket pair and removing all lesser targets in the
    // array. If all hosts in a bucket are accounted for, remove all lesser targets using that bucket. Finish
    // iterating once either all host servers are accounted for, or we've run out of targets.
    let finalTargets = [];
    while (allTargets.length > 0) {
        let target = allTargets.shift();
        allTargets = allTargets.filter((t) => target.targetname !== t.targetname);

        if (--bucketTracker[target.size] === 0) {
            allTargets = allTargets.filter((t) => target.size !== t.size);
        }

        finalTargets.push(target);
    }

    // Assign a target to a host in the target's bucket. Kill all hosts that are attacking targets not in this bucket.
    // Check to see if a host in the target's bucket is already attacking the target. If it is, skip the target. Otherwise
    // kick off attack on that target.
    for (const [bucket, hostnames] of Object.entries(hostSizeDict)) {
        // get all targets for this bucket
        let targetnames = [];
        for (let target of finalTargets) {
            if (target.size === bucket) targetnames.push(target.targetname);
        }

        // iterate over all hosts in this bucket, killing processes on any that are attacking something not in targets and
        // removing targets from the target array that are already being attacked
        for (let hostname of hostnames) {
            let ps = ns.ps(hostname);
            let dokill = false;
            for (let psInfo of ps) {
                if (psInfo.filename === attackScript) {
                    let attackTargetnameIdx = targetnames.indexOf(psInfo.args[0]);
                    if (attackTargetnameIdx === -1) {
                        ns.tprintf("Killing %s running on %s targeting %s", attackScript, hostname, psInfo.args[0]);
                        dokill = true;
                    } else {
                        targetnames.splice(attackTargetnameIdx, 1);
                    }
                    break;
                }
            }

            // If we're killing on home, make sure to only kill attack scripts so we dont kill ourselves
            if (dokill) {
                if (hostname !== "home") {
                    ns.killall(hostname);
                } else {
                    for (let psInfo of ps) {
                        if (
                            psInfo.filename === attackScript ||
                            psInfo.filename === "weaken.js" ||
                            psInfo.filename === "grow.js" ||
                            psInfo.filename === "hack.js"
                        ) {
                            ns.kill(psInfo.filename, hostname, psInfo.args);
                        }
                    }
                }
            }
        }

        // In case all the targets are accounted for, continue to the next bucket
        if (targetnames.length === 0) continue;

        // iterate over all hosts in this bucket, if the host is free, run the attack script on it with one of the targets
        for (let hostname of hostnames) {
            let ps = ns.ps(hostname);
            let hostfree = true;
            for (let psInfo of ps) {
                if (psInfo.filename === attackScript) {
                    hostfree = false;
                    break;
                }
            }

            if (hostfree) {
                let targetname = targetnames.shift();
                ns.tprintf("Starting %s on %s targeting %s", attackScript, hostname, targetname);

                await ns.scp(attackScript, "home", hostname);
                await ns.scp(attackLib, "home", hostname);

                if (hostname === "home") {
                    let allowedRam = ns.getServerMaxRam("home") - 48;
                    if (allowedRam >= 32) ns.exec(attackScript, hostname, 1, targetname, allowedRam);
                    else
                        ns.tprintf(
                            "WARNING: Not enough max ram on home to safely run script (%d)",
                            ns.getServerMaxRam("home")
                        );
                } else ns.exec(attackScript, hostname, 1, targetname);
            }

            if (targetnames.length === 0) break;
        }
    }

    for (let target of finalTargets) {
        ns.tprintf(
            "%20s: %10s/s %s",
            target.targetname,
            ns.nFormat(target.income, "($0.000a)"),
            target.size.toString()
        );
    }

    /*
    Algorithm:
        collect target arrays for each server size for all purchased servers and home
        collate targets per income for all servers of size purchasedServers.length + 1 (+1 for home) ???
        go down list from top to bottom, inspect servers at the same tier to see if the current target is being run at that tier
            if the target is being run at that tier, continue to the next target
            else kill the lowest producing target and start the current target on the newly freed server
        when starting a new target, specify the income of the target in the arg list so it can be compared later

    Colate:
        Iterate over all tier arrays at the same time
        Compare current item on all arrays, pick item with the highest income
        if item.server is not in the master list, pop the item, add the item to the master list and increment a tracking variable for that tier
            if the tier is full (tracker === tier.length) then clear out that tier's list or stop tracking it
        if item.server is in the master list already, pop the item without adding it to the list
        if all tiers are full, you're done

    Launching new dispatcher:
        scp dispatcher.js to the host server, exec dispatcher.js with the target, 1 thread
    */
}