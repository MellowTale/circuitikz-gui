// ---- キャンバス情報 ----
export function getCanvasRect() {
    return document.getElementById("canvas").getBoundingClientRect();
}

// ---- グリッド/原点 ----
export const GRID = 20;
export const ORIGIN_PX = {
    x: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--origin-x")) || 120,
    y: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--origin-y")) || 30
};

// ---- 座標系変換 ----
export function getCoordinate(r) { return { x: r.x - ORIGIN_PX.x, y: r.y - ORIGIN_PX.y }; }
export function halfPxToGrid(r) { return { x: Math.round(r.x * 2 / GRID) / 4, y: - Math.round(r.y * 2 / GRID) / 4 }; }

export function snapPointToGridS(pt) { return { x: Math.round(pt.x * 2 / GRID) * GRID / 2, y: Math.round(pt.y * 2 / GRID) * GRID / 2 }; }
export function snapPointToGridL(pt) { return { x: Math.round(pt.x / GRID) * GRID, y: Math.round(pt.y / GRID) * GRID }; }

export function clampPointToCanvas(elsize, pt, margin = { l: 0, r: 0, t: 0, b: 0 }) {
    const canvas = document.getElementById("canvas");
    const maxR = { x: canvas.clientWidth - margin.r - 1, y: canvas.clientHeight - margin.b - 1 };
    return { x: Math.max(margin.l, Math.min(pt.x, maxR.x)), y: Math.max(margin.t, Math.min(pt.y, maxR.y)) };
}

export function normalizeCanvasPoint(elsize, pt, margin = { l: 0, r: 0, t: 0, b: 0 }, gridSize = "L") {
    const clamped = clampPointToCanvas(elsize, pt, margin);
    if (gridSize === "S") return snapPointToGridS(clamped);
    if (gridSize === "L") return snapPointToGridL(clamped);
    return clamped;
}

export function getHandleRadiusPx() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--termRadius")) || 5;
}

export function getTerminalCenterPx(termEl) {
    const owner = document.getElementById(termEl.dataset.owner);
    const side = termEl.dataset.side; // left|right|top|bottom
    const termStyle = getComputedStyle(termEl);
    const termRadius = getHandleRadiusPx();
    const canvasRect = getCanvasRect();
    const ownerRect = owner.getBoundingClientRect();
    const base = { x: ownerRect.left - canvasRect.left, y: ownerRect.top - canvasRect.top };

    if (side === "left") return { x: base.x + parseFloat(termStyle.left) + termRadius, y: base.y + ownerRect.height / 2 };
    if (side === "right") return { x: base.x + ownerRect.width - parseFloat(termStyle.right) - termRadius, y: base.y + ownerRect.height / 2 };
    if (side === "top") return { x: base.x + ownerRect.width / 2, y: base.y + parseFloat(termStyle.top) + termRadius };
  /* bottom */           return { x: base.x + ownerRect.width / 2, y: base.y + ownerRect.height - parseFloat(termStyle.bottom) - termRadius };
}

export function toCanvasPoint(e) {
    const r = getCanvasRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}
