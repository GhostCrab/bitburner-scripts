import { allHosts, softenServer } from "./util.js";

/** @param {import(".").NS } ns */
function listServers(ns, hostnames) {
    let hackableHosts = hostnames.sort((a, b) => ns.getServerRequiredHackingLevel(b) - ns.getServerRequiredHackingLevel(a));

    for (const hostname of hackableHosts) {
        const rootStr = ns.hasRootAccess(hostname) ? "[O]" : "[X]";
        const hackStr = ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname) ? "[O]" : "[X]";
        ns.tprintf(
            "%20s %-9s %4d %s %s %6dGB %8.2f",
            hostname,
            ns.nFormat(ns.getServerMaxMoney(hostname), "($0.000a)"),
            ns.getServerRequiredHackingLevel(hostname),
            rootStr,
            hackStr,
            ns.getServerMaxRam(hostname),
            Math.ceil(ns.getWeakenTime(hostname) / 1000) / 60
        );
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    let hostnames = allHosts(ns)

    for (const hostname of hostnames) {
        softenServer(ns, hostname);
    }

    listServers(ns, hostnames);
}
