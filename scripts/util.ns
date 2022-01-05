/** @type import(".").NS */
let ns = null;

export function setns(_ns) {
    ns = _ns;
}

export function myprint() {
    let params = Array.prototype.slice.call(arguments, 1);
    ns.tprintf(arguments[0], ...params);
}

export function softenServer(hostname) {
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

export function serverIsHackable(hostname) {
    return (
        ns.hasRootAccess(hostname) &&
        ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname)
    );
}

export function canExecuteOnServer(hostname) {
    return ns.hasRootAccess(hostname) && ns.getServerMaxRam(hostname) > 0;
}

export function mapHosts(hosts = {}, parents = [], current = "home") {
    let newParents = parents.concat(current);
    hosts[current] = newParents;

    let children = ns.scan(current).filter((element) => !parents.includes(element));
    for (const child of children) {
        mapHosts(hosts, newParents, child);
    }
    return hosts
}

export function allHosts() {
    return Object.keys(mapHosts());
}

export function serverMaxMoneySortDesc(a, b) {
    return ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a)
}

export function serverMaxMoneySortAsc(a, b) {
    return ns.getServerMaxMoney(a) - ns.getServerMaxMoney(b)
}

export function doProgramBuys() {
    let player = ns.getPlayer();

    if (!player.tor && player.money > 200e3) ns.purchaseTor();

    if (!ns.fileExists("BruteSSH.exe", "home") && player.money > 500e3) ns.purchaseProgram("BruteSSH.exe");

    if (!ns.fileExists("FTPCrack.exe", "home") && player.money > 1500e3) ns.purchaseProgram("FTPCrack.exe");

    if (!ns.fileExists("relaySMTP.exe", "home") && player.money > 5e6) ns.purchaseProgram("relaySMTP.exe");

    if (!ns.fileExists("HTTPWorm.exe", "home") && player.money > 30e6) ns.purchaseProgram("HTTPWorm.exe");

    if (!ns.fileExists("SQLInject.exe", "home") && player.money > 250e6) ns.purchaseProgram("SQLInject.exe");
}