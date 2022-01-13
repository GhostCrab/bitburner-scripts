import { HackEnv, TSPACER } from "./hack_env.js";

const debug = false;

// TODO: Manage multiple target/host combos from a single manager
// TODO: Incorporate sim into deciding to use GW/HW vs HGW
// TODO: Incorporate eff's bucket/target search algorithm

//** @param {NS} ns **/
/** @param {import(".").NS } ns */
export async function main(ns) {
    if (!ns.args[0]) {
        ns.tprintf("ERROR: No target server defined");
        return;
    }

    let env = new HackEnv(ns, ns.args[0], ns.args[2], ns.args[1]);
    await env.prep(ns);

    if (debug) env.printRamOverride(ns);
    if (debug) ns.tprintf("INFO: Availble host RAM %.2f", env.ramAllowance);

    env.simEnabled = false;
    if (env.simEnabled) {
        while (env.simTime < 1000 * 60 * 2) {
            env.refresh(ns);
        }
        ns.tprintf(
            "Time Elapsed: %s; Income %s | %s/s",
            ns.tFormat(env.simTime),
            ns.nFormat(env.simIncome, "($0.000a)"),
            ns.nFormat(env.simIncome / (env.simTime / 1000), "($0.000a)")
        );
    } else {
        while (true) {
            env.refresh(ns);
            await ns.sleep(TSPACER);
        }
    }
}