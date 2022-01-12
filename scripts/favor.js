/** @param {import("./index.d").NS } ns */
export async function main(ns) {

	for (let faction of ns.getPlayer().factions) {
		let favor = ns.getFactionFavor(faction)
		let fGain = ns.getFactionFavorGain(faction)

		if (favor > 150)
			continue
		
		let successStr = ""
		if (favor + fGain > 150) {
			successStr = "(SUCCESS)"
		}

		ns.tprintf("%s => %.2f + %.2f = %.2f %s", faction, favor, fGain, favor + fGain, successStr)
	}
}