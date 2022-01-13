import { allHosts, mapHosts, setns, softenServer } from "./util.js";

async function doBackdoors(ns) {
    const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n", "b-and-a", "ecorp"];
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n"];
    let hosts = mapHosts();

    for (const [hostName, trail] of Object.entries(hosts)) {
        let server = ns.getServer(hostName);
        if (
            !targetHosts.includes(hostName) ||
            server.backdoorInstalled ||
            server.requiredHackingSkill > ns.getHackingLevel() ||
            !server.hasAdminRights
        )
            continue;

        for (const hostHopName of trail) {
            ns.connect(hostHopName);
        }

        await ns.installBackdoor();
        ns.connect("home");
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    setns(ns)

    for (const hostName of allHosts()) {
        softenServer(hostName);
    }

    await doBackdoors(ns);
}
