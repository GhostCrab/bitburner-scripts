/** @type import(".").NS */
let ns = null;

import { setns, doProgramBuys } from "./util.js";

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    setns(ns);

    doProgramBuys();
}
