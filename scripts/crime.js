/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.disableLog("sleep");

    const crimes = [
        "rob store",
        "mug",
        "larceny",
        "drugs",
        "bond forge",
        "traffick arms",
        "homicide",
        "grand auto",
        "kidnap",
        "assassinate",
        "heist",
    ];

    for (const crimename of crimes) {
        const crimeStats = ns.getCrimeStats(crimename);
        ns.tprintf("%s: %s %s %s", crimeStats.name, crimeStats.money, crimeStats.time, crimeStats.money / (crimeStats.time / 1000));
    }

    while (!ns.getPlayer().factions.includes("234234")) {
        await ns.sleep(ns.commitCrime("mug") + 200);

        let allFactions = ns.getPlayer().factions.concat(ns.checkFactionInvitations());
        // if (allFactions.includes("NiteSec")) {
        //     ns.joinFaction("NiteSec")
        // }
    }

    ns.workForFaction("NiteSec", "Field Work");
}
