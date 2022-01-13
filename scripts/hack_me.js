/** @param {NS} _ns **/
export async function main(ns) {
    const hostname = ns.args[0];

    // Defines how much money a server should have before we hack it
    // In this case, it is set to 75% of the server's max money
    var moneyThresh = ns.getServerMaxMoney(hostname) * 0.75;

    // Defines the maximum security level the target server can
    // have. If the target's security level is higher than this,
    // we'll weaken it before doing anything else
    var securityThresh = ns.getServerMinSecurityLevel(hostname) + 5;

    // Infinite loop that continously hacks/grows/weakens the target server
    while (true) {
        if (ns.getServerSecurityLevel(hostname) > securityThresh) {
            // If the server's security level is above our threshold, weaken it
            await ns.weaken(hostname);
        } else if (ns.getServerMoneyAvailable(hostname) < moneyThresh) {
            // If the server's money is less than our threshold, grow it
            await ns.grow(hostname);
        } else {
            // Otherwise, hack it
            await ns.hack(hostname);
        }
    }
}