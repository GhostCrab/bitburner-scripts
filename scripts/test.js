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

    let p = doc.createElement("Typography", { id: "overview-extra-hook-X", classes: "{{ root: classes.hack }}" });
    hook0.after(p)
}
