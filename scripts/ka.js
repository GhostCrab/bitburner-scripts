import { allHosts } from "./util.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
    for (let hostname of allHosts(ns)) {
        if (hostname === "home") continue;
        ns.killall(hostname);
    }

    for (let ps of ns.ps("home")) {
        if (
            ps.filename === "ka.js" ||
            ps.filename === "clock.js" ||
            ps.filename === "leech.js" ||
            ps.filename === "hacknet.js" ||
            ps.filename === "hacking_gang.js" ||
			ps.filename === "corp.js" ||
            ps.filename === "cct.js"
        )
            continue;
        ns.kill(ps.pid);
    }
}
