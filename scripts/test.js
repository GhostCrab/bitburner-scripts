/** @param {import(".").NS } ns */
export async function main(ns) {
    while (ns.getPlayer().numPeopleKilled < 30) {
        await ns.sleep(ns.commitCrime("homicide") + 200)
    }
}
