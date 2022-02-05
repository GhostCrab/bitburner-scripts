import { allHosts, doBackdoors, softenServer } from "./util.js";

/** @param {NS} ns **/
export async function main(ns) {
    for (const hostName of allHosts(ns)) {
        softenServer(ns, hostName);
    }

    await doBackdoors(ns);
}
