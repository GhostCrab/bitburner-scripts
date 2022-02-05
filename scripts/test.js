/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.tprintf("%s", ns.heart.break());

    ns.tprintf("%s", ns.getAugmentationsFromFaction("Netburners"));
    ns.tprintf("%s", ns.getOwnedAugmentations());
    ns.tprintf("%s", ns.getAugmentationPrice("NeuroFlux Governor"));

    let stats = ns.getAugmentationStats("NeuroFlux Governor");
    for (const [key, val] of Object.entries(stats)) {
        ns.tprintf("%s %s", key, val)
    }

}
