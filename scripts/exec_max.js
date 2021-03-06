/** @type import("./index.d").NS */
let ns = null;

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    let script = ns.args[0];
    let host = ns.args[1];
    let args = ns.args.slice(2);
    let doSpawn = false;

    if (host === "local") {
        host = ns.getHostname();
        doSpawn = true;
    }

    if (!ns.fileExists(script, "home")) {
        ns.tprintf("[%s] ERROR: %s does not exist on home server", ns.getScriptName(), script, host);
        return;
    }
    await ns.scp(script, "home", host);

    let scriptRam = ns.getScriptRam(script, host);
    let hostMaxRam = ns.getServerMaxRam(host);

    if (host === "home") hostMaxRam -= 128;

    let threads = Math.floor(hostMaxRam / scriptRam);

    if (threads <= 0) return;

    if (doSpawn) {
        ns.tprintf("Spawning %s@%s on %s over %d threads", script, host, args.toString(), threads);
        ns.spawn(script, threads, ...args);
    } else {
        ns.killall(host);
        let pid = ns.exec(script, host, threads, ...args);
        ns.tprintf("Executing %s@%s on %s over %d threads [pid: %d]", script, host, args.toString(), threads, pid);
    }
}
