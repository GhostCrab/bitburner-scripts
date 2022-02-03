const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

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
    const agDivName = "Agriculture";
    const tbDivName = "Tobacco";
    const tbRDCity = "Aevum";

    // if the Tobacco division is already open, dont fuss with Agriculture
    if (ns.corporation.getCorporation().divisions.find((div) => div.type === tbDivName) !== undefined) {
        // open the Agriculture division
        if (ns.corporation.getCorporation().divisions.find((div) => div.type === agDivName) === undefined) {
            let divCost = ns.corporation.getExpandIndustryCost(agDivName);

            ns.tprintf("Corporation => Starting %s division for %s", agDivName, ns.nFormat(divCost, "($0.000a)"));

            ns.corporation.expandIndustry(agDivName, agDivName);
        }

        // buy one time upgrades Smart Supply and Warehouse API
        for (const upgrade of ["Smart Supply", "Warehouse API"]) {
            if (!ns.corporation.hasUnlockUpgrade(upgrade)) {
                let upgradeCost = ns.corporation.getUnlockUpgradeCost(upgrade);
                let corpFunds = ns.corporation.getCorporation().funds;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "WARNING: Corporation => Insufficient funds to purchase %s %s < %s",
                        upgrade,
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                } else {
                    ns.tprintf(
                        "Corporation => Purchasing %s upgrade for %s",
                        upgrade,
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    ns.corporation.unlockUpgrade(upgrade);
                }
            }
        }

        // buy levelable upgrades FocusWires, Neural Accelerators, Speech Processor Implants,
        // Nuoptimal Nootropic Injector Implants, and Smart Factories
        let leveledUpgrades = [
            "FocusWires",
            "Neural Accelerators",
            "Speech Processor Implants",
            "Nuoptimal Nootropic Injector Implants",
            "Smart Factories",
        ];
        for (const upgrade of leveledUpgrades) {
            while (ns.corporation.getUpgradeLevel(upgrade) < 2) {
                let upgradeCost = ns.corporation.getUpgradeLevelCost(upgrade);
                let corpFunds = ns.corporation.getCorporation().funds;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "WARNING: Corporation => Insufficient funds to purchase %s %s < %s",
                        upgrade,
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    break;
                } else {
                    ns.tprintf(
                        "Corporation => Purchasing %s upgrade for %s",
                        upgrade,
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    ns.corporation.levelUpgrade(upgrade);
                }
            }
        }

        // Check primary city's warehouse and upgrade to 500
        const primaryCity = ns.corporation.getDivision(agDivName).cities[0];
        if (!ns.corporation.hasWarehouse(agDivName, primaryCity)) {
            ns.tprintf("ERROR: %s primary city %s does not have a warehouse", agDivName, primaryCity);
            return;
        }

        while (ns.corporation.getWarehouse(agDivName, primaryCity).size < 500) {
            let upgradeCost = ns.corporation.getUpgradeWarehouseCost(agDivName, primaryCity);
            let corpFunds = ns.corporation.getCorporation().funds;
            let startSize = ns.corporation.getWarehouse(agDivName, primaryCity).size;

            if (corpFunds < upgradeCost) {
                ns.tprintf(
                    "WARNING: Corporation => Insufficient funds to purchase a warehouse upgrade %s < %s",
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
            } else {
                ns.corporation.upgradeWarehouse(agDivName, primaryCity);
                let endSize = ns.corporation.getWarehouse(agDivName, primaryCity).size;
                ns.tprintf(
                    "Corporation => Upgraded %s %s's warehouse size from %s to %s for %s",
                    agDivName,
                    primaryCity,
                    ns.nFormat(startSize, "(0.000a)"),
                    ns.nFormat(endSize, "(0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
            }
        }

        if (ns.corporation.getWarehouse(agDivName, primaryCity).size < 500) {
            ns.tprintf(
                "ERROR: %s primary city %s's warehouse is too small %d < 500",
                agDivName,
                primaryCity,
                ns.corporation.getWarehouse(agDivName, primaryCity).size
            );

            return;
        }

        // buy production materials for primary city
        if (ns.corporation.getMaterial(agDivName, primaryCity, "Real Estate").qty === 0) {
            ns.corporation.buyMaterial(agDivName, primaryCity, "Hardware", 12.5);
            ns.corporation.buyMaterial(agDivName, primaryCity, "AI Cores", 7.5);
            ns.corporation.buyMaterial(agDivName, primaryCity, "Real Estate", 2700);

            while (ns.corporation.getMaterial(agDivName, primaryCity, "Real Estate").qty === 0) await ns.sleep(5);

            ns.tprintf("Corporation => Purchased Round 1 of %s production materials in %s", agDivName, primaryCity);

            ns.corporation.buyMaterial(agDivName, primaryCity, "Hardware", 0);
            ns.corporation.buyMaterial(agDivName, primaryCity, "AI Cores", 0);
            ns.corporation.buyMaterial(agDivName, primaryCity, "Real Estate", 0);
        }

        ns.corporation.setSmartSupply(agDivName, primaryCity, true);

        // Attempt to get first round of funding
        while (ns.corporation.getInvestmentOffer().round < 2) {
            ns.tprintf(
                "Corporation => Investment round 1: waiting for %s %s warehouse to fill",
                agDivName,
                primaryCity
            );

            // Sell plants but not food (food is more expensive per unit)
            ns.corporation.sellMaterial(agDivName, primaryCity, "Food", "0", "0");
            ns.corporation.sellMaterial(agDivName, primaryCity, "Plants", "MAX", "MP");

            while (
                ns.corporation.getWarehouse(agDivName, primaryCity).sizeUsed <
                ns.corporation.getWarehouse(agDivName, primaryCity).size * 0.95
            ) {
                await ns.sleep(1000);
            }

            ns.tprintf(
                "Corporation => Investment round 1: %s %s warehouse is full, initiating bulk sell-off to woo investors",
                agDivName,
                primaryCity
            );

            ns.corporation.sellMaterial(agDivName, primaryCity, "Food", "MAX", "MP*0.9");
            ns.corporation.sellMaterial(agDivName, primaryCity, "Plants", "MAX", "MP*0.9");

            let tookOffer = false;
            let bestOffer = ns.corporation.getInvestmentOffer();
            while (ns.corporation.getWarehouse(agDivName, primaryCity).sizeUsed > 151) {
                let offer = ns.corporation.getInvestmentOffer();

                // only take offers over $335b
                if (offer.funds > 335000000000) {
                    ns.corporation.acceptInvestmentOffer();
                    ns.tprintf(
                        "Corporation => Investment round 1: Taking offer of %s for %d%%",
                        ns.nFormat(offer.funds, "(0.000a)"),
                        (offer.shares / 1000000000) * 100
                    );
                    tookOffer = true;
                    break;
                }

                if (offer.funds > bestOffer.funds) {
                    bestOffer = offer;
                }

                await ns.sleep(100);
            }

            if (!tookOffer) {
                ns.tprintf(
                    "Corporation => Investment round 1: Failed to generate an offer over $335b (best: %s for %d%%)",
                    ns.nFormat(bestOffer.funds, "(0.000a)"),
                    (bestOffer.shares / 1000000000) * 100
                );
            }
        }

        // revert sale prices for now
        ns.corporation.sellMaterial(agDivName, primaryCity, "Food", "MAX", "MP");
        ns.corporation.sellMaterial(agDivName, primaryCity, "Plants", "MAX", "MP");

        // buy one time upgrade Office API
        for (const upgrade of ["Office API"]) {
            if (!ns.corporation.hasUnlockUpgrade(upgrade)) {
                let upgradeCost = ns.corporation.getUnlockUpgradeCost(upgrade);
                let corpFunds = ns.corporation.getCorporation().funds;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "ERROR: Corporation => Insufficient funds to purchase %s %s < %s",
                        upgrade,
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    return;
                } else {
                    ns.tprintf(
                        "Corporation => Purchasing %s upgrade for %s",
                        upgrade,
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    ns.corporation.unlockUpgrade(upgrade);
                }
            }
        }

        // Expand to additional cities
        for (const city of CITIES.filter((a) => !ns.corporation.getDivision(agDivName).cities.includes(a))) {
            let expandCost = ns.corporation.getExpandCityCost();
            let corpFunds = ns.corporation.getCorporation().funds;

            if (corpFunds < expandCost) {
                ns.tprintf(
                    "ERROR: Corporation => Insufficient funds to expand %s to %s %s < %s",
                    agDivName,
                    city,
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(expandCost, "($0.000a)")
                );

                return;
            } else {
                ns.tprintf(
                    "Corporation => Expanding %s to %s for %s",
                    agDivName,
                    city,
                    ns.nFormat(expandCost, "($0.000a)")
                );
                ns.corporation.expandCity(agDivName, city);
            }
        }

        // Buy warehouses in all cities
        for (const city of ns.corporation.getDivision(agDivName).cities) {
            if (!ns.corporation.hasWarehouse(agDivName, city)) {
                let warehouseCost = ns.corporation.getPurchaseWarehouseCost();
                let corpFunds = ns.corporation.getCorporation().funds;

                if (warehouseCost <= corpFunds) {
                    ns.tprintf(
                        "Corporation => Purchasing a %s warehouse in %s for %s",
                        agDivName,
                        city,
                        ns.nFormat(warehouseCost, "($0.000a)")
                    );
                    ns.corporation.purchaseWarehouse(agDivName, city);
                } else {
                    ns.tprintf(
                        "Corporation => Insufficient funds to purchase a %s warehouse in %s %s < %s",
                        agDivName,
                        city,
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(warehouseCost, "($0.000a)")
                    );
                    return;
                }
            }

            // upgrade the size of the warehouses in all of the cities to 500
            while (ns.corporation.getWarehouse(agDivName, city).size < 500) {
                let upgradeCost = ns.corporation.getUpgradeWarehouseCost(agDivName, city);
                let corpFunds = ns.corporation.getCorporation().funds;
                let startSize = ns.corporation.getWarehouse(agDivName, city).size;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "WARNING: Corporation => Insufficient funds to purchase a warehouse upgrade %s < %s",
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                } else {
                    ns.corporation.upgradeWarehouse(agDivName, city);
                    let endSize = ns.corporation.getWarehouse(agDivName, city).size;
                    ns.tprintf(
                        "Corporation => Upgraded %s %s's warehouse size from %s to %s for %s",
                        agDivName,
                        city,
                        ns.nFormat(startSize, "(0.000a)"),
                        ns.nFormat(endSize, "(0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                }
            }

            ns.corporation.setSmartSupply(agDivName, city, true);
            ns.corporation.sellMaterial(agDivName, city, "Food", "MAX", "MP");
            ns.corporation.sellMaterial(agDivName, city, "Plants", "MAX", "MP");
        }

        // upgrade the office size in every city to 9 and assign jobs
        for (const city of ns.corporation.getDivision(agDivName).cities) {
            if (ns.corporation.getOffice(agDivName, city).size >= 9) {
                continue;
            }

            let upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(
                agDivName,
                city,
                9 - ns.corporation.getOffice(agDivName, city).size
            );
            let corpFunds = ns.corporation.getCorporation().funds;

            if (corpFunds < upgradeCost) {
                ns.tprintf(
                    "ERROR: Corporation => Insufficient funds to increase %s %s office size to 9 %s < %s",
                    agDivName,
                    city,
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
                return;
            } else {
                ns.tprintf(
                    "Corporation => Purchasing %d additional office positions in %s %s for %s",
                    9 - ns.corporation.getOffice(agDivName, city).size,
                    agDivName,
                    city,
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
                ns.corporation.upgradeOfficeSize(agDivName, city, 9 - ns.corporation.getOffice(agDivName, city).size);
            }

            while (ns.corporation.getOffice(agDivName, city).employees.length < 9) {
                ns.corporation.hireEmployee(agDivName, city);
            }

            for (const employee of ns.corporation.getOffice(agDivName, city).employees)
                ns.corporation.assignJob(agDivName, city, employee, "Unassigned");

            await ns.corporation.setAutoJobAssignment(agDivName, city, "Operations", 2);
            await ns.corporation.setAutoJobAssignment(agDivName, city, "Engineer", 2);
            await ns.corporation.setAutoJobAssignment(agDivName, city, "Business", 1);
            await ns.corporation.setAutoJobAssignment(agDivName, city, "Management", 2);
            await ns.corporation.setAutoJobAssignment(agDivName, city, "Research & Development", 2);
        }

        // buy production materials for all cities
        for (const city of ns.corporation.getDivision(agDivName).cities) {
            if (ns.corporation.getMaterial(agDivName, city, "Real Estate").qty === 0) {
                ns.corporation.buyMaterial(agDivName, city, "Hardware", 12.5);
                ns.corporation.buyMaterial(agDivName, city, "AI Cores", 7.5);
                ns.corporation.buyMaterial(agDivName, city, "Real Estate", 2700);

                while (ns.corporation.getMaterial(agDivName, city, "Real Estate").qty === 0) await ns.sleep(5);

                ns.tprintf("Corporation => Purchased Round 1 of %s production materials in %s", agDivName, city);

                ns.corporation.buyMaterial(agDivName, city, "Hardware", 0);
                ns.corporation.buyMaterial(agDivName, city, "AI Cores", 0);
                ns.corporation.buyMaterial(agDivName, city, "Real Estate", 0);
            }
        }

        // Upgrade Smart Factories and Smart Storage
        leveledUpgrades = ["Smart Factories", "Smart Storage"];
        for (const upgrade of leveledUpgrades) {
            while (ns.corporation.getUpgradeLevel(upgrade) < 10) {
                let upgradeCost = ns.corporation.getUpgradeLevelCost(upgrade);
                let corpFunds = ns.corporation.getCorporation().funds;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "WARNING: Corporation => Insufficient funds to purchase %s %s < %s",
                        upgrade,
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    break;
                } else {
                    ns.tprintf(
                        "Corporation => Purchasing %s upgrade for %s",
                        upgrade,
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                    ns.corporation.levelUpgrade(upgrade);
                }
            }
        }

        // Increase Warehouse Sizes to 2k
        for (const city of ns.corporation.getDivision(agDivName).cities) {
            while (ns.corporation.getWarehouse(agDivName, city).size < 2000) {
                let upgradeCost = ns.corporation.getUpgradeWarehouseCost(agDivName, city);
                let corpFunds = ns.corporation.getCorporation().funds;
                let startSize = ns.corporation.getWarehouse(agDivName, city).size;

                if (corpFunds < upgradeCost) {
                    ns.tprintf(
                        "WARNING: Corporation => Insufficient funds to purchase a warehouse upgrade %s < %s",
                        ns.nFormat(corpFunds, "($0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                } else {
                    ns.corporation.upgradeWarehouse(agDivName, city);
                    let endSize = ns.corporation.getWarehouse(agDivName, city).size;
                    ns.tprintf(
                        "Corporation => Upgraded %s %s's warehouse size from %s to %s for %s",
                        agDivName,
                        city,
                        ns.nFormat(startSize, "(0.000a)"),
                        ns.nFormat(endSize, "(0.000a)"),
                        ns.nFormat(upgradeCost, "($0.000a)")
                    );
                }
            }
        }

        // buy second round production materials for all cities
        for (const city of ns.corporation.getDivision(agDivName).cities) {
            if (ns.corporation.getMaterial(agDivName, city, "Real Estate").qty < 140000) {
                ns.corporation.buyMaterial(agDivName, city, "Hardware", 267.5);
                ns.corporation.buyMaterial(agDivName, city, "Robots", 9.6);
                ns.corporation.buyMaterial(agDivName, city, "AI Cores", 244.5);
                ns.corporation.buyMaterial(agDivName, city, "Real Estate", 11940);

                while (ns.corporation.getMaterial(agDivName, city, "Real Estate").qty < 140000) await ns.sleep(5);

                ns.tprintf("Corporation => Purchased Round 2 of %s production materials in %s", agDivName, city);

                ns.corporation.buyMaterial(agDivName, city, "Hardware", 0);
                ns.corporation.buyMaterial(agDivName, city, "Robots", 0);
                ns.corporation.buyMaterial(agDivName, city, "AI Cores", 0);
                ns.corporation.buyMaterial(agDivName, city, "Real Estate", 0);
            }
        }

        // Attempt to get second round of funding
        while (ns.corporation.getInvestmentOffer().round < 3) {
            ns.tprintf(
                "Corporation => Investment round 2: waiting for %s %s warehouse to fill",
                agDivName,
                primaryCity
            );

            // Sell plants but not food (food is more expensive per unit)
            for (const city of ns.corporation.getDivision(agDivName).cities) {
                ns.corporation.sellMaterial(agDivName, city, "Food", "0", "0");
                ns.corporation.sellMaterial(agDivName, city, "Plants", "MAX", "MP");
            }

            while (
                ns.corporation.getWarehouse(agDivName, primaryCity).sizeUsed <
                ns.corporation.getWarehouse(agDivName, primaryCity).size * 0.95
            ) {
                await ns.sleep(1000);
            }

            ns.tprintf(
                "Corporation => Investment round 2: %s %s warehouse is full, initiating bulk sell-off to woo investors",
                agDivName,
                primaryCity
            );

            for (const city of ns.corporation.getDivision(agDivName).cities) {
                ns.corporation.sellMaterial(agDivName, city, "Food", "MAX", "MP*0.9");
                ns.corporation.sellMaterial(agDivName, city, "Plants", "MAX", "MP*0.9");
            }

            let tookOffer = false;
            let bestOffer = ns.corporation.getInvestmentOffer();
            while (ns.corporation.getWarehouse(agDivName, primaryCity).sizeUsed > 1250) {
                let offer = ns.corporation.getInvestmentOffer();

                //only take offers over $16t
                if (offer.funds > 16000000000000) {
                    ns.corporation.acceptInvestmentOffer();
                    ns.tprintf(
                        "Corporation => Investment round 2: Taking offer of %s for %d%%",
                        ns.nFormat(offer.funds, "(0.000a)"),
                        (offer.shares / 1000000000) * 100
                    );
                    tookOffer = true;
                    break;
                }

                if (offer.funds > bestOffer.funds) {
                    bestOffer = offer;
                }

                await ns.sleep(100);
            }

            if (!tookOffer) {
                ns.tprintf(
                    "Corporation => Investment round 2: Failed to generate an offer over $16t (best: %s for %d%%)",
                    ns.nFormat(bestOffer.funds, "(0.000a)"),
                    (bestOffer.shares / 1000000000) * 100
                );
            }
        }
    }

    // open the Tobacco division
    if (ns.corporation.getCorporation().divisions.find((div) => div.type === tbDivName) === undefined) {
        let divCost = ns.corporation.getExpandIndustryCost(tbDivName);
        ns.tprintf("Corporation => Starting %s division for %s", tbDivName, ns.nFormat(divCost, "($0.000a)"));

        ns.corporation.expandIndustry(tbDivName, tbDivName);
    }

    // Expand to additional cities
    for (const city of CITIES.filter((a) => !ns.corporation.getDivision(tbDivName).cities.includes(a))) {
        let expandCost = ns.corporation.getExpandCityCost();
        let corpFunds = ns.corporation.getCorporation().funds;

        if (corpFunds < expandCost) {
            ns.tprintf(
                "ERROR: Corporation => Insufficient funds to expand %s to %s %s < %s",
                tbDivName,
                city,
                ns.nFormat(corpFunds, "($0.000a)"),
                ns.nFormat(expandCost, "($0.000a)")
            );

            return;
        } else {
            ns.tprintf(
                "Corporation => Expanding %s to %s for %s",
                tbDivName,
                city,
                ns.nFormat(expandCost, "($0.000a)")
            );
            ns.corporation.expandCity(tbDivName, city);
        }
    }

    // Buy warehouses in all cities
    for (const city of ns.corporation.getDivision(tbDivName).cities) {
        if (!ns.corporation.hasWarehouse(tbDivName, city)) {
            let warehouseCost = ns.corporation.getPurchaseWarehouseCost();
            let corpFunds = ns.corporation.getCorporation().funds;

            if (warehouseCost <= corpFunds) {
                ns.tprintf(
                    "Corporation => Purchasing a %s warehouse in %s for %s",
                    tbDivName,
                    city,
                    ns.nFormat(warehouseCost, "($0.000a)")
                );
                ns.corporation.purchaseWarehouse(tbDivName, city);
            } else {
                ns.tprintf(
                    "Corporation => Insufficient funds to purchase a %s warehouse in %s %s < %s",
                    tbDivName,
                    city,
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(warehouseCost, "($0.000a)")
                );
                return;
            }
        }

        // upgrade the size of the warehouses in all of the cities to 1000
        while (ns.corporation.getWarehouse(tbDivName, city).size < 1000) {
            let upgradeCost = ns.corporation.getUpgradeWarehouseCost(tbDivName, city);
            let corpFunds = ns.corporation.getCorporation().funds;
            let startSize = ns.corporation.getWarehouse(tbDivName, city).size;

            if (corpFunds < upgradeCost) {
                ns.tprintf(
                    "WARNING: Corporation => Insufficient funds to purchase a warehouse upgrade %s < %s",
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
            } else {
                ns.corporation.upgradeWarehouse(tbDivName, city);
                let endSize = ns.corporation.getWarehouse(tbDivName, city).size;
                ns.tprintf(
                    "Corporation => Upgraded %s %s's warehouse size from %s to %s for %s",
                    tbDivName,
                    city,
                    ns.nFormat(startSize, "(0.000a)"),
                    ns.nFormat(endSize, "(0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
            }
        }

        ns.corporation.setSmartSupply(tbDivName, city, true);
    }

    // upgrade the office size in every city to 10 and assign jobs
    for (const city of ns.corporation.getDivision(tbDivName).cities) {
        if (ns.corporation.getOffice(tbDivName, city).size >= 10) {
            continue;
        }

        let upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(
            tbDivName,
            city,
            10 - ns.corporation.getOffice(tbDivName, city).size
        );
        let corpFunds = ns.corporation.getCorporation().funds;

        if (corpFunds < upgradeCost) {
            ns.tprintf(
                "ERROR: Corporation => Insufficient funds to increase %s %s office size to 10 %s < %s",
                tbDivName,
                city,
                ns.nFormat(corpFunds, "($0.000a)"),
                ns.nFormat(upgradeCost, "($0.000a)")
            );
            return;
        } else {
            ns.tprintf(
                "Corporation => Purchasing %d additional office positions in %s %s for %s",
                10 - ns.corporation.getOffice(tbDivName, city).size,
                tbDivName,
                city,
                ns.nFormat(upgradeCost, "($0.000a)")
            );
            ns.corporation.upgradeOfficeSize(tbDivName, city, 10 - ns.corporation.getOffice(tbDivName, city).size);
        }

        while (ns.corporation.getOffice(tbDivName, city).employees.length < 10) {
            ns.corporation.hireEmployee(tbDivName, city);
        }

        for (const employee of ns.corporation.getOffice(tbDivName, city).employees)
            ns.corporation.assignJob(tbDivName, city, employee, "Unassigned");

        await ns.corporation.setAutoJobAssignment(tbDivName, city, "Operations", 2);
        await ns.corporation.setAutoJobAssignment(tbDivName, city, "Engineer", 2);
        await ns.corporation.setAutoJobAssignment(tbDivName, city, "Business", 2);
        await ns.corporation.setAutoJobAssignment(tbDivName, city, "Management", 2);
        await ns.corporation.setAutoJobAssignment(tbDivName, city, "Research & Development", 2);
    }

    // Upgrade Aevum office to 30 employees
    if (ns.corporation.getOffice(tbDivName, tbRDCity).size < 30) {
        let upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(
            tbDivName,
            tbRDCity,
            30 - ns.corporation.getOffice(tbDivName, tbRDCity).size
        );
        let corpFunds = ns.corporation.getCorporation().funds;

        if (corpFunds < upgradeCost) {
            ns.tprintf(
                "ERROR: Corporation => Insufficient funds to increase %s %s office size to 30 %s < %s",
                tbDivName,
                tbRDCity,
                ns.nFormat(corpFunds, "($0.000a)"),
                ns.nFormat(upgradeCost, "($0.000a)")
            );
            return;
        } else {
            ns.tprintf(
                "Corporation => Purchasing %d additional office positions in %s %s for %s",
                30 - ns.corporation.getOffice(tbDivName, tbRDCity).size,
                tbDivName,
                tbRDCity,
                ns.nFormat(upgradeCost, "($0.000a)")
            );
            ns.corporation.upgradeOfficeSize(
                tbDivName,
                tbRDCity,
                30 - ns.corporation.getOffice(tbDivName, tbRDCity).size
            );
        }

        while (ns.corporation.getOffice(tbDivName, tbRDCity).employees.length < 30) {
            ns.corporation.hireEmployee(tbDivName, tbRDCity);
        }

        for (const employee of ns.corporation.getOffice(tbDivName, tbRDCity).employees)
            ns.corporation.assignJob(tbDivName, tbRDCity, employee, "Unassigned");

        await ns.corporation.setAutoJobAssignment(tbDivName, tbRDCity, "Operations", 6);
        await ns.corporation.setAutoJobAssignment(tbDivName, tbRDCity, "Engineer", 6);
        await ns.corporation.setAutoJobAssignment(tbDivName, tbRDCity, "Business", 6);
        await ns.corporation.setAutoJobAssignment(tbDivName, tbRDCity, "Management", 6);
        await ns.corporation.setAutoJobAssignment(tbDivName, tbRDCity, "Research & Development", 6);
    }

    let leveledUpgrades = [
        "FocusWires",
        "Neural Accelerators",
        "Speech Processor Implants",
        "Nuoptimal Nootropic Injector Implants",
    ];
    for (const upgrade of leveledUpgrades) {
        while (ns.corporation.getUpgradeLevel(upgrade) < 20) {
            let upgradeCost = ns.corporation.getUpgradeLevelCost(upgrade);
            let corpFunds = ns.corporation.getCorporation().funds;

            if (corpFunds < upgradeCost) {
                ns.tprintf(
                    "WARNING: Corporation => Insufficient funds to purchase %s %s < %s",
                    upgrade,
                    ns.nFormat(corpFunds, "($0.000a)"),
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
                break;
            } else {
                ns.tprintf(
                    "Corporation => Purchasing %s upgrade for %s",
                    upgrade,
                    ns.nFormat(upgradeCost, "($0.000a)")
                );
                ns.corporation.levelUpgrade(upgrade);
            }
        }
    }

    // Start Forever Loop
    while (true) {
        // Attempt to max out Wilson Analytics
        while (ns.corporation.getUpgradeLevelCost("Wilson Analytics") < ns.corporation.getCorporation().funds) {
            let upgradeCost = ns.corporation.getUpgradeLevelCost("Wilson Analytics");
            ns.tprintf(
                "Corporation => Purchasing %s upgrade for %s",
                "Wilson Analytics",
                ns.nFormat(upgradeCost, "($0.000a)")
            );
            ns.corporation.levelUpgrade("Wilson Analytics");
        }

        let maxProducts = 3;
        if (ns.corporation.hasResearched(tbDivName, "uPgrade: Capacity.I")) maxProducts++;
        if (ns.corporation.hasResearched(tbDivName, "uPgrade: Capacity.II")) maxProducts++;

        // Develop a product if there are none in development
        let products = ns.corporation
            .getDivision(tbDivName)
            .products.map((prodname) => ns.corporation.getProduct(tbDivName, prodname))
            .sort((a, b) => Number(a.name) - Number(b.name));

        let productIsDeveloping = false;
        for (const product of products) {
            if (product.developmentProgress < 100) {
                productIsDeveloping = true;
                break;
            }
        }

        // if there are no products in development, discontinue the oldest one if needed
        if (!productIsDeveloping) {
            if (products.length === maxProducts) {
                ns.tprintf("Corporation => Discontinuing %s product %s", tbDivName, products[0].name);

                ns.corporation.discontinueProduct(tbDivName, products[0].name);
            }

            let investmentCash = ns.corporation.getCorporation().funds * 0.01;

            let productName = new Date().getTime().toString();

            ns.tprintf(
                "Corporation => Developing new %s product %s for %s",
                tbDivName,
                productName,
                ns.nFormat(investmentCash * 2, "($0.000a)")
            );

            ns.corporation.makeProduct(tbDivName, tbRDCity, productName, investmentCash, investmentCash);
        }

        // update products list if there were changes
        products = ns.corporation
            .getDivision(tbDivName)
            .products.map((prodname) => ns.corporation.getProduct(tbDivName, prodname))
            .sort((a, b) => Number(a.name) - Number(b.name));

        for (const product of products) {
            if (product.sCost === 0) {
                ns.corporation.sellProduct(tbDivName, tbRDCity, product.name, "MAX", "MP*1", true);
            }
        }

        products = ns.corporation
            .getDivision(tbDivName)
            .products.map((prodname) => ns.corporation.getProduct(tbDivName, prodname))
            .sort((a, b) => Number(a.name) - Number(b.name));

        break;

        // mess with the price of products
        // TODO: Figure out how to track prices across cycles
        // TODO: Figure when a new cycle has started so the price update doesnt
        //        happen more than once a cycle.
        for (const product of products) {
            let mpMult = Number(product.sCost.slice(3));
            let reduceMult = false;
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

                if (qty > 50 && prodDeficit > 0) {
                    reduceMult = true;
                    break;
                }
            }

            if (reduceMult) {
                mpMult = Math.max(Math.floor(mpMult * 0.9), 1);
                ns.corporation.sellProduct(tbDivName, tbRDCity, product.name, "MAX", "MP*" + mpMult.toString(), true);
            } else {
                mpMult *= 2;
                ns.corporation.sellProduct(tbDivName, tbRDCity, product.name, "MAX", "MP*" + mpMult.toString(), true);
            }
        }

        

        // compare price of increasing advertising vs increasing office space, do the cheaper if it's affordable

        // if any of the other office sizes are < 20% the size of the Aevum office, attempt to increase their size

        break;
    }

    return;

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
                typeof product.sCost === "string" ? product.sCost : ns.nFormat(product.sCost, "($0.000a)")
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
                mult += 10;
            }
        }
    }
}
