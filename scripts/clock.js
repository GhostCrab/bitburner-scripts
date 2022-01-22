var lastEl;

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

function addBottomLine() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;

    const newRootEl = hookRootEl.cloneNode(true);
    newRootEl.children[0].firstChild.innerText = "";
    newRootEl.children[1].firstChild.innerText = "";
    newRootEl.children[1].firstChild.removeAttribute("id");

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);

    return newRootEl;
}

function addSingle() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;
    const overviewEl = hookRootEl.parentElement;
    const hackRootEl = overviewEl.children[2];

    const newRootEl = hackRootEl.cloneNode(true);
    newRootEl.removeChild(newRootEl.childNodes.item(1))
    
    const newEl = newRootEl.children[0].firstChild
    newEl.removeAttribute("id")
    newEl.innerText = ''

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl

    return [newRootEl, newEl]    
}

function addDouble() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;
    const overviewEl = hookRootEl.parentElement;
    const hackRootEl = overviewEl.children[2];

    const newRootEl = hackRootEl.cloneNode(true);
    
    const newEl1 = newRootEl.children[0].firstChild
    newEl1.removeAttribute("id")
    newEl1.innerText = ''

    const newEl2 = newRootEl.children[1].firstChild
    newEl2.removeAttribute("id")
    newEl2.innerText = ''

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl

    return [newRootEl, newEl1, newEl2]    
}

function addProgress() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;
    const overviewEl = hookRootEl.parentElement;
    const hackProgressEl = overviewEl.children[3];

    const newRootEl = hackProgressEl.cloneNode(true);
    const newSub1 = newRootEl.firstChild.firstChild
    const newSub2 = newRootEl.firstChild.firstChild.firstChild

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl

    return [newRootEl, newSub1, newSub2]


    /*
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
    */
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


    let [clockRootEl, clockEl] = addSingle()
    let [targetInfoRootEl, targetEl, incomeEl] = addDouble()
    let [hackStateRootEl, stateEl, countdownEl] = addDouble()
    let [hackProgressRootEl, hackProgressEl1, hackProgressEl2] = addProgress()
    let lineEl = addBottomLine()


    ns.atExit(function () {
        lineEl.parentNode.removeChild(lineEl);
        clockRootEl.parentNode.removeChild(clockRootEl);
        targetInfoRootEl.parentNode.removeChild(targetInfoRootEl);
        hackStateRootEl.parentNode.removeChild(hackStateRootEl);
        hackProgressRootEl.parentNode.removeChild(hackProgressRootEl);
    });

    let port = ns.getPortHandle(1);
    let startTime = 0;
    let endTime = 1000;
    let fullTime = 1000;
    let target = "";
    let income = "";
    let state = "";
    let countdown = "";
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
            // clockEl.innerText = date.toLocaleTimeString("it-IT") + "." + ms;
            clockEl.innerText = date.toLocaleTimeString("it-IT");

            // Update Target & Income
            targetEl.innerText = data[2];
            incomeEl.innerText = `${ns.nFormat(data[3], "($0.0a)")}/s`;

            // Update State & Countdown
            stateEl.innerText = data[4];
            countdownEl.innerText = stFormat(ns, endTime - curTime, false);

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

            hackProgressEl1.setAttribute("aria-valuenow", `${wholeValue}`);
            hackProgressEl2.setAttribute("style", `transform: translateX(${-transform.toFixed(3)}%);`);
        } else {
            let date = new Date();
            clockEl.innerText = date.toLocaleTimeString("it-IT");

            targetEl.innerText = "NO TARGET";
            incomeEl.innerText = "";
            stateEl.innerText = "";
            countdownEl.innerText = "";
            hackProgressEl1.setAttribute("aria-valuenow", "0");
            hackProgressEl2.setAttribute("style", "transform: translateX(-100%);");
        }

        await ns.sleep(1000);
    }
}
