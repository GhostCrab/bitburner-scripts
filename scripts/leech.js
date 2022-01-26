/** @param {import(".").NS } ns */
export async function main(ns) {
    while (false) {
        while (ns.hacknet.numHashes() > ns.hacknet.hashCost("Sell for Money")) ns.hacknet.spendHashes("Sell for Money");
        await ns.sleep(1000);
    }

    while (true) {
        let studyCost = ns.hacknet.hashCost("Increase Maximum Money");

        while (ns.hacknet.hashCapacity() < studyCost) {
            while (ns.hacknet.numHashes() > ns.hacknet.hashCost("Sell for Money"))
                ns.hacknet.spendHashes("Sell for Money");

            // find the cheapest cache upgrade and attempt to buy it
            let targetIdx = -1;
            let targetIdxCost = Number.MAX_SAFE_INTEGER;
            for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
                let idxCost = ns.hacknet.getCacheUpgradeCost(idx, 1);
                if (idxCost < targetIdxCost) {
                    targetIdx = idx;
                    targetIdxCost = idxCost;
                }
            }

            if (ns.getPlayer().money > targetIdxCost) {
                ns.hacknet.upgradeCache(targetIdx, 1);
                continue;
            }

            await ns.sleep(1000);
        }

        while (ns.hacknet.numHashes() < studyCost) await ns.sleep(1000);

        ns.hacknet.spendHashes("Increase Maximum Money", "4sigma");

        await ns.sleep(20);
    }
}
