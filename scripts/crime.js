/** @param {import(".").NS } ns */
function stFormat(ns, ms, showms = true, showfull = false) {
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

export async function main(ns) {
    ns.disableLog("sleep");

    // const crimes = [
    //     "shoplift",
    //     "rob store",
    //     "mug",
    //     "larceny",
    //     "drugs",
    //     "bond forge",
    //     "traffick arms",
    //     "homicide",
    //     "grand auto",
    //     "kidnap",
    //     "assassinate",
    //     "heist",
    // ];

    // for (const crimename of crimes) {
    //     const crimeStats = ns.getCrimeStats(crimename);
    //     ns.tprintf("%16s  %9s %5s %9s/s", crimeStats.name, ns.nFormat(crimeStats.money, "($0.000a)"), stFormat(ns, crimeStats.time, false), ns.nFormat(crimeStats.money / (crimeStats.time / 1000), "($0.000a)"));
    // }

    while (true) {// (!ns.getPlayer().factions.includes("NiteSec")) {
        await ns.sleep(ns.commitCrime("larceny") + 200);

        let allFactions = ns.getPlayer().factions.concat(ns.checkFactionInvitations());
        if (allFactions.includes("NiteSec")) {
            ns.joinFaction("NiteSec")
        }
    }

    ns.workForFaction("NiteSec", "Field Work");
}
