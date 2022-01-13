import { allHosts, serverIsHackable, setns, canExecuteOnServer } from "./util.js";
import { SuperHackEnv } from "./super_hack_env.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    // ns.exec("buy_programs.js", "home")
    // await ns.sleep(500)
    // ns.exec("soften.js", "home")
    // await ns.sleep(500)

    let allHostnames = allHosts();
    let attackScript = "super_hack_adv.js";
    let attackLib = "hack_env.js";

    let env = new SuperHackEnv(ns, "millenium-fitness", allHostnames.filter(canExecuteOnServer))
    await env.init(ns)

    env.simEnabled = true
    while (env.simTime < 1000 * 60 * 20) {
        env.refresh(ns);
        await ns.sleep(20)
    }

    ns.tprintf(
        "Time Elapsed: %s; Income %s | %s/s",
        ns.tFormat(env.simTime),
        ns.nFormat(env.simIncome, "($0.000a)"),
        ns.nFormat(env.simIncome / (env.simTime / 1000), "($0.000a)")
    );

    let env2 = new SuperHackEnv(ns, "millenium-fitness", allHostnames.filter(canExecuteOnServer))
    await env2.init(ns)

    env2.fastSim(ns, 1000 * 60 * 20)

    ns.tprintf(
        "Time Elapsed: %s; Income %s | %s/s",
        ns.tFormat(env2.simTime),
        ns.nFormat(env2.simIncome, "($0.000a)"),
        ns.nFormat(env2.simIncome / (env2.simTime / 1000), "($0.000a)")
    );

    return;

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
        collect all useable servers with > hackRam ram
        evaluate servers to detect how many hack or weaken/grow threads can run on it - assign those values to that server

        host database will include all hosts
            name
            maxRam
            unusedRam
            hackThreads
            weakenThreads
            growThreads

            functions to allocate threads, when allocate for each thread type is called, unused ram is updated
            function to reset, clearing all thread counters and reset unused ram to maxRam
            functions to call on a thread type with arguments, returns actual number of threads executed
                maybe wont work, perhaps track what threads execute where on state evaluation to prevent mis-allocation of resources

        ---- need to update or write new version of hack_env that uses entire ecosystem instead of a single host to evaluate targets
          super_hack_env (SHE)
          Takes a mapping of servers {name, available H, available WG, max H, max WG} instead of a single host
          dont worry about cores on servers for calculations
          isWRunning() -- check on all servers instead of just hostserver
          all calculations using ramallowance need to change
            instead of checking if ram cycle fits in ram allowance, ram cycle needs to be an array of hack/grow/weaken threads that fit in the
            host server database
            every evaluation will go in order, reducing the hack threads, then the grow threads, then the weaken threads. At each step, the
            host resources will be re-calculated

          SHE will have an allocate threads function that receives H, G, and W threads and attempts to map them to the server database,
            if allocation is successful, return true, otherwise return false

          ?? Create a way to queue up exec calls based on the server/script/args combinations that need to be called in rapid succession

          not sure if hgw < ramAllowance algorithm needs to include assigning sleep timers, or maybe that can be taken care of at execution time.

          if we pretend all scripts are the same size (1.75GB) instead of 1.70GB for hack, it simplifies the algorithm

    */
}
