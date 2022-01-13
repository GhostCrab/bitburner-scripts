import { allHosts, setns, softenServer } from "./util.js";

/** @param {NS} ns **/
export async function main(ns) {
    setns(ns)

    for (const hostName of allHosts()) {
        softenServer(hostName);
    }
}
