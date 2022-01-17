/** @param {import(".").NS } ns */
export async function main(ns) {
    let writeData = !!ns.args[6];
    let actualStart, actualFinish;
    const hostname = ns.args[0];
    let tsleep = ns.args[1];

    if (tsleep) await ns.sleep(tsleep);
    if (writeData) {
        actualStart = Date.now() - Number(ns.args[7]);
    }
    await ns.hack(hostname);
    if (writeData) {
        actualFinish = Date.now() - Number(ns.args[7]);
        let outstr = ns.sprintf(
            "%s,%03d-%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
            ns.args[0], // targetname
            ns.args[5],
            ns.args[8], // batchID + Script Type
            ns.args[5], // batchID
            ns.args[1], // offset
            ns.args[2], // est start time
            ns.args[3], // est end time
            Number(ns.args[3]) - Number(ns.args[2]), // est operation time
            actualStart, // actual start
            actualFinish, // actual end
            actualFinish - actualStart, // actual operation time
            (Number(ns.args[3]) - Number(ns.args[2])) - (actualFinish - actualStart), // difference between est and actual operation times
            ns.args[4] // est exp
        );

        await ns.write(ns.args[6], outstr, "a");
    }
}
