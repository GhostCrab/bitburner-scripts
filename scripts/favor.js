/** @param {import("./index.d").NS } ns */
export async function main(ns) {
    let favorToRep = function(f) {
        function fma(a, b, c) {
          return a * b + c;
        }
        const ex = fma(f - 1, Math.log(51.0) - Math.log(50.0), Math.log(51.0));
        const raw = fma(500.0, Math.exp(ex), -25000.0);
        return Math.round(raw * 10000) / 10000; // round to make things easier.
      }
      
      function repToFavor(r) {
        const raw = Math.log((r + 25000) / 25500) / Math.log(1.02) + 1;
        return Math.round(raw * 10000) / 10000; // round to make things easier.
      }

    for (let faction of ns.getPlayer().factions) {
        const favor = ns.getFactionFavor(faction);
        const targetRep = favorToRep(150);
        const storedRep = Math.max(0, favorToRep(favor));
        const totalRep =
            storedRep +
            ns.getFactionRep(faction) +
            (ns.getPlayer().currentWorkFactionName === faction ? ns.getPlayer().workRepGained : 0);

        const fGain = repToFavor(totalRep);

        if (favor > 150) continue;

        let successStr = "";
        if (favor + fGain > 150) {
            successStr = " (SUCCESS)";
        }

        let needStr = " ";
        if (totalRep < targetRep) {
        needStr = ns.sprintf(" | Need +%s Rep", ns.nFormat(targetRep - totalRep, "0.000a"));
        }

        ns.tprintf("%s => %.2f + %.2f = %.2f%s%s", faction, favor, fGain, favor + fGain, needStr, successStr);
    }
}
