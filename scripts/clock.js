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
    const barRoot = document.createElement("tr");
    barRoot.className = "MuiTableRow-root css-9k2whp";
    barRoot.setAttribute("id", "extra-progress");
    tableEl.after(barRoot);
    const barSub1 = document.createElement("th");
    barSub1.className = "jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u";
    barSub1.setAttribute("scope", "row");
    barSub1.setAttribute("colspan", "2");
    barSub1.setAttribute("style", "padding-bottom: 2px; position: relative; top: -3px;");
    barRoot.appendChild(barSub1);
    const barSub2 = document.createElement("span");
    barSub2.className =
        "MuiLinearProgress-root MuiLinearProgress-colorPrimary MuiLinearProgress-determinate css-13u5e92";
    barSub2.setAttribute("role", "progressbar");
    barSub2.setAttribute("aria-valuenow", "0");
    barSub2.setAttribute("aria-valuemin", "0");
    barSub2.setAttribute("aria-valuemax", "100");
    barSub1.appendChild(barSub2);
    const barSub3 = document.createElement("span");
    barSub3.className = "MuiLinearProgress-bar MuiLinearProgress-barColorPrimary MuiLinearProgress-bar1Determinate css-1yk0k18";
    barSub3.setAttribute("style", "transform: translateX(-100%);");
    barSub2.appendChild(barSub3);

    ns.atExit(function () {
        barRoot.parentNode.removeChild(barRoot);
        hook0.innerText = "";
    });

    let port = ns.getPortHandle(1)
    let startTime = 0
    let endTime = 1000
    let fullTime = 1000
    while (true) {
        if (!port.empty()) {
            let data = port.read()
            startTime = data[0].getTime()
            endTime = new Date(startTime + data[1]).getTime()
            fullTime = endTime - startTime
        }

        let curTime = new Date().getTime()
        let tvalue = curTime - startTime;
        let nvalue = (tvalue / fullTime) * 100
        let transform = 100 - nvalue;
        let wholeValue = Math.floor(nvalue);

        if (startTime === 0) {
            transform = 100
            wholeValue = 0
        }

        try {
            let date = new Date();
            let ms = ns.sprintf("%03d", date.getUTCMilliseconds());
            hook0.innerText = date.toLocaleTimeString("it-IT") + "." + ms;
            barSub2.setAttribute("aria-valuenow", `${wholeValue}`);
            //barSub3.setAttribute("style", `transform: translateX(${-transform.toFixed(3)}%); background-color: rgb(100, 0, 0);`);
            barSub3.setAttribute("style", `transform: translateX(${-transform.toFixed(3)}%);`);
        } catch (err) {
            // This might come in handy later
            ns.print("ERROR: Update Skipped: " + String(err));
        }
        await ns.sleep(20);
    }

    // <tr class="MuiTableRow-root css-9k2whp">
    //     <th
    //         class="jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u"
    //         scope="row"
    //         colspan="2"
    //         style="padding-bottom: 2px; position: relative; top: -3px;"
    //     >
    //         <span
    //             class="MuiLinearProgress-root MuiLinearProgress-colorPrimary MuiLinearProgress-determinate css-ui9em5"
    //             role="progressbar"
    //             aria-valuenow="0"
    //             aria-valuemin="0"
    //             aria-valuemax="100"
    //         >
    //             <span
    //                 class="MuiLinearProgress-bar MuiLinearProgress-barColorPrimary MuiLinearProgress-bar1Determinate css-1yk0k18"
    //                 style="transform: translateX(-100%);"
    //             ></span>
    //         </span>
    //     </th>
    // </tr>;

    // <tr class="MuiTableRow-root css-9k2whp">
    //     <th
    //         class="jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u"
    //         scope="row"
    //         colspan="2"
    //         style="padding-bottom: 2px; position: relative; top: -3px;"
    //     >
    //         <span
    //             class="MuiLinearProgress-root MuiLinearProgress-colorPrimary MuiLinearProgress-determinate css-13u5e92"
    //             role="progressbar"
    //             aria-valuenow="73"
    //             aria-valuemin="0"
    //             aria-valuemax="100"
    //         >
    //             <span
    //                 class="MuiLinearProgress-bar MuiLinearProgress-barColorPrimary MuiLinearProgress-bar1Determinate css-1yk0k18"
    //                 style="transform: translateX(-27.0803%);"
    //             ></span>
    //         </span>
    //     </th>
    // </tr>;
}
