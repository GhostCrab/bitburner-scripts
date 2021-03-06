var lastEl;
var roots = [];

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

    roots.push(newRootEl);

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
    newRootEl.removeChild(newRootEl.childNodes.item(1));

    const newEl = newRootEl.children[0].firstChild;
    newEl.removeAttribute("id");
    newEl.innerText = "";

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl;

    roots.push(newRootEl);

    return newEl;
}

function addDouble() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;
    const overviewEl = hookRootEl.parentElement;
    const hackRootEl = overviewEl.children[2];

    const newRootEl = hackRootEl.cloneNode(true);

    const newEl1 = newRootEl.children[0].firstChild;
    newEl1.removeAttribute("id");
    newEl1.innerText = "";

    const newEl2 = newRootEl.children[1].firstChild;
    newEl2.removeAttribute("id");
    newEl2.innerText = "";

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl;

    roots.push(newRootEl);

    return [newEl1, newEl2];
}

function addProgress() {
    const self = globalThis;
    const doc = self["document"];
    const hook0 = doc.getElementById("overview-extra-hook-0");
    const hookRootEl = hook0.parentElement.parentElement;
    const overviewEl = hookRootEl.parentElement;
    const hackProgressEl = overviewEl.children[3];

    const newRootEl = hackProgressEl.cloneNode(true);
    const newSub1 = newRootEl.firstChild.firstChild;
    const newSub2 = newRootEl.firstChild.firstChild.firstChild;

    if (lastEl === undefined) lastEl = hookRootEl;

    lastEl.after(newRootEl);
    lastEl = newRootEl;

    roots.push(newRootEl);

    return [newSub1, newSub2];
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

    let clockEl = addSingle();
    let targetEl = addSingle();
    let incomeEl = addSingle();
    let [stateEl, countdownEl] = addDouble();
    let [hackProgressEl1, hackProgressEl2] = addProgress();
    addBottomLine();

    ns.atExit(function () {
        for (const root of roots) root.parentNode.removeChild(root);
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
