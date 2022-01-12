import { setns, allHosts } from "./util.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
	setns(ns)
    for (let hostname of allHosts()) {
		if (hostname === "home")
			continue
		ns.killall(hostname)
	}
	ns.killall("home")
}
