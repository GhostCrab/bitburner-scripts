export function llog(ns, str, ...args) {
    ns.print(ns.sprintf("%8s " + str, new Date().toLocaleTimeString("it-IT"), ...args));
}

export function softenServer(ns, hostname) {
    if (ns.hasRootAccess(hostname)) {
        return;
    }

    let ports = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(hostname);
        ports++;
    }

    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(hostname);
        ports++;
    }

    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(hostname);
        ports++;
    }

    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(hostname);
        ports++;
    }

    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(hostname);
        ports++;
    }

    if (ports >= ns.getServerNumPortsRequired(hostname)) {
        ns.nuke(hostname);
    }
}

export function serverIsHackable(ns, hostname) {
    return (
        ns.hasRootAccess(hostname) &&
        ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname)
    );
}

export function canExecuteOnServer(ns, hostname) {
    return ns.hasRootAccess(hostname) && ns.getServerMaxRam(hostname) > 0;
}

export function mapHosts(ns, hosts = {}, parents = [], current = "home") {
    let newParents = parents.concat(current);
    hosts[current] = newParents;

    let children = ns.scan(current).filter((element) => !parents.includes(element));
    for (const child of children) {
        mapHosts(ns, hosts, newParents, child);
    }
    return hosts
}

export function allHosts(ns) {
    return Object.keys(mapHosts(ns));
}

export function doProgramBuys(ns) {
    let player = ns.getPlayer();

    if (!player.tor && player.money > 200e3) ns.purchaseTor();

    if (!ns.fileExists("BruteSSH.exe", "home") && player.money > 500e3) ns.purchaseProgram("BruteSSH.exe");

    if (!ns.fileExists("FTPCrack.exe", "home") && player.money > 1500e3) ns.purchaseProgram("FTPCrack.exe");

    if (!ns.fileExists("relaySMTP.exe", "home") && player.money > 5e6) ns.purchaseProgram("relaySMTP.exe");

    if (!ns.fileExists("HTTPWorm.exe", "home") && player.money > 30e6) ns.purchaseProgram("HTTPWorm.exe");

    if (!ns.fileExists("SQLInject.exe", "home") && player.money > 250e6) ns.purchaseProgram("SQLInject.exe");
}

export function doBuyAndSoftenAll(ns) {
    doProgramBuys(ns)
    for (const hostname of allHosts(ns)) {
        softenServer(ns, hostname);
    }
}

export function stFormat(ns, ms, showms = false, showfull = false) {
    let timeLeft = ms;
    let hours = Math.floor(ms / (1000 * 60 * 60));
    timeLeft -= hours * (1000 * 60 * 60);
    let minutes = Math.floor(timeLeft / (1000 * 60));
    timeLeft -= minutes * (1000 * 60);
    let seconds = Math.floor(timeLeft / 1000);
    timeLeft -= seconds * 1000;
    let milliseconds = timeLeft;

    if (showms) {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d.%03d", minutes, seconds, milliseconds);
        return ns.sprintf("%02d.%03d", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d", minutes, seconds);
        return ns.sprintf("%02d", seconds);
    }
}

export function stdFormat(ns, offset = 0, showms = false) {
    let date = new Date(new Date().getTime() + offset);

    if (showms) {
        let ms = ns.sprintf("%03d", date.getUTCMilliseconds());
        return date.toLocaleTimeString("it-IT") + "." + ms;
    } else {
        return date.toLocaleTimeString("it-IT");
    }
}

export async function doBackdoors(ns) {
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n", "b-and-a", "ecorp", "fulcrumassets", "fulcrumtech"];
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "omnitek", "kuai-gong", "megacorp"];
    const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n"];

    let hosts = mapHosts(ns);

    for (const [hostName, trail] of Object.entries(hosts)) {
        let server = ns.getServer(hostName);
        if (
            !targetHosts.includes(hostName) ||
            server.backdoorInstalled ||
            server.requiredHackingSkill > ns.getHackingLevel() ||
            !server.hasAdminRights
        )
            continue;

        ns.print(hostName);
        for (const hostHopName of trail) {
            ns.connect(hostHopName);
        }

        await ns.installBackdoor();
        ns.connect("home");
    }
}

export function cleanLogs(ns) {
    ns.disableLog("disableLog")
    ns.disableLog("ALL")
    // ns.disableLog("sleep")
    // ns.disableLog("exec")
    // ns.disableLog("getServerMaxRam")
    // ns.disableLog("getServerSecurityLevel")
    // ns.disableLog("getServerMinSecurityLevel")
    // ns.disableLog("getServerMaxMoney")
    // ns.disableLog("getHackingLevel")
    // ns.disableLog("getServerRequiredHackingLevel")
    // ns.disableLog("scan")
    // ns.disableLog("getServerMoneyAvailable")
    // ns.disableLog("getServerUsedRam")
}

export const ALL_FACTIONS = [
    "Illuminati",
    "Daedalus",
    "The Covenant",
    "ECorp",
    "MegaCorp",
    "Bachman & Associates",
    "Blade Industries",
    "NWO",
    "Clarke Incorporated",
    "OmniTek Incorporated",
    "Four Sigma",
    "KuaiGong International",
    "Fulcrum Secret Technologies",
    "BitRunners",
    "The Black Hand",
    "NiteSec",
    "Aevum",
    "Chongqing",
    "Ishima",
    "New Tokyo",
    "Sector-12",
    "Volhaven",
    "Speakers for the Dead",
    "The Dark Army",
    "The Syndicate",
    "Silhouette",
    "Tetrads",
    "Slum Snakes",
    "Netburners",
    "Tian Di Hui",
    "CyberSec",
    "Bladeburners",
    "Church of the Machine God"
];