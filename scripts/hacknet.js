export const HSUpgradeType = {
    LEVEL: "level",
    RAM: "ram",
    CORES: "cores",
    CACHE: "cache",
    SERVER: "server",
};

class HSUpgrade {
    /** @param {import(".").NS } ns */
    constructor(ns, id, type, _stats) {
        const hashBuyCost = ns.hacknet.hashCost("Sell for Money");
        const prodMult = ns.getPlayer().hacknet_node_money_mult;
        const coreCostMult = ns.getPlayer().hacknet_node_core_cost_mult;
        const levelCostMult = ns.getPlayer().hacknet_node_level_cost_mult;
        const ramCostMult = ns.getPlayer().hacknet_node_ram_cost_mult;

        let stats;
        if (_stats) stats = _stats;
        else stats = ns.hacknet.getNodeStats(id);

        this.id = id;
        this.type = type;

        switch (this.type) {
            case HSUpgradeType.LEVEL: {
                this.upgradeCost = ns.formulas.hacknetServers.levelUpgradeCost(stats.level, 1, levelCostMult);
                this.upgradeProductionTotal = ns.formulas.hacknetServers.hashGainRate(
                    stats.level + 1,
                    0,
                    stats.ram,
                    stats.cores,
                    prodMult
                );
                break;
            }
            case HSUpgradeType.RAM: {
                this.upgradeCost = ns.formulas.hacknetServers.ramUpgradeCost(stats.ram, 1, ramCostMult);
                this.upgradeProductionTotal = ns.formulas.hacknetServers.hashGainRate(
                    stats.level,
                    0,
                    stats.ram * 2,
                    stats.cores,
                    prodMult
                );
                break;
            }
            case HSUpgradeType.CORES: {
                this.upgradeCost = ns.formulas.hacknetServers.coreUpgradeCost(stats.cores, 1, coreCostMult);
                this.upgradeProductionTotal = ns.formulas.hacknetServers.hashGainRate(
                    stats.level,
                    0,
                    stats.ram,
                    stats.cores + 1,
                    prodMult
                );
                break;
            }
            case HSUpgradeType.CACHE: {
                this.upgradeCost = ns.formulas.hacknetServers.cacheUpgradeCost(stats.cache);
                this.upgradeProductionTotal = stats.production;
                this.cacheIncrease = stats.cache;
                this.cacheCostPerHash = this.upgradeCost / this.cacheIncrease;
                break;
            }
        }

        this.upgradeProductionIncrease = this.upgradeProductionTotal - stats.production;
        this.upgradeCashProduction = (this.upgradeProductionTotal / hashBuyCost) * 1000000;
        this.upgradePayoffTime = (this.upgradeCost / this.upgradeCashProduction) * 1000;
        this.upgradeValue = this.upgradeProductionIncrease / this.upgradeCost;
    }

    toString(ns, totalProduction) {
        const hashBuyCost = ns.hacknet.hashCost("Sell for Money");
        const totalUpgradeCashProduction = ((totalProduction + this.upgradeProductionIncrease) / hashBuyCost) * 1000000;
        const totalUpgradePayoffTime = (this.upgradeCost / totalUpgradeCashProduction) * 1000;

        return ns.sprintf(
            "%02d => %6s %9s +%s h/s %6s %5.2f h/s/$bn",
            this.id,
            this.type,
            ns.nFormat(this.upgradeCost, "($0.000a)"), // cost
            ns.nFormat(this.upgradeProductionIncrease, "(0.000a)"), // hash increase
            stFormat(ns, totalUpgradePayoffTime), // upgrade payoff time
            this.upgradeValue * 1000000000
        );
    }

    buy(ns) {
        const hashBuyCost = ns.hacknet.hashCost("Sell for Money");
        const numHashBuys = Math.floor(ns.hacknet.numHashes() / hashBuyCost);
        let effectiveMoneyAvailable = ns.getPlayer().money + numHashBuys * 1000000;

        if (effectiveMoneyAvailable < this.upgradeCost) {
            ns.tprintf("WARNING: Attempted to buy an upgrade you can't afford");
            return false;
        }

        while (ns.getPlayer().money < this.upgradeCost) {
            ns.hacknet.spendHashes("Sell for Money");
        }

        switch (this.type) {
            case HSUpgradeType.LEVEL: {
                return ns.hacknet.upgradeLevel(this.id, 1);
            }
            case HSUpgradeType.RAM: {
                return ns.hacknet.upgradeRam(this.id, 1);
            }
            case HSUpgradeType.CORES: {
                return ns.hacknet.upgradeCore(this.id, 1);
            }
            case HSUpgradeType.CACHE: {
                return ns.hacknet.upgradeCache(this.id, 1);
            }
            case HSUpgradeType.SERVER: {
                return ns.hacknet.purchaseNode();
            }
        }
    }
}

function stFormat(ns, ms, showms = false, showfull = false) {
    let timeLeft = ms;
    let hours = Math.floor(ms / (1000 * 60 * 60));
    timeLeft -= hours * (1000 * 60 * 60);
    let minutes = Math.floor(timeLeft / (1000 * 60));
    timeLeft -= minutes * (1000 * 60);
    let seconds = Math.floor(timeLeft / 1000);
    timeLeft -= seconds * 1000;
    let milliseconds = timeLeft;

    if (showms) {
        if (hours > 0 || showfull) return ns.sprintf("%dh%02dm%02d.%03ds", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%dm%02d.%03ds", minutes, seconds, milliseconds);
        return ns.sprintf("%d.%03ds", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%dh%02dm%02ds", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%dm%02ds", minutes, seconds);
        return ns.sprintf("%ds", seconds);
    }
}

function generateNewServerValue(ns) {
    let stats = {
        ...ns.hacknet.getNodeStats(0),
        cache: 1,
        cores: 1,
        hashCapacity: 64,
        level: 1,
        ram: 1,
        timeOnline: 1,
        totalProduction: 1,
        production: ns.formulas.hacknetServers.hashGainRate(
            1,
            0,
            1,
            1,
            ns.getPlayer().hacknet_node_money_mult
        ),
        totalCost: ns.hacknet.getPurchaseNodeCost(),
    };
    // ns.tprintf("New Server Production: %s", stats.production);
    // ns.tprintf("New Server Cost: %s", ns.nFormat(stats.totalCost, "($0.000a)"));
    // ns.tprintf("New Server Total Value: %.2f h/s/$bn", (stats.production / stats.totalCost) * 1000000000);

    let bestUpgrade;
    while (true) {
        let hashServerUpgrades = Object.keys(HSUpgradeType)
            .map((key) => new HSUpgrade(ns, ns.hacknet.numNodes(), HSUpgradeType[key], stats))
            .sort((a, b) => b.upgradeValue - a.upgradeValue);

        let newBestUpgrade = hashServerUpgrades[0];

        switch (newBestUpgrade.type) {
            case HSUpgradeType.CORES:
                stats.cores += 1;
                break;
            case HSUpgradeType.LEVEL:
                stats.level += 1;
                break;
            case HSUpgradeType.RAM:
                stats.ram *= 2;
                break;
        }

        let newProduction = ns.formulas.hacknetServers.hashGainRate(
            stats.level,
            0,
            stats.ram,
            stats.cores,
            ns.getPlayer().hacknet_node_money_mult
        );
        let newCost = stats.totalCost + newBestUpgrade.upgradeCost;
        let newValue = newProduction / newCost;

        if (newValue < stats.totalValue) break;

        stats.production = newProduction;
        stats.totalCost = newCost;
        stats.totalValue = newValue;
        bestUpgrade = newBestUpgrade;

        // ns.tprintf(
        //     "%s => Total Value: %s",
        //     hashServerUpgrades[0].toString(ns, stats.production),
        //     stats.totalValue * 1000000000
        // );

        let checkStats = ns.hacknet.getNodeStats(0);
        if (stats.cores >= checkStats.cores && stats.level >= checkStats.level && stats.ram >= checkStats.ram) break;
    }

    if (bestUpgrade === undefined) return;

    bestUpgrade.upgradeCost = ns.hacknet.getPurchaseNodeCost();
    bestUpgrade.upgradeValue = stats.totalValue;
    bestUpgrade.type = HSUpgradeType.SERVER;
    bestUpgrade.upgradeProductionIncrease = stats.production;

    return bestUpgrade;
}

/** @param {import(".").NS } ns */
export async function main(ns) {
	let buyServerUpgrade = generateNewServerValue(ns)

	if (ns.args[0]) {
		let hashServerUpgrades = [buyServerUpgrade];
        let totalProduction = 0;
        for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
            Object.keys(HSUpgradeType).forEach((key) => {
                if (key !== "CACHE" && key != "SERVER")
                    hashServerUpgrades.push(new HSUpgrade(ns, idx, HSUpgradeType[key]));
            });

            totalProduction += ns.hacknet.getNodeStats(idx).production;
        }

        hashServerUpgrades.sort((a, b) => b.upgradeValue - a.upgradeValue);

		for (const upg of hashServerUpgrades)
			ns.tprintf(upg.toString(ns, totalProduction))

		return
	}


    while (true) {
        let hashServerUpgrades = [buyServerUpgrade];
        let totalProduction = 0;
        for (let idx = 0; idx < ns.hacknet.numNodes(); idx++) {
            Object.keys(HSUpgradeType).forEach((key) => {
                if (key !== "CACHE" && key != "SERVER")
                    hashServerUpgrades.push(new HSUpgrade(ns, idx, HSUpgradeType[key]));
            });

            totalProduction += ns.hacknet.getNodeStats(idx).production;
        }

        hashServerUpgrades.sort((a, b) => b.upgradeValue - a.upgradeValue);

        const hashBuyCost = ns.hacknet.hashCost("Sell for Money");
        let numHashBuys = Math.floor(ns.hacknet.numHashes() / hashBuyCost);
        let effectiveMoneyAvailable = ns.getPlayer().money + numHashBuys * 1000000;

        ns.tprintf("Targeting %s", hashServerUpgrades[0].toString(ns, totalProduction));
        while (effectiveMoneyAvailable < hashServerUpgrades[0].upgradeCost) {
            numHashBuys = Math.floor(ns.hacknet.numHashes() / hashBuyCost);
            effectiveMoneyAvailable = ns.getPlayer().money + numHashBuys * 1000000;

            while (ns.hacknet.numHashes() > ns.hacknet.hashCost("Sell for Money")) ns.hacknet.spendHashes("Sell for Money");

            await ns.sleep(1000);
        }

        hashServerUpgrades[0].buy(ns);

		buyServerUpgrade = generateNewServerValue(ns)

        await ns.sleep(20);
    }
}
