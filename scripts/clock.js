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
        if (hours > 0 || showfull) return ns.sprintf("%dh%02dm%02d.%03ds", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%dm%02d.%03ds", minutes, seconds, milliseconds);
        return ns.sprintf("%d.%03ds", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%dh%02dm%02ds", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%dm%02ds", minutes, seconds);
        return ns.sprintf("%ds", seconds);
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    const args = ns.flags([["help", false]]);
    if (args.help) {
        ns.tprint("This script will enhance your HUD (Heads up Display) with custom statistics.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }

    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const tableEl = hook0.parentElement.parentElement;

    // Add Clock
    const clockRoot = doc.createElement("tr");
    clockRoot.className = "MuiTableRow-root css-9k2whp";
    clockRoot.setAttribute("id", "extra-clock");
    tableEl.after(clockRoot);
    const clockSub1 = doc.createElement("th");
    clockSub1.className = "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u";
    clockSub1.setAttribute("scope", "row");
    clockRoot.appendChild(clockSub1);
    const clockSub11 = doc.createElement("p");
    clockSub11.className = "jss17 MuiTypography-root MuiTypography-body1 css-fjpam8";
    clockSub11.innerText = "clock";
    clockSub1.appendChild(clockSub11);

    // Add Target & Income/s
    const tInfoRoot = doc.createElement("tr");
    tInfoRoot.className = "MuiTableRow-root css-9k2whp";
    tInfoRoot.setAttribute("id", "extra-target-info");
    clockRoot.after(tInfoRoot);
    const tInfoSub1 = doc.createElement("th");
    tInfoSub1.className = "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u";
    tInfoSub1.setAttribute("scope", "row");
    tInfoSub1.setAttribute("style", "padding-right: 0.5em");
    tInfoRoot.appendChild(tInfoSub1);
    const tInfoSub11 = doc.createElement("p");
    tInfoSub11.className = "jss17 MuiTypography-root MuiTypography-body1 css-fjpam8";
    tInfoSub11.innerText = "tname";
    tInfoSub1.appendChild(tInfoSub11);
    const tInfoSub2 = doc.createElement("th");
    tInfoSub2.className =
        "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-alignRight MuiTableCell-sizeMedium css-7v1cxh";
    tInfoSub2.setAttribute("scope", "row");
    tInfoRoot.appendChild(tInfoSub2);
    const tInfoSub21 = doc.createElement("p");
    tInfoSub21.className = "jss17 MuiTypography-root MuiTypography-body1 css-fjpam8";
    tInfoSub21.innerText = "income";
    tInfoSub2.appendChild(tInfoSub21);

    // Add Hack State & Countdown
    const hackStateRoot = doc.createElement("tr");
    hackStateRoot.className = "MuiTableRow-root css-9k2whp";
    hackStateRoot.setAttribute("id", "extra-hack-state");
    tInfoRoot.after(hackStateRoot);
    const hackStateSub1 = doc.createElement("th");
    hackStateSub1.className = "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u";
    hackStateSub1.setAttribute("scope", "row");
    hackStateRoot.appendChild(hackStateSub1);
    const hackStateSub11 = doc.createElement("p");
    hackStateSub11.className = "jss17 MuiTypography-root MuiTypography-body1 css-fjpam8";
    hackStateSub11.innerText = "state";
    hackStateSub1.appendChild(hackStateSub11);
    const hackStateSub2 = doc.createElement("th");
    hackStateSub2.className =
        "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-alignRight MuiTableCell-sizeMedium css-7v1cxh";
    hackStateSub2.setAttribute("scope", "row");
    hackStateRoot.appendChild(hackStateSub2);
    const hackStateSub21 = doc.createElement("p");
    hackStateSub21.className = "jss17 MuiTypography-root MuiTypography-body1 css-fjpam8";
    hackStateSub21.innerText = "countdown";
    hackStateSub2.appendChild(hackStateSub21);

    // Add Progress Bar
    const barRoot = doc.createElement("tr");
    barRoot.className = "MuiTableRow-root css-9k2whp";
    barRoot.setAttribute("id", "extra-progress");
    hackStateRoot.after(barRoot);
    const barSub1 = doc.createElement("th");
    barSub1.className = "jss14 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u";
    barSub1.setAttribute("scope", "row");
    barSub1.setAttribute("colspan", "2");
    barSub1.setAttribute("style", "padding-bottom: 2px; position: relative; top: -3px;");
    barRoot.appendChild(barSub1);
    const barSub2 = doc.createElement("span");
    barSub2.className =
        "MuiLinearProgress-root MuiLinearProgress-colorPrimary MuiLinearProgress-determinate css-13u5e92";
    barSub2.setAttribute("role", "progressbar");
    barSub2.setAttribute("aria-valuenow", "0");
    barSub2.setAttribute("aria-valuemin", "0");
    barSub2.setAttribute("aria-valuemax", "100");
    barSub1.appendChild(barSub2);
    const barSub3 = doc.createElement("span");
    barSub3.className =
        "MuiLinearProgress-bar MuiLinearProgress-barColorPrimary MuiLinearProgress-bar1Determinate css-1yk0k18";
    barSub3.setAttribute("style", "transform: translateX(-100%);");
    barSub2.appendChild(barSub3);

    ns.atExit(function () {
        clockRoot.parentNode.removeChild(clockRoot);
        barRoot.parentNode.removeChild(barRoot);
        tInfoRoot.parentNode.removeChild(tInfoRoot);
        hackStateRoot.parentNode.removeChild(hackStateRoot);
    });

    let port = ns.getPortHandle(1);
    let startTime = 0;
    let endTime = 1000;
    let fullTime = 1000;
    let target = ""
    let income = ""
    let state = ""
    let countdown = ""
    while (true) {
        if (!port.empty()) {
            let data = port.peek();
            startTime = data[0].getTime();
            endTime = new Date(startTime + data[1]).getTime();
            fullTime = endTime - startTime;

            let date = new Date();
            let curTime = date.getTime();

            // Update Clock
            // let ms = ns.sprintf("%03d", date.getUTCMilliseconds());
            // clockSub11.innerText = date.toLocaleTimeString("it-IT") + "." + ms;
            clockSub11.innerText = date.toLocaleTimeString("it-IT");

            // Update Target & Income
            tInfoSub11.innerText = data[2];
            tInfoSub21.innerText = `${ns.nFormat(data[3], "($0.0a)")}/s`;

            // Update State & Countdown
            hackStateSub11.innerText = data[4];
            hackStateSub21.innerText = stFormat(ns, endTime - curTime, false);

            // Update Progress
            let tvalue = curTime - startTime;
            let nvalue = (tvalue / fullTime) * 100;
            let transform = 100 - nvalue;
            let wholeValue = Math.floor(nvalue);
            
            if (startTime === 0 || wholeValue > 100) {
                port.clear();
                transform = 100;
                wholeValue = 0;
            }

            barSub2.setAttribute("aria-valuenow", `${wholeValue}`);
            barSub3.setAttribute("style", `transform: translateX(${-transform.toFixed(3)}%);`);
        } else {
            let date = new Date();
            clockSub11.innerText = date.toLocaleTimeString("it-IT");

            tInfoSub11.innerText = "NO TARGET";
            tInfoSub21.innerText = "";
            hackStateSub11.innerText = "";
            hackStateSub21.innerText = "";
            barSub2.setAttribute("aria-valuenow", "0");
            barSub3.setAttribute("style", "transform: translateX(-100%);");
        }

        await ns.sleep(1000);
    }
}
