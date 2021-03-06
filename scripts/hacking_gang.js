/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.disableLog("sleep");

    let members;
    while (true) {
        ns.print(ns.sprintf("=================================="));
        let memberIndex = ns.gang.getMemberNames().length;

        while (ns.gang.canRecruitMember()) {
            let name = "g" + memberIndex.toString();
            ns.gang.recruitMember(name);
            ns.gang.setMemberTask(name, "Train Hacking");
            memberIndex++;
        }

        ns.print(ns.sprintf("=================================="));

        members = ns.gang.getMemberNames().map((name) => ns.gang.getMemberInformation(name));

        for (const member of members) {
            const ascmem = ns.gang.getAscensionResult(member.name);
            ns.print(
                ns.sprintf(
                    "%3s:  %10s  %s  %s  %s %10s %s",
                    member.name,
                    member.hack_exp.toFixed(2),
                    member.hack_mult.toFixed(2),
                    member.hack_asc_mult.toFixed(2),
                    ascmem !== undefined ? ascmem.hack : 0,
                    member.hack_asc_points.toFixed(2),
                    member.upgrades
                )
            );

            if (ascmem !== undefined && ascmem.hack > 2) {
                ns.print(
                    ns.sprintf(
                        "Ascending %s %.2f => %.2f hack multiplier",
                        member.name,
                        member.hack_asc_mult,
                        member.hack_asc_mult * ascmem.hack
                    )
                );

                ns.gang.ascendMember(member.name);
            }
        }

        ns.print(ns.sprintf("=================================="));

        const combatEquipment = ns.gang
            .getEquipmentNames()
            .map((_name) =>
                Object.assign(
                    { name: _name, price: ns.gang.getEquipmentCost(_name), type: ns.gang.getEquipmentType(_name) },
                    ns.gang.getEquipmentStats(_name)
                )
            )
            .filter((eq) => eq.hack !== undefined)
            .sort((a, b) => a.price - b.price);

        // for (const eq of combatEquipment) {
        //     ns.print(ns.sprintf(
        //         "%-13s %20s  %.2f  %9s",
        //         eq.type,
        //         eq.name,
        //         eq.hack !== undefined ? eq.hack : 0,
        //         ns.nFormat(eq.price, "($0.000a)")
        //     ));
        // }

        let newBuys = [];
        for (const member of members) {
            for (const eq of combatEquipment) {
                if (!member.upgrades.includes(eq.name)) {
                    newBuys.push({
                        member: member,
                        equipment: eq,
                    });
                }
            }
        }

        newBuys.sort((a, b) => a.equipment.price - b.equipment.price);

        if (ns.getPlayer().money >= ns.getUpgradeHomeRamCost()) {
            ns.upgradeHomeRam();
        }

        for (const buy of newBuys) {
            if (ns.getPlayer().money * 0.25 > buy.equipment.price) {
                let result = ns.gang.purchaseEquipment(buy.member.name, buy.equipment.name);
                if (result)
                    ns.print(
                        ns.sprintf(
                            "Buying %s:%s for %s",
                            buy.member.name,
                            buy.equipment.name,
                            ns.nFormat(buy.equipment.price, "($0.000a)")
                        )
                    );
            }
        }

        await ns.sleep(10000);

        ns.print(ns.sprintf("=================================="));
    }

    const tasks = ns.gang
        .getTaskNames()
        .map((_name) => ns.gang.getTaskStats(_name))
        .filter((task) => task.isCombat)
        .sort((a, b) => b.baseMoney - a.baseMoney);

    for (const task of tasks) {
        ns.tprintf(
            "%22s %3s %3s %9s %s",
            task.name,
            task.baseMoney,
            task.difficulty,
            task.baseRespect,
            task.baseWanted
        );
    }
}
