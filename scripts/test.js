// THIS IS A TEST

/** @param {import(".").NS } ns */
function printPlayer(ns, player) {
    ns.tprintf(`hacking_chance_mult: ${player.hacking_chance_mult}`);
    ns.tprintf(`hacking_exp_mult: ${player.hacking_exp_mult}`);
    ns.tprintf(`hacking_exp: ${player.hacking_exp}`);
    ns.tprintf(`hacking_grow_mult: ${player.hacking_grow_mult}`);
    ns.tprintf(`hacking_money_mult: ${player.hacking_money_mult}`);
    ns.tprintf(`hacking_mult: ${player.hacking_mult}`);
    ns.tprintf(`hacking_speed_mult: ${player.hacking_speed_mult}`);
    ns.tprintf(`hacking: ${player.hacking}`);
    ns.tprintf(`bitnode hacking exp mult: ${ns.getBitNodeMultipliers().HackingLevelMultiplier}`);
    ns.tprintf(
        `maybe hacking: ${ns.formulas.skills.calculateSkill(
            player.hacking_exp,
            player.hacking_mult * ns.getBitNodeMultipliers().HackingLevelMultiplier
        )}`
    );
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    let player = ns.getPlayer();

    printPlayer(ns, player);

    player.hacking_exp += 10000000000;

    printPlayer(ns, player);
}
