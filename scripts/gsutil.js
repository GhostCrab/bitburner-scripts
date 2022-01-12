/** @type import("./index.d").NS */
let ns = null;

export function setns(_ns) {
    ns = _ns
}

export function myprint() {
    let params = Array.prototype.slice.call(arguments, 1);
    ns.tprintf(arguments[0], ...params);
}

export function softenServer(hostName) {
    let server = ns.getServer(hostName);

    if (server.hasAdminRights) {
        return;
    }

    if (!server.sshPortOpen && ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(hostName);
    }

    if (!server.ftpPortOpen && ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(hostName);
    }

    if (!server.httpPortOpen && ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(hostName);
    }

    if (!server.smtpPortOpen && ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(hostName);
    }

    if (!server.sqlPortOpen && ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(hostName);
    }

    server = ns.getServer(hostName);
    if (server.openPortCount >= server.numOpenPortsRequired) {
        ns.nuke(hostName);
    }
}

export function serverIsHackable(hostName) {
    const server = ns.getServer(hostName);
    return server.hasAdminRights && ns.getHackingLevel() >= server.requiredHackingSkill;
}

export function canExecuteOnServer(hostName) {
    const server = ns.getServer(hostName);
    return server.hasAdminRights;
}
