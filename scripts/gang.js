/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.disableLog("sleep");

    ns.tprintf("==================================");

    const members = ns.gang.getMemberNames().map((name) => ns.gang.getMemberInformation(name));
    const hackEquipment = ns.gang
        .getEquipmentNames()
        .map((_name) =>
            Object.assign(
                { name: _name, price: ns.gang.getEquipmentCost(_name), type: ns.gang.getEquipmentType(_name) },
                ns.gang.getEquipmentStats(_name)
            )
        )
        //.filter((eq) => eq.hack !== undefined)
        .sort((a, b) => a.price - b.price);

    for (const member of members) {
        const ascmem = ns.gang.getAscensionResult(member.name);
        ns.tprintf(
            "%3s:  %10s  %s  %s  %s %10s %s",
            member.name,
            member.hack_exp.toFixed(2),
            member.hack_mult.toFixed(2),
            member.hack_asc_mult.toFixed(2),
            ascmem.hack.toFixed(2),
            member.hack_asc_points.toFixed(2),
            member.upgrades
        );

        if (ascmem.hack > 2) {
            ns.tprintf(
                "Ascending %s %.2f => %.2f hack multiplier",
                member.name,
                member.hack_asc_mult,
                member.hack_asc_mult * ascmem.hack
            );

            ns.gang.ascendMember(member.name);
        }
    }

    ns.tprintf("==================================");

    for (const eq of hackEquipment) {
        ns.tprintf("%-13s %20s  %.2f  %9s", eq.type, eq.name, eq.hack !== undefined ? eq.hack : 0, ns.nFormat(eq.price, "($0.000a)"));
    }

    ns.tprintf("==================================");
    let newBuys = [];
    for (const member of members) {
        for (const eq of hackEquipment) {
            if (!member.upgrades.includes(eq.name)) {
                newBuys.push({
                    member: member,
                    equipment: eq,
                });
            }
        }
    }

    newBuys.sort((a, b) => a.equipment.price - b.equipment.price);

    for (const buy of newBuys) {
        if (ns.getPlayer().money > buy.equipment.price) {
            let result = ns.gang.purchaseEquipment(buy.member.name, buy.equipment.name);
            if (result)
                ns.tprintf(
                    "Buying %s:%s for %s",
                    buy.member.name,
                    buy.equipment.name,
                    ns.nFormat(buy.equipment.price, "($0.000a)")
                );
        }
    }

    ns.tprintf("==================================");

    const tasks = ns.gang
        .getTaskNames()
        .map((_name) => ns.gang.getTaskStats(_name))
        .filter((task) => task.isHacking)
        .sort((a, b) => b.baseMoney - a.baseMoney);

    for (const task of tasks) {
		ns.tprintf("%22s %3s %3s %9s %s", task.name, task.baseMoney, task.difficulty, task.baseRespect, task.baseWanted)
    }
}
