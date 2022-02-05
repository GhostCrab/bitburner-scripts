import { doBuyAndSoftenAll, doBackdoors, ALL_FACTIONS, stFormat } from "./util.js";

function printAugStats(ns, stats) {
    for (const [key, val] of Object.entries(stats)) {
        ns.tprintf("%30s %s", key, val);
    }
}

class Augmentation {
    constructor(ns, name, faction) {
        let ownedAugs = ns.getOwnedAugmentations(true);
        let installedAugs = ns.getOwnedAugmentations();
        let factionRep =
            (ns.getPlayer().currentWorkFactionName === faction ? ns.getPlayer().workRepGained : 0) +
            ns.getFactionRep(faction);
        this.name = name;
        this.faction = faction;
        this.price = ns.getAugmentationPrice(this.name);
        this.rep = ns.getAugmentationRepReq(this.name);
        this.prereq = ns.getAugmentationPrereq(this.name);
        this.stats = ns.getAugmentationStats(this.name);
        this.owned = ownedAugs.includes(this.name);
        this.installed = installedAugs.includes(this.name);
        this.purchaseable = factionRep >= this.rep;
        let dep = ns.getAugmentationPrereq(this.name)[0];
        if (dep !== undefined && (ownedAugs.includes(dep) || installedAugs.includes(dep))) dep = undefined;
        this.dep = dep;
        let installedStr = this.installed
            ? "INSTALLED"
            : this.owned
            ? "OWNED"
            : this.purchaseable
            ? "PURCHASEABLE"
            : "";

        if (ns.getPlayer().currentWorkFactionName === faction && installedStr === "") {
            let repGainPerMs = (ns.getPlayer().workRepGainRate * 5) / 1000;
            installedStr = stFormat(ns, (this.rep - factionRep) / repGainPerMs);
        }
        this.str = ns.sprintf(
            "%s: %s - %s [%s] %s",
            this.faction,
            this.name,
            ns.nFormat(this.price, "$0.000a"),
            ns.nFormat(this.rep, "0.000a"),
            installedStr
        );
    }

    toString() {
        return this.str;
    }

    isHackUseful() {
        if (this.name === "Neuroflux Governor") return false;
        //return true;
        if (this.stats.company_rep_mult) return true;
        if (this.stats.faction_rep_mult) return true;
        if (this.stats.hacking_chance_mult) return true;
        if (this.stats.hacking_exp_mult) return true;
        if (this.stats.hacking_grow_mult) return true;
        if (this.stats.hacking_money_mult) return true;
        if (this.stats.hacking_mult) return true;
        if (this.stats.hacking_speed_mult) return true;
        if (this.stats.hacknet_node_core_cost_mult) return true;
        if (this.stats.hacknet_node_level_cost_mult) return true;
        if (this.stats.hacknet_node_money_mult) return true;
        if (this.stats.hacknet_node_purchase_cost_mult) return true;
        if (this.stats.hacknet_node_ram_cost_mult) return true;
        if (
            this.name === "BitRunners Neurolink" ||
            this.name === "CashRoot Starter Kit" ||
            this.name === "PCMatrix" ||
            this.name === "Neuroreceptor Management Implant" ||
            this.name === "The Red Pill"
        )
            return true;

        return false;
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    doBuyAndSoftenAll(ns);
    await doBackdoors(ns);

    let player = ns.getPlayer();

    let checkFactions = player.factions.concat(ns.checkFactionInvitations());
    let sortedFactions = checkFactions.sort(
        (a, b) =>
            (ns.getPlayer().currentWorkFactionName === b ? ns.getPlayer().workRepGained : 0) +
            ns.getFactionRep(b) -
            ((ns.getPlayer().currentWorkFactionName === a ? ns.getPlayer().workRepGained : 0) + ns.getFactionRep(a))
    );
    //let sortedFactions = ALL_FACTIONS.sort((a, b) => ns.getFactionRep(b) - ns.getFactionRep(a));

    let allPurchaseableAugs = [];
    let topFaction = true;
    for (const faction of sortedFactions) {
        let augs = ns
            .getAugmentationsFromFaction(faction)
            .map((name) => {
                return new Augmentation(ns, name, faction);
            })
            .sort((a, b) => a.rep - b.rep);
        let augsToBuy = [];
        for (let aug of augs) {
            if (aug.isHackUseful() && !aug.owned) {
                augsToBuy.push(aug);
            }
            if (aug.isHackUseful() && aug.purchaseable && !aug.owned && !aug.installed) {
                allPurchaseableAugs.push(aug);
            }
        }

        if (augsToBuy.length === 0 && !topFaction) continue;

        ns.tprintf(
            "%s (rep: %d):",
            faction,
            (ns.getPlayer().currentWorkFactionName === faction ? ns.getPlayer().workRepGained : 0) +
                ns.getFactionRep(faction)
        );
        for (let aug of augsToBuy) {
            ns.tprintf("  %s", aug);
            // printAugStats(aug.stats);
        }

        topFaction = false;
    }

    for (let i = 0; i < allPurchaseableAugs.length; i++) {
        let checkName = allPurchaseableAugs[i].name;
        let j = i + 1;
        while (j < allPurchaseableAugs.length) {
            if (allPurchaseableAugs[j].name === checkName) {
                allPurchaseableAugs.splice(j, 1);
            } else {
                j++;
            }
        }
    }

    allPurchaseableAugs = allPurchaseableAugs.sort((a, b) => b.price - a.price);

    // reorder array to buy dependent augs first and purge augs that cant be bought
    // because of a missing dependency, need to loop multiple times until no more dependencies are found
    while (true) {
        let didDepMove = false;
        for (let i = 0; i < allPurchaseableAugs.length; i++) {
            let depName = allPurchaseableAugs[i].dep;
            if (depName === undefined) continue;

            // check to see if we've already re-organized this dep
            if (i !== 0 && allPurchaseableAugs[i - 1].name === depName) continue;

            let foundDep = false;
            let j = i + 1;
            while (j < allPurchaseableAugs.length) {
                if (allPurchaseableAugs[j].name === depName) {
                    let tmp = allPurchaseableAugs[j];
                    // remove aug from current place
                    allPurchaseableAugs.splice(j, 1);
                    // place it before the main aug
                    allPurchaseableAugs.splice(i, 0, tmp);
                    foundDep = true;
                    didDepMove = true;
                    i++;
                    break;
                } else {
                    j++;
                }
            }

            // if we dont have the dependency queued, remove this aug from the buy list
            if (!foundDep) {
                ns.tprintf(
                    "WARNING: Unable to find dependency %s:%s in the queue",
                    allPurchaseableAugs[i].name,
                    allPurchaseableAugs[i].dep
                );
                allPurchaseableAugs.splice(i, 1);
            }
        }

        if (!didDepMove) break;
    }

    // if (allPurchaseableAugs.length > 0) {
    //     ns.tprintf("============================");
    //     let mult = 1;
    //     let total = 0;
    //     for (let aug of allPurchaseableAugs) {
    //         //if (ns.args[0]) ns.purchaseAugmentation(aug.faction, aug.name);
    //         ns.tprintf(
    //             "%40s - %9s %s",
    //             aug.name,
    //             ns.nFormat(aug.price * mult, "$0.000a"),
    //             aug.dep !== undefined ? aug.dep : ""
    //         );
    //         total += aug.price * mult;
    //         mult *= 1.9;
    //     }
    //     ns.tprintf("\n%40s - %9s", "Total", ns.nFormat(total, "$0.000a"));
    // }

        let buysafe = ns.getPlayer().currentWorkFactionName !== sortedFactions[0];
        if (!buysafe && ns.args[0]) {
            ns.tprintf("WARNING: Unable to buy augmentations when actively working for the top faction");
        }

        ns.tprintf("============================");
        let mult = 1;
        let srcFile11 = ns.getOwnedSourceFiles().find((x) => x.n === 11);
        let srcFile11Lvl = srcFile11 ? srcFile11.lvl : 0;
        let multmult = 1.9 * [1, 0.96, 0.94, 0.93][srcFile11Lvl];
        let total = Number.MAX_SAFE_INTEGER;
        let startAug = 0;
        let purchaseableAugs = allPurchaseableAugs.filter((a) => a.name !== "The Red Pill");
        while (startAug < purchaseableAugs.length) {
            total = 0;
            mult = 1;
            for (let augIdx = startAug; augIdx < purchaseableAugs.length; augIdx++) {
                total += purchaseableAugs[augIdx].price * mult;
                mult *= multmult;
            }

            if (total < ns.getPlayer().money) break;

            startAug++;
        }

        total = 0;
        mult = 1;
        let startmoney = ns.getPlayer().money
        for (const aug of purchaseableAugs.slice(startAug)) {
            if (ns.args[0] && buysafe) ns.purchaseAugmentation(aug.faction, aug.name);
            ns.tprintf(
                "%50s - %9s %s",
                aug.name,
                ns.nFormat(aug.price * mult, "$0.000a"),
                aug.dep !== undefined ? aug.dep : ""
            );
            total += aug.price * mult;
            mult *= multmult;
        }

        // see how many Neuroflux Governors we can buy
        let topFactionRep =
            (ns.getPlayer().currentWorkFactionName === sortedFactions[0] ? ns.getPlayer().workRepGained : 0) +
            ns.getFactionRep(sortedFactions[0]);
        let ngPrice = ns.getAugmentationPrice("NeuroFlux Governor") * ((ns.args[0] && buysafe) ? 1 : mult);
        let ngRepReq = ns.getAugmentationRepReq("NeuroFlux Governor");
        let nfCount = 1;
        while (true) {
            if (total + ngPrice < startmoney && ngRepReq <= topFactionRep) {
                if (ns.args[0] && buysafe) {
                    let result = ns.purchaseAugmentation(sortedFactions[0], "NeuroFlux Governor");
                    if (!result)
                        ns.tprintf("ERROR, could not buy Neuroflux governor")
                }
                ns.tprintf(
                    "%50s - %9s %s",
                    "NeuroFlux Governor +" + nfCount.toString(),
                    ns.nFormat(ngPrice, "$0.000a"),
                    ns.nFormat(ngRepReq, "0.000a")
                );
                nfCount++;
                total += ngPrice;
                ngPrice = ngPrice * 1.14 * multmult;
                ngRepReq *= 1.14;
            } else {
                break;
            }
        }

        ns.tprintf("\n%50s - %9s", "Total", ns.nFormat(total, "$0.000a"));
}



/*
NeuroFlux Governor +1 -   $1.111m 740.772 4
NeuroFlux Governor +2 -   $2.238m 844.480 5  --  $2.407m Requires 844.480 faction reputation
NeuroFlux Governor +3 -   $4.509m 962.707 6  --  $5.213m Requires 962.707 faction reputation
NeuroFlux Governor +4 -   $9.082m 1.097k  7  --  $11.291m Requires 1.097k faction reputation
NeuroFlux Governor +5 -  $18.295m 1.251k  8  --  $24.457m Requires 1.251k faction reputation
NeuroFlux Governor +6 -  $36.854m 1.426k  9  --  $52.975m Requires 1.426k faction reputation
NeuroFlux Governor +7 -  $74.238m 1.626k  10 --  $114.743m Requires 1.626k faction reputation
NeuroFlux Governor +8 - $149.543m 1.854k  11 --  $248.534m Requires 1.854k faction reputation
NeuroFlux Governor +9 - $301.236m 2.113k  12 --  $538.324m Requires 2.113k faction reputation
NeuroFlux Governor +10 - $606.804m 2.409k 13 --  $1.166b Requires 2.409k faction reputation
NeuroFlux Governor +11 -   $1.222b 2.746k 14 --  $2.526b Requires 2.746k faction reputation
NeuroFlux Governor +12 -   $2.462b 3.131k 15 --  $5.470b Requires 3.131k faction reputation
NeuroFlux Governor +13 -   $4.960b 3.569k 16 --  $11.849b Requires 3.569k faction reputation
*/