/** @type import(".").NS */
let ns = null;

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    ns.tprintf("HELLO PUSHER #3");
}