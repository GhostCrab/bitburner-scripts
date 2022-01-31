/** @param {import(".").NS } ns */
// Shoplift   $15.000k    02   $7.500k/s
// Rob Store  $400.000k 01:00   $6.667k/s
//       Mug   $36.000k    04   $9.000k/s
//   Larceny  $800.000k 01:30   $8.889k/s
// Deal Drugs  $120.000k    10  $12.000k/s
// Bond Forgery    $4.500m 05:00  $15.000k/s
// Traffick Arms  $600.000k    40  $15.000k/s
//  Homicide   $45.000k    03  $15.000k/s
// Grand Theft Auto    $1.600m 01:20  $20.000k/s
//    Kidnap    $3.600m 02:00  $30.000k/s
// Assassination   $12.000m 05:00  $40.000k/s
//     Heist  $120.000m 10:00 $200.000k/s

    
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

export async function main(ns) {
    // while (ns.getPlayer().numPeopleKilled < 30) {
    //     await ns.sleep(ns.commitCrime("homicide") + 200)
    // }

    const crimes = [
        "shoplift",
        "rob store",
        "mug",
        "larceny",
        "drugs",
        "bond forge",
        "traffick arms",
        "homicide",
        "grand auto",
        "kidnap",
        "assassinate",
        "heist",
    ];

    for (const crimename of crimes) {
        const crimeStats = ns.getCrimeStats(crimename);
        ns.tprintf("%16s  %9s %5s %9s/s", crimeStats.name, ns.nFormat(crimeStats.money, "($0.000a)"), stFormat(ns, crimeStats.time, false), ns.nFormat(crimeStats.money / (crimeStats.time / 1000), "($0.000a)"));
    }
}
