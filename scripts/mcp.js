/** @type import(".").NS */
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
        if (this.stats.company_rep_mult) return true;
        if (this.stats.faction_rep_mult) return true;
        if (this.stats.hacking_chance_mult) return true;
        if (this.stats.hacking_exp_mult) return true;
        if (this.stats.hacking_grow_mult) return true;
        if (this.stats.hacking_money_mult) return true;
        if (this.stats.hacking_mult) return true;
        if (this.stats.hacking_speed_mult) return true;
        if (this.name === "BitRunners Neurolink" || this.name === "CashRoot Starter Kit" || this.name === "PCMatrix")
            return true;

        return false;
    }
}

async function doBackdoors(ns) {
    const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n", "b-and-a", "ecorp"];
    //const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", ".", "w0r1d_d43m0n"];
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

        for (const hostHopName of trail) {
            ns.connect(hostHopName);
        }

        await ns.installBackdoor();
        ns.connect("home");
    }
}

/** @param {NS} _ns **/
export async function main(ns) {
    setns(ns);

    doBuyAndSoftenAll();
    await doBackdoors(ns);

    let player = ns.getPlayer();
    let incomePerSec = player.money / (player.playtimeSinceLastAug / 1000);

    ns.tprintf(`Income: ${ns.nFormat(incomePerSec, "$0.000a")}/s`);

    let allFactions = [
        // "Illuminati",
        "Daedalus",
        // "The Covenant",
        "ECorp",
        // "MegaCorp",
        "Bachman & Associates",
        // "Blade Industries",
        // "NWO",
        // "Clarke Incorporated",
        // "OmniTek Incorporated",
        // "Four Sigma",
        // "KuaiGong International",
        // "Fulcrum Secret Technologies",
        "BitRunners",
        "The Black Hand",
        "NiteSec",
        "Aevum",
        "Chongqing",
        "Ishima",
        "New Tokyo",
        "Sector-12",
        "Volhaven",
        // "Speakers for the Dead",
        // "The Dark Army",
        // "The Syndicate",
        // "Silhouette",
        // "Tetrads",
        // "Slum Snakes",
        "Netburners",
        "Tian Di Hui",
        "CyberSec",
        // "Bladeburners",
        // "Church of the Machine God",
    ];

    let sortedFactions = player.factions.sort((a, b) => ns.getFactionRep(b) - ns.getFactionRep(a));

    let allPurchaseableAugs = [];
    for (let faction of sortedFactions) {
        //for (let faction of allFactions) {
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

        ns.tprintf("%s (rep: %d):", faction, ns.getFactionRep(faction));
        for (let aug of augsToBuy) {
            ns.tprintf("  %s", aug);
            // printAugStats(aug.stats);
        }
    }

    allPurchaseableAugs = allPurchaseableAugs.sort((a, b) => b.price - a.price);

    for (let aug of allPurchaseableAugs) {
        ns.purchaseAugmentation(aug.faction, aug.name)
        ns.tprintf("%s", aug);
    }
}