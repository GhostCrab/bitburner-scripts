/** @param {NS} _ns **/
export async function main(ns) {
    const hostname = ns.args[0];
    let tsleep = ns.args[1];
    if (tsleep) await ns.sleep(tsleep);
    await ns.hack(hostname);
}