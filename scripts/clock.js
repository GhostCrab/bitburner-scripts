/** @param {import(".").NS } ns */
export async function main(ns) {
    const args = ns.flags([["help", false]]);
    if (args.help) {
        ns.tprint("This script will enhance your HUD (Heads up Display) with custom statistics.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }

    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");

    ns.atExit(function() {
        hook0.innerText = ""
    })

    while (true) {
        try {
            let date = new Date()
            let ms = ns.sprintf("%03d", date.getUTCMilliseconds())
            hook0.innerText = date.toLocaleTimeString("it-IT") + "." + ms;
        } catch (err) { // This might come in handy later
            ns.print("ERROR: Update Skipped: " + String(err));
        }
        await ns.sleep(20);
    }
}
