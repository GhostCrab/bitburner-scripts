/** @param {import("./index.d").NS } ns */
export async function main(ns) {
    
	let favorToRep = function (f) {
        const raw = 25000 * (Math.pow(1.02, f) - 1);
        return Math.round(raw * 10000) / 10000; // round to make things easier.
    };

    for (let faction of ns.getPlayer().factions) {
		const favor = ns.getFactionFavor(faction);
		const targetRep = favorToRep(150)
        const storedRep = Math.max(0, favorToRep(favor));
        const totalRep = storedRep + ns.getFactionRep(faction);
        
        const fGain = ns.getFactionFavorGain(faction);

		const player = ns.getPlayer()

        if (favor > 150) continue;

        let successStr = "";
        if (favor + fGain > 150) {
            successStr = " (SUCCESS)";
        }

		let needStr = " "
		// if (totalRep < targetRep) {
			needStr = ns.sprintf(" | Need +%s Rep", ns.nFormat(targetRep - totalRep, '0.000a'),)
		//}

        ns.tprintf("%s => %.2f + %.2f = %.2f%s%s", faction, favor, fGain, favor + fGain, needStr, successStr);
    }
}
