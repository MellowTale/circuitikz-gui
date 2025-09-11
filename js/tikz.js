import { halfPxToGrid, getCoordinate, getTerminalCenterPx } from "./state-geom.js";

export function regenerateTikz() {
    const out = [];
    out.push(`\\begin{figure}[h]\n\\centering\n\\begin{circuitikz}[american]`);

    // 1) 抵抗
    document.querySelectorAll(".resistor").forEach((el) => {
        const left = el.querySelector('.terminal[data-side="left"]');
        const right = el.querySelector('.terminal[data-side="right"]');
        const top = el.querySelector('.terminal[data-side="top"]');
        const bottom = el.querySelector('.terminal[data-side="bottom"]');
        let p1 = 0; let p2 = 0;
        if (left && right) {
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(left)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(right)));
        } else if (top && bottom) {
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(top)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(bottom)));
        } else return;
        if (el.classList.contains("o180") || el.classList.contains("o270")) {
            out.push(`\\draw (${p2.x},${p2.y}) to[european resistor] (${p1.x},${p1.y});`);
        } else {
            out.push(`\\draw (${p1.x},${p1.y}) to[european resistor] (${p2.x},${p2.y});`);
        }
    });

    // 2) 電源
    document.querySelectorAll(".vsource").forEach((el) => {
        const left = el.querySelector('.terminal[data-side="left"]');
        const right = el.querySelector('.terminal[data-side="right"]');
        const top = el.querySelector('.terminal[data-side="top"]');
        const bottom = el.querySelector('.terminal[data-side="bottom"]');
        let p1 = 0; let p2 = 0;
        if (left && right) {
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(left)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(right)));
        } else if (top && bottom) {
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(top)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(bottom)));
        } else return;
        if (el.classList.contains("o180") || el.classList.contains("o270")) {
            out.push(`\\draw (${p2.x},${p2.y}) to[battery1] (${p1.x},${p1.y});`);
        } else {
            out.push(`\\draw (${p1.x},${p1.y}) to[battery1] (${p2.x},${p2.y});`);
        }
    });

    // 3) GND
    document.querySelectorAll(".ground-img").forEach((g) => {
        const term = g.querySelector('.terminal');
        if (!term) return;
        const p = halfPxToGrid(getCoordinate(getTerminalCenterPx(term)));
        let angle = "";
        if (g.classList.contains("o90")) angle = ", rotate=270";
        else if (g.classList.contains("o180")) angle = ", rotate=180";
        else if (g.classList.contains("o270")) angle = ", rotate=90";
        out.push(`\\draw (${p.x},${p.y}) node[ground${angle}] {};`);
    });

    // 4) 導線
    document.querySelectorAll("svg#wireLayer .wire").forEach(poly => {
        const pts = (poly.getAttribute("points") || "")
            .split(" ").filter(Boolean)
            .map(s => { const [x, y] = s.split(",").map(Number); return { x, y }; });

        if (pts.length < 2) return;
        const seq = pts.map(p => {
            const g = halfPxToGrid(getCoordinate(p));
            return `(${g.x},${g.y})`;
        }).join(" -- ");
        out.push(`\\draw ${seq};`);
    });

    out.push(`\\end{circuitikz}\n\\end{figure}`);
    document.getElementById("output").value = out.join("\n");
}
