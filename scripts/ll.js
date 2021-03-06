/** @type import(".").NS */
let ns = null;

function isScript(filename) {
    return filename.indexOf(".js") != -1;
}

function isProgram(filename) {
    return filename.indexOf(".exe") != -1;
}

function isOther(filename) {
    return !isScript(filename) && !isProgram(filename);
}

/** @param {NS} _ns **/
export async function main(_ns) {
    ns = _ns;

    let hostname = ns.getHostname();
    if (ns.args[0] && ns.serverExists(ns.args[0])) {
        hostname = ns.args[0];
    }

    let filenames = ns.ls(hostname);
    let scriptnames = filenames.filter(isScript);
    let programnames = filenames.filter(isProgram);
    let othernames = filenames.filter(isOther);

    let maxFileLength = 0;
    scriptnames.map(function (name) {
        let len = name.length + 2
        if (len > maxFileLength) maxFileLength = len;
    });

    if (scriptnames.length) {
        ns.tprintf("======== SCRIPTS ========");
        for (const filename of scriptnames)
            ns.tprintf(
                `  %-${maxFileLength}s %7.2fGB %s`,
                filename,
                ns.getScriptRam(filename, hostname),
                ns.scriptRunning(filename, hostname) ? "RUNNING" : ""
            );
    }

    if (programnames.length) {
        ns.tprintf("======== PROGRAMS =======");
        for (const filename of programnames) ns.tprintf(`  %-${maxFileLength}s`, filename);
    }

    if (othernames.length) {
        ns.tprintf("========= OTHER =========");
        for (const filename of othernames) ns.tprintf(`  %-${maxFileLength}s`, filename);
    }
}
