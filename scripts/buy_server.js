/** @type import("./index.d").NS */
let ns = null;

function serverRamSortAsc(h1, h2) {
    const s1 = ns.getServer(h1);
    const s2 = ns.getServer(h2);

    if (s1.maxRam > s2.maxRam) return 1;
    if (s1.maxRam < s2.maxRam) return -1;
    return 0;
}

function serverRamSortDesc(h1, h2) {
    const s1 = ns.getServer(h1);
    const s2 = ns.getServer(h2);

    if (s1.maxRam > s2.maxRam) return -1;
    if (s1.maxRam < s2.maxRam) return 1;
    return 0;
}

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    let ram = ns.args[0];
    let count = ns.args[1];
    let cash = ns.getServerMoneyAvailable("home");

    if (count === undefined) count = 1;

    if (ram === undefined) {
        // ns.tprintf("Calculating maximum ram allocation for new server (Cash: %s)", ns.nFormat(cash, '($0.000a)'))
        ram = 0;
        for (let i = 0; i <= 20; i++) {
            let curRam = Math.pow(2, i);
            let cost = ns.getPurchasedServerCost(curRam);
            if (cost <= cash) ram = curRam;
            else break;
        }

        let cost = ns.getPurchasedServerCost(ram);
        let maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        ram /= 2;
        if (ram < 256) return;
        cost = ns.getPurchasedServerCost(ram);
        maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        ram /= 2;
        if (ram < 256) return;
        cost = ns.getPurchasedServerCost(ram);
        maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        ram /= 2;
        if (ram < 256) return;
        cost = ns.getPurchasedServerCost(ram);
        maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        ram /= 2;
        if (ram < 256) return;
        cost = ns.getPurchasedServerCost(ram);
        maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        ram /= 2;
        if (ram < 256) return;
        cost = ns.getPurchasedServerCost(ram);
        maxServers = Math.min(Math.floor(cash / cost), 25);
        ns.tprintf("run buy_server.js %d %d %s", ram, maxServers, ns.nFormat(cost * maxServers, "($0.000a)"));

        return;
    }

    let cost = ns.getPurchasedServerCost(ram) * count;
    if (cash < cost) {
        ns.tprintf(
            "Unable to purchase %d server(s) with %d ram (%s < %s)",
            count,
            ram,
            ns.nFormat(cash, "($0.000a)"),
            ns.nFormat(cost, "($0.000a)")
        );
        return;
    }

    for (let i = 0; i < count; i++) {
        let pservers = ns.getPurchasedServers().sort(serverRamSortAsc);
        let nextIdx = pservers.length;
        let nextServerName = "pserv-" + nextIdx;

        if (pservers.length === ns.getPurchasedServerLimit()) {
            let delServer = ns.getServer(pservers[0]);

            if (delServer.maxRam >= ram) {
                ns.tprintf(
                    "Max servers reached and new server is not an improvement (%dGB/%dGB ram)",
                    delServer.maxRam,
                    ram
                );
                return;
            }

            ns.tprintf("Deleting server %s with %dGB ram", delServer.hostname, delServer.maxRam);
            nextServerName = delServer.hostname;
            ns.killall(delServer.hostname);
            ns.deleteServer(delServer.hostname);
        }

        let hostname = ns.purchaseServer(nextServerName, ram);
        ns.tprintf("Purchased server %s with %d ram for %s", hostname, ram, ns.nFormat(cost / count, "($0.000a)"));
    }
}
