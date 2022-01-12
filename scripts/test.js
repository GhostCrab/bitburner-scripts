function printServer(ns, serverArg) {
    let server = serverArg;
    if (server instanceof String) server = ns.getServer(server);

    let labelBuffer = 23;

    ns.tprintf(server.hostname + ":");
    ns.tprintf("  %23s: %s", "Root Access", server.hasAdminRights ? "TRUE" : "FALSE");
    ns.tprintf("  %23s: %s", "Maximum Money", ns.nFormat(server.moneyMax, "($0.000a)"));
    ns.tprintf(
        "  %23s: %s/%s",
        "Available Money",
        ns.nFormat(server.moneyAvailable, "($0.000a)"),
        ns.nFormat(server.moneyMax * 0.75, "($0.000a)")
    );
    ns.tprintf("  %23s: %.2f", "Hack Difficulty", server.hackDifficulty);
    ns.tprintf("  %23s: %.2f%%", "Hack Chance", ns.hackAnalyzeChance(server.hostname) * 100);
    ns.tprintf("  %23s: %d", "Hack Difficulty (MIN)", server.minDifficulty);
    ns.tprintf("  %23s: %d", "Hack Difficulty (BASE)", server.baseDifficulty);
    ns.tprintf("  %23s: %s", "Hacking Requirement", server.requiredHackingSkill);
    // ns.tprintf("  %23s: %s", "Open Ports", server.openPortCount)
    // ns.tprintf("  %23s: %s", "Open Ports Required", server.numOpenPortsRequired)
    // ns.tprintf("  %23s: %s", "Maximum Ram", server.maxRam)
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    // let env = new HackEnv(ns, "max-hardware", "rothman-uni");
    // env.simEnabled = true;

    // // simulate for 10 minutes
    // env.fastSim(ns, 1000 * 60 * 100);

    // ns.tprintf("Running Hack Rate on %s=>%s (%.2fGB Ram Allowance): %s/s",
    // env.hostname, env.targetname, env.ramAllowance, ns.nFormat(env.simIncome / env.simTime, "($0.000a)"),)

    printServer(ns, "foodnstuff")
}
