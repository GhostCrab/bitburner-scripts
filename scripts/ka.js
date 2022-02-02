import { setns, allHosts } from "./util.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);
    for (let hostname of allHosts()) {
        if (hostname === "home") continue;
        ns.killall(hostname);
    }

	for (let ps of ns.ps("home")) {
		if (ps.filename === "ka.js" || ps.filename === "clock.js" || ps.filename === "leech.js" || ps.filename === "hacknet.js" || ps.filename === "hacking_gang.js")
			continue
    	ns.kill(ps.pid)
	}
}
