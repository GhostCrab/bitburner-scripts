import { setns, mapHosts, doBuyAndSoftenAll } from "./util.js";

function printAugStats(ns, stats) {
    if (stats.agility_exp_mult) ns.tprintf("    %31s: %.2f", "agility_exp_mult", stats.agility_exp_mult);
    if (stats.agility_mult) ns.tprintf("    %31s: %.2f", "agility_mult", stats.agility_mult);
    if (stats.bladeburner_analysis_mult)
        ns.tprintf("    %31s: %.2f", "bladeburner_analysis_mult", stats.bladeburner_analysis_mult);
    if (stats.bladeburner_max_stamina_mult)
        ns.tprintf("    %31s: %.2f", "bladeburner_max_stamina_mult", stats.bladeburner_max_stamina_mult);
    if (stats.bladeburner_stamina_gain_mult)
        ns.tprintf("    %31s: %.2f", "bladeburner_stamina_gain_mult", stats.bladeburner_stamina_gain_mult);
    if (stats.bladeburner_success_chance_mult)
        ns.tprintf("    %31s: %.2f", "bladeburner_success_chance_mult", stats.bladeburner_success_chance_mult);
    if (stats.charisma_exp_mult) ns.tprintf("    %31s: %.2f", "charisma_exp_mult", stats.charisma_exp_mult);
    if (stats.charisma_mult) ns.tprintf("    %31s: %.2f", "charisma_mult", stats.charisma_mult);
    if (stats.company_rep_mult) ns.tprintf("    %31s: %.2f", "company_rep_mult", stats.company_rep_mult);
    if (stats.crime_money_mult) ns.tprintf("    %31s: %.2f", "crime_money_mult", stats.crime_money_mult);
    if (stats.crime_success_mult) ns.tprintf("    %31s: %.2f", "crime_success_mult", stats.crime_success_mult);
    if (stats.defense_exp_mult) ns.tprintf("    %31s: %.2f", "defense_exp_mult", stats.defense_exp_mult);
    if (stats.defense_mult) ns.tprintf("    %31s: %.2f", "defense_mult", stats.defense_mult);
    if (stats.dexterity_exp_mult) ns.tprintf("    %31s: %.2f", "dexterity_exp_mult", stats.dexterity_exp_mult);
    if (stats.dexterity_mult) ns.tprintf("    %31s: %.2f", "dexterity_mult", stats.dexterity_mult);
    if (stats.faction_rep_mult) ns.tprintf("    %31s: %.2f", "faction_rep_mult", stats.faction_rep_mult);
    if (stats.hacking_chance_mult) ns.tprintf("    %31s: %.2f", "hacking_chance_mult", stats.hacking_chance_mult);
    if (stats.hacking_exp_mult) ns.tprintf("    %31s: %.2f", "hacking_exp_mult", stats.hacking_exp_mult);
    if (stats.hacking_grow_mult) ns.tprintf("    %31s: %.2f", "hacking_grow_mult", stats.hacking_grow_mult);
    if (stats.hacking_money_mult) ns.tprintf("    %31s: %.2f", "hacking_money_mult", stats.hacking_money_mult);
    if (stats.hacking_mult) ns.tprintf("    %31s: %.2f", "hacking_mult", stats.hacking_mult);
    if (stats.hacking_speed_mult) ns.tprintf("    %31s: %.2f", "hacking_speed_mult", stats.hacking_speed_mult);
    if (stats.hacknet_node_core_cost_mult)
        ns.tprintf("    %31s: %.2f", "hacknet_node_core_cost_mult", stats.hacknet_node_core_cost_mult);
    if (stats.hacknet_node_level_cost_mult)
        ns.tprintf("    %31s: %.2f", "hacknet_node_level_cost_mult", stats.hacknet_node_level_cost_mult);
    if (stats.hacknet_node_money_mult)
        ns.tprintf("    %31s: %.2f", "hacknet_node_money_mult", stats.hacknet_node_money_mult);
    if (stats.hacknet_node_purchase_cost_mult)
        ns.tprintf("    %31s: %.2f", "hacknet_node_purchase_cost_mult", stats.hacknet_node_purchase_cost_mult);
    if (stats.hacknet_node_ram_cost_mult)
        ns.tprintf("    %31s: %.2f", "hacknet_node_ram_cost_mult", stats.hacknet_node_ram_cost_mult);
    if (stats.strength_exp_mult) ns.tprintf("    %31s: %.2f", "strength_exp_mult", stats.strength_exp_mult);
    if (stats.strength_mult) ns.tprintf("    %31s: %.2f", "strength_mult", stats.strength_mult);
    if (stats.work_money_mult) ns.tprintf("    %31s: %.2f", "work_money_mult", stats.work_money_mult);
}

class Augmentation {
    constructor(ns, name, faction) {
        let ownedAugs = ns.getOwnedAugmentations(true);
        let installedAugs = ns.getOwnedAugmentations();
        this.name = name;
        this.faction = faction;
        this.price = ns.getAugmentationPrice(this.name);
        this.rep = ns.getAugmentationRepReq(this.name);
        this.prereq = ns.getAugmentationPrereq(this.name);
        this.stats = ns.getAugmentationStats(this.name);
        this.owned = ownedAugs.includes(this.name);
        this.installed = installedAugs.includes(this.name);
        this.purchaseable = ns.getFactionRep(faction) >= this.rep;
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
        this.str = `${this.faction}: ${this.name} - ${ns.nFormat(this.price, "$0.000a")} [${ns.nFormat(
            this.rep,
            "0.000a"
        )}] ${installedStr}`;
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
        if (
            this.name === "BitRunners Neurolink" ||
            this.name === "CashRoot Starter Kit" ||
            this.name === "PCMatrix" ||
            this.name === "Neuroreceptor Management Implant"
        )
            return true;

        return false;
    }
}

async function doBackdoors(ns) {
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n", "b-and-a", "ecorp", "fulcrumassets", "fulcrumtech"];
    const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n"];
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "omnitek", "kuai-gong", "megacorp"];
    let hosts = mapHosts();

    for (const [hostName, trail] of Object.entries(hosts)) {
        let server = ns.getServer(hostName);
        if (
            !targetHosts.includes(hostName) ||
            server.backdoorInstalled ||
            server.requiredHackingSkill > ns.getHackingLevel() ||
            !server.hasAdminRights
        )
            continue;

        ns.print(hostName);
        for (const hostHopName of trail) {
            ns.connect(hostHopName);
        }

        await ns.installBackdoor();
        ns.connect("home");
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    setns(ns);

    doBuyAndSoftenAll();
    await doBackdoors(ns);

    let player = ns.getPlayer();
    let incomePerSec = player.money / (player.playtimeSinceLastAug / 1000);

    ns.tprintf(`Income: ${ns.nFormat(incomePerSec, "$0.000a")}/s`);

    let allFactions = [
        "Illuminati",
        "Daedalus",
        "The Covenant",
        "ECorp",
        "MegaCorp",
        "Bachman & Associates",
        "Blade Industries",
        "NWO",
        "Clarke Incorporated",
        "OmniTek Incorporated",
        "Four Sigma",
        "KuaiGong International",
        "Fulcrum Secret Technologies",
        "BitRunners",
        "The Black Hand",
        "NiteSec",
        "Aevum",
        "Chongqing",
        "Ishima",
        "New Tokyo",
        "Sector-12",
        "Volhaven",
        "Speakers for the Dead",
        "The Dark Army",
        "The Syndicate",
        "Silhouette",
        "Tetrads",
        "Slum Snakes",
        "Netburners",
        "Tian Di Hui",
        "CyberSec",
        // "Bladeburners",
        // "Church of the Machine God"
    ];

    let checkFactions = player.factions.concat(ns.checkFactionInvitations());
    let sortedFactions = checkFactions.sort((a, b) => ns.getFactionRep(b) - ns.getFactionRep(a));
    //let sortedFactions = allFactions.sort((a, b) => ns.getFactionRep(b) - ns.getFactionRep(a));

    let allPurchaseableAugs = [];
    let topFaction = true;
    for (let faction of sortedFactions) {
        //for (let faction of allFactions) {
        if (faction === "Bladeburners") continue;
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

        ns.tprintf("%s (rep: %d):", faction, ns.getFactionRep(faction));
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
    // because of a missing dependency
    for (let i = 0; i < allPurchaseableAugs.length; i++) {
        let depName = allPurchaseableAugs[i].dep;
        if (depName === undefined) continue;

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

    if (allPurchaseableAugs.length > 0) {
        let ownedAugs = ns.getOwnedAugmentations(true);
        let installedAugs = ns.getOwnedAugmentations();

        ns.tprintf("============================");
        let mult = 1;
        let total = 0;
        for (let aug of allPurchaseableAugs.filter(a => a.name !== "The Red Pill")) {
            if (ns.args[0]) ns.purchaseAugmentation(aug.faction, aug.name);
            ns.tprintf(
                "%40s - %9s %s",
                aug.name,
                ns.nFormat(aug.price * mult, "$0.000a"),
                aug.dep !== undefined ? aug.dep : ""
            );
            total += aug.price * mult;
            mult *= 1.9;
        }
        ns.tprintf("\n%40s - %9s", "Total", ns.nFormat(total, "$0.000a"));
    }
}
