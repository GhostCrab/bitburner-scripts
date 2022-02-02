function stFormat(ns, ms, showms = true, showfull = false) {
    let timeLeft = ms;
    let hours = Math.floor(ms / (1000 * 60 * 60));
    timeLeft -= hours * (1000 * 60 * 60);
    let minutes = Math.floor(timeLeft / (1000 * 60));
    timeLeft -= minutes * (1000 * 60);
    let seconds = Math.floor(timeLeft / 1000);
    timeLeft -= seconds * 1000;
    let milliseconds = timeLeft;

    if (showms) {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d.%03d", minutes, seconds, milliseconds);
        return ns.sprintf("%02d.%03d", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d", minutes, seconds);
        return ns.sprintf("%02d", seconds);
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    let corp = ns.corporation.getCorporation();

    for (const div of corp.divisions) {
        ns.tprintf("%s: %s - %s", corp.name, div.name, div.type);
        const products = div.products.map((prodname) => ns.corporation.getProduct(div.name, prodname));

        for (const product of products) {
            const marketFactor = Math.max(0.1, (product.dmd * (100 - product.cmp)) / 100);
            ns.tprintf("  %s:", product.name);
            //ns.tprintf("      Development Progress: %s", product.developmentProgress)
            ns.tprintf("      Market Price: %s", ns.nFormat(product.pCost, "($0.000a)"));
            ns.tprintf(
                "      Sell Cost: %s",
                typeof product.sCost === "string"
                    ? product.sCost
                    : ns.nFormat(product.sCost, "($0.000a)")
            );
            ns.tprintf("      Competition: %.2f", product.cmp);
            ns.tprintf("      Demand: %.2f", product.dmd);
            ns.tprintf("      Market Factor: %.2f", marketFactor);

            let mult = 32;
            for (const [key, [qty, prod, sell]] of Object.entries(product.cityData)) {
                const prodDeficit = prod + 0.00000001 - sell;
                ns.tprintf(
                    "        %10s: qty: %-6.2f prod: %-6.2f sell: %-6.2f diff: %-6.2f",
                    key,
                    qty,
                    prod,
                    sell,
                    prodDeficit
                );
                //ns.corporation.sellProduct(div.name, key, product.name, prod * 2, product.pCost * mult + mult.toString(), false);
				mult += 10
            }
        }
    }
}
