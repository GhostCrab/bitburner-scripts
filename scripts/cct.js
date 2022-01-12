import { setns, mapHosts } from "./util.js";

function printCCT(ns, cct) {
    ns.tprintf("%s %s:", cct.host, cct.name);
    ns.tprintf("  %s", cct.type);
    ns.tprintf("  %s", cct.desc);
    ns.tprintf("  %s", cct.data);
}

/** @param {import("./index.d").NS } ns */
function answerCCT(ns, cct, answer) {
    let reward = ns.codingcontract.attempt(answer, cct.name, cct.host, { returnReward: true });

    if (reward === "") {
        ns.tprintf("ERROR: Failed to solve %s:%s of type %s", cct.host, cct.name, cct.type);
        ns.tprintf("  data: %s; answer: %s", cct.data.toString(), answer.toString());
    } else {
        ns.tprintf("SUCCESS: Solved %s:%s => %s", cct.host, cct.name, reward);
    }
}

class CCT {
    constructor(ns, hostname, filename) {
        this.name = filename;
        this.host = hostname;
        this.type = ns.codingcontract.getContractType(filename, hostname);
        this.desc = ns.codingcontract.getDescription(filename, hostname);
        this.data = ns.codingcontract.getData(filename, hostname);

        this.solve = _.bind(CCT["solve" + this.type.replace(/\s/g, "")], null, _, this);

		this.print(ns)
    }
    print(ns) {
        ns.tprintf("%s %s:", this.host, this.name);
        ns.tprintf("  %s", this.type);
        ns.tprintf("  %s", this.desc);
        ns.tprintf("  %s", this.data);
    }

    static solveTotalWaystoSum(ns, cct) {
        let N = cct.data;
        let dp = Array.from({ length: N + 1 }, (_, i) => 0);

        dp[0] = 1;

        for (let row = 1; row < N + 1; row++) {
            for (let col = 1; col < N + 1; col++) {
                if (col >= row) {
                    dp[col] = dp[col] + dp[col - row];
                }
            }
        }

        answerCCT(ns, cct, dp[N] - 1);
    }
    static solveSubarraywithMaximumSum(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveSpiralizeMatrix(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveArrayJumpingGame(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveMergeOverlappingIntervals(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveGenerateIPAddresses(ns, cct) {
        function validate(str) {
            if (str === "0") return true;
            if (str.length > 1 && str[0] === "0") return false;
            if (str.length > 3) return false;
            return parseInt(str) < 255;
        }

        let results = [];
        for (let i = 1; i <= 3; i++) {
            if (cct.data.length - i > 9) continue;

            let a = cct.data.substr(0, i);

            if (!validate(a)) continue;

            for (let j = 1; j <= 3; j++) {
                if (cct.data.length - (i + j) > 6) continue;

                let b = cct.data.substr(i, j);

                if (!validate(b)) continue;

                for (let k = 1; k <= 3; k++) {
                    if (cct.data.length - (i + j + k) > 3) continue;

                    let c = cct.data.substr(i + j, k);
                    let d = cct.data.substr(i + j + k);

                    if (validate(c) && validate(d)) {
                        results.push(a + "." + b + "." + c + "." + d);
                    }
                }
            }
        }

        answerCCT(ns, cct, results);
    }
    static solveAlgorithmicStockTraderI(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveAlgorithmicStockTraderII(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveAlgorithmicStockTraderIII(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveAlgorithmicStockTraderIV(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveMinimumPathSuminaTriangle(ns, cct) {
        function trav(tree, paths = [], tally = 0, level = 0, idx = 0) {
            let newTally = tally + tree[level][idx];

            if (level === tree.length - 1) {
                paths.push(newTally);
            } else {
                trav(tree, paths, newTally, level + 1, idx);
                trav(tree, paths, newTally, level + 1, idx + 1);
            }

            return paths;
        }

        answerCCT(ns, cct, trav(cct.data).sort((a, b) => a - b)[0]);
    }
    static solveUniquePathsinaGridI(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveUniquePathsinaGridII(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveSanitizeParenthesesinExpression(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveFindAllValidMathExpressions(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
    static solveFindLargestPrimeFactor(ns, cct) {
        ns.tprintf("WARNING: TODO: Write solver for cct's of type '%s' to solve %s:%s", cct.type, cct.host, cct.name);
    }
}

/** @param {import("./index.d").NS } ns */
export async function main(ns) {
    setns(ns);

    let hosts = mapHosts();
    let ccts = [];
    for (const [hostname, trail] of Object.entries(hosts)) {
        let ls = ns.ls(hostname).filter((filename) => filename.indexOf(".cct") !== -1);

        if (ls.length === 0) continue;

        ccts.push(new CCT(ns, hostname, ls[0]));
    }

    sprintf("found %d ccts", ccts.length);

    for (const cct of ccts) {
        cct.solve(ns);
    }
}
