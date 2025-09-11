const Junctions = new Map();

import {
    getCanvasRect, getTerminalCenterPx, normalizeCanvasPoint, snapPointToGridS, toCanvasPoint, halfPxToGrid, getCoordinate
} from "./state-geom.js";
import { regenerateTikz } from "./tikz.js";

function gridKeyOfPoint(p) { const g = halfPxToGrid(getCoordinate(p)); return `${g.x},${g.y}`; }

function parseWpId(wpId) {
    const m = /^wp_(.+)_(\d+)$/.exec(wpId || "");
    return m ? { wireId: m[1], index: parseInt(m[2], 10) } : null;
}
function refFromWpId(wpId) {
    const m = parseWpId(wpId);
    return m ? `${m.wireId}:${m.index}` : null;
}
function getRefs(masterId) {
    const n = Junctions.get(masterId); return n ? Array.from(n.refs) : [];
}
function findMasterByGridKey(key) {
    for (const [mid, node] of Junctions) if (node.gridKey === key) return mid;
    return null;
}
function findMasterByWaypoint(wpId) {
    for (const [mid, node] of Junctions) {
        if (node.refs.has(refFromWpId(wpId))) return mid;
    }
    return null;
}

// ---- 選択状態 ----
export function clearSelection() {
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    if (window.WaypointHandles) WaypointHandles.clear?.();
}

// ---- 配置状態 ----
let elementCount = 0;
let placing = { active: false, el: null, kind: null };

// ---- 配置API ----
export function startPlacing(kind) {
    if (wiring.active) cancelWiring();
    if (placing.active) cancelPlacing();

    let el = null;
    if (kind === 'ground-img') el = addGround();
    else if (kind === 'resistor') el = add2PinElement('resistor');
    else if (kind === 'vsource') el = add2PinElement('vsource');
    if (!el) return;

    el.classList.add('component-preview');
    placing = { active: true, el, kind };
    document.getElementById("canvas").classList.add("placing-active");
}

function finalizePlacing(e) {
    if (!placing.active) return;
    placeElementUnderCursor(placing.el, e);
    placing.el.classList.remove('component-preview');
    placing.el.style.pointerEvents = '';
    makeDraggable(placing.el);
    regenerateTikz?.();
    document.getElementById('canvas').classList.remove('placing-active');
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('is-active'));
    placing = { active: false, el: null, kind: null };
}

function cancelPlacing() {
    if (!placing.active) return;
    placing.el?.remove();
    document.getElementById('canvas').classList.remove('placing-active');
    placing = { active: false, el: null, kind: null };
}

(function setupPlacingEvents() {
    const canvas = document.getElementById('canvas');
    canvas.addEventListener('pointermove', (e) => { if (!placing.active) return; placeElementUnderCursor(placing.el, e); }, { passive: true });
    canvas.addEventListener('pointerdown', (e) => { if (!placing.active) return; if (e.button !== 0 && e.pointerType === 'mouse') return; e.stopPropagation(); finalizePlacing(e); });
    window.addEventListener('keydown', (e) => { const el = document.activeElement; const isEditing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); if (isEditing) return; if (e.key === 'Escape') cancelPlacing(); });
})();

// ---- コンポーネント生成 ----
function createComponent({ className, pinSides = [], innerHTML = "", idPrefix, extraMargin = { l: 0, r: 0, t: 0, b: 0 } }) {
    const canvas = document.getElementById("canvas");
    const el = document.createElement("div");
    el.className = className;
    el.id = (idPrefix || className) + (elementCount++);
    el.innerHTML = innerHTML;

    el.addEventListener("pointerdown", onElementClick);

    pinSides.forEach(side => {
        const t = document.createElement("div");
        t.className = "terminal";
        t.id = `${el.id}-${side}`;
        t.dataset.owner = el.id;
        t.dataset.side = side;
        t.addEventListener("pointerdown", handleTerminalClick);
        el.appendChild(t);
    });

    canvas.appendChild(el);

    el.margin = {
        l: el.offsetWidth / 2 + extraMargin.l,
        r: el.offsetWidth / 2 + extraMargin.r,
        t: el.offsetHeight / 2 + extraMargin.t,
        b: el.offsetHeight / 2 + extraMargin.b
    };
    regenerateTikz?.();
    return el;
}

function placeElementUnderCursor(el, e) {
    const pt = toCanvasPoint(e);
    const elsize = { w: el.offsetWidth, h: el.offsetHeight };
    const margin = el.margin || { l: 0, r: 0, t: 0, b: 0 };
    const raw = { x: pt.x, y: pt.y };
    const p = normalizeCanvasPoint({ w: elsize.w, h: elsize.h }, raw, margin, "S");
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
}

function add2PinElement(className) {
    const extra = (className === 'resistor' || className === 'vsource') ? { l: 20, r: 20, t: 0, b: 0 } : { l: 0, r: 0, t: 0, b: 0 };
    return createComponent({ className, pinSides: ["left", "right"], extraMargin: extra });
}

function addGround() {
    return createComponent({ className: "ground-img", pinSides: ["top"], innerHTML: `<img src="gnd.svg" alt="GND">` });
}

// ---- 回転 ----
export function rotateSelected() {
    const el = document.querySelector('.resistor.selected, .vsource.selected, .ground-img.selected');
    if (!el) return; rotateElement(el);
}

function rotateElement(el) {
    const cur = parseInt(el.dataset.angle, 10) || 0;
    const next = (cur + 90 + 360) % 360;
    el.dataset.angle = String(next);
    el.classList.toggle("o0", next === 0);
    el.classList.toggle("o90", next === 90);
    el.classList.toggle("o180", next === 180);
    el.classList.toggle("o270", next === 270);

    const MAP = { left: 'top', top: 'right', right: 'bottom', bottom: 'left' };
    el.querySelectorAll('.terminal').forEach(t => { const nx = MAP[t.dataset.side]; if (nx) t.dataset.side = nx; });
    updateConnections();
    regenerateTikz?.();
}

// ---- 選択/クリック ----
function onElementClick(e) {
    if (e.target.classList.contains("terminal")) return;
    if (wiring.active) return;
    clearSelection();
    e.currentTarget.classList.add("selected");
}
function handleTerminalClick(e) {
    e.stopPropagation();
    const terminal = e.target;
    if (!wiring.active) startWiring(terminal);
    else finishWiring(terminal);
}

// ---- ドラッグ ----
function makeDraggable(element) {
    let offset = { x: 0, y: 0 };
    let isDragging = false;

    element.addEventListener('pointerdown', onPointerDown);

    function onPointerDown(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        element.setPointerCapture?.(e.pointerId);
        const elRect = element.getBoundingClientRect();
        isDragging = true;
        offset.x = e.clientX - elRect.left - elRect.width / 2;
        offset.y = e.clientY - elRect.top - elRect.height / 2;
        document.body.classList.add("no-select");
        document.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('pointerup', onPointerUp, { passive: true });
    }
    function onPointerMove(e) {
        if (!isDragging) return;
        const canvasRect = getCanvasRect();
        const raw = { x: e.clientX - canvasRect.left - offset.x, y: e.clientY - canvasRect.top - offset.y };
        const elsize = { w: element.offsetWidth, h: element.offsetHeight };
        const margin = element.margin || { l: 0, r: 0, t: 0, b: 0 };
        const p = normalizeCanvasPoint(elsize, raw, margin, "S");
        element.style.left = `${p.x}px`;
        element.style.top = `${p.y}px`;
        updateConnections();
        scheduleTikz();
    }
    let tikzQueued = false;
    function scheduleTikz() {
        if (tikzQueued) return;
        tikzQueued = true;
        requestAnimationFrame(() => { tikzQueued = false; regenerateTikz(); });
    }
    function onPointerUp(e) {
        isDragging = false;
        element.releasePointerCapture?.(e.pointerId);
        document.body.classList.remove("no-select");
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        regenerateTikz?.();
    }
}

// ---- 配線状態 ----
export const wiring = {
    active: false,
    fromTerminal: null,
    tempPoints: [],
    preview: null,
};

// ---- 配線フロー ----
export function startWiring(fromTerminal) {
    fromTerminal.style.backgroundColor = "#59f";
    wiring.active = true;
    wiring.fromTerminal = fromTerminal;
    wiring.tempPoints = [];

    document.getElementById("canvas").classList.add("wiring-active");
    if (typeof window.showAllWaypoints === 'function') window.showAllWaypoints();

    const svg = document.getElementById("wireLayer");
    wiring.preview = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    wiring.preview.setAttribute("id", "preview");
    wiring.preview.setAttribute("fill", "none");
    wiring.preview.setAttribute("stroke", "black");
    wiring.preview.setAttribute("stroke-width", "2");
    svg.appendChild(wiring.preview);
}

function addWaypoint(pt) {
    const p = snapPointToGridS(pt);
    wiring.tempPoints.push(p);
    updatePreview();
}

function updatePreview(currentPt) {
    if (!wiring.preview) return;
    const p0 = snapPointToGridS(getTerminalCenterPx(wiring.fromTerminal));
    const pts = [p0, ...wiring.tempPoints];
    if (currentPt) pts.push(snapPointToGridS(currentPt));
    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(" ");
    wiring.preview.setAttribute("points", pointsStr);
    WaypointPreview.sync();
}
// 経由点ID → px座標を取得（wp_<wireId>_<index>）
function getWaypointPx(waypointId) {
    const m = /^wp_(.+)_(\d+)$/.exec(waypointId || ""); if (!m) return null;
    const poly = document.querySelector(`svg#wireLayer .wire[data-wire-id="${m[1]}"]`);
    if (!poly) return null;
    const pts = (poly.getAttribute('points') || '').split(' ').filter(Boolean)
        .map(s => { const [x, y] = s.split(',').map(Number); return { x, y }; });
    const idx = parseInt(m[2], 10);
    return (idx > 0 && idx < pts.length - 1) ? pts[idx] : null;
}

function finishWiringToWaypoint(waypointId) {
    const pEndPx = getWaypointPx(waypointId); // 既存 or 先に作ったヘルパ
    if (!pEndPx) { cancelWiring(); return; }

    // 1) その位置のjunctionを取得/作成
    const key = gridKeyOfPoint(pEndPx);
    let master = findMasterByGridKey(key);
    if (!master) { // 新規junction: 自分をmasterに
        master = waypointId;
        Junctions.set(master, { gridKey: key, refs: new Set([refFromWpId(waypointId)]) });
    } else {
        // 既存junctionに自分(wireId:index)を登録
        Junctions.get(master).refs.add(refFromWpId(waypointId));
    }

    // 2) 実配線（toId は常に master を参照＝別点を作らない）
    const svg = document.getElementById('wireLayer');
    const wireId = 'w' + Date.now() + Math.random().toString(36).slice(2, 6);

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'black'); poly.setAttribute('stroke-width', '2');
    poly.classList.add('wire'); poly.dataset.wireId = wireId;

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    hit.classList.add('wire-hit'); hit.dataset.wireId = wireId;

    const pStart = snapPointToGridS(getTerminalCenterPx(wiring.fromTerminal));
    const pEnd = snapPointToGridS(pEndPx);
    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    const s = allPts.map(p => `${p.x},${p.y}`).join(' ');
    poly.setAttribute('points', s); hit.setAttribute('points', s);

    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = master;         // ← ここが肝：常に master を参照
    svg.appendChild(poly); svg.appendChild(hit);
    attachWireHoverHandlers(poly, hit);

    // 終了処理
    if (wiring.preview) { wiring.preview.remove(); wiring.preview = null; }
    wiring.active = false; wiring.fromTerminal = null; wiring.tempPoints = [];
    document.getElementById('canvas').classList.remove('wiring-active');
    if (window.WaypointHandles) WaypointHandles.clear();
    regenerateTikz?.();
}

function finishWiring(toPt) {
    if (toPt.dataset.owner && (toPt.dataset.owner === wiring.fromTerminal.dataset.owner)) return cancelWiring();
    wiring.fromTerminal && (wiring.fromTerminal.style.backgroundColor = "red");
    const svg = document.getElementById("wireLayer");
    const wireId = "w" + Date.now() + Math.random().toString(36).slice(2, 6);

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "black");
    poly.setAttribute("stroke-width", "2");
    poly.classList.add("wire");
    poly.dataset.wireId = wireId;

    const polyHit = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyHit.classList.add("wire-hit");
    polyHit.dataset.wireId = wireId;

    const pStart = snapPointToGridS(getTerminalCenterPx(wiring.fromTerminal));
    const pEnd = toPt.dataset.owner ? snapPointToGridS(getTerminalCenterPx(toPt))
        : snapPointToGridS({ x: parseFloat(toPt.style.left), y: parseFloat(toPt.style.top) });
    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    const pointsStr = allPts.map(p => `${p.x},${p.y}`).join(" ");

    poly.setAttribute("points", pointsStr);
    polyHit.setAttribute("points", pointsStr);
    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = toPt.id;
    svg.appendChild(poly);
    svg.appendChild(polyHit);
    attachWireHoverHandlers(poly, polyHit);

    if (wiring.preview) { wiring.preview.remove(); wiring.preview = null; }
    regenerateTikz();

    wiring.active = false;
    wiring.fromTerminal = null;
    wiring.tempPoints = [];
    document.getElementById("canvas").classList.remove("wiring-active");
    if (window.WaypointHandles) WaypointHandles.clear();
}

export function cancelWiring() {
    if (wiring.fromTerminal) wiring.fromTerminal.style.backgroundColor = "red";
    if (wiring.preview) { wiring.preview.remove(); wiring.preview = null; }
    wiring.active = false; wiring.fromTerminal = null; wiring.tempPoints = [];
    document.getElementById("canvas").classList.remove("wiring-active");
    if (window.WaypointHandles) WaypointHandles.clear();
}

// ---- ワイヤ編集UI（ハンドル） ----
function polyGetPoints(poly) {
    return (poly.getAttribute('points') || '')
        .split(' ').filter(Boolean)
        .map(t => { const [x, y] = t.split(',').map(Number); return { x, y }; });
}
function polySetPoints(poly, pts) {
    const newStr = pts.map(p => `${p.x},${p.y}`).join(' ');
    poly.setAttribute('points', newStr);
    if (poly.classList.contains("wire") && poly.dataset.wireId) {
        const hit = document.querySelector(`svg#wireLayer .wire-hit[data-wire-id="${poly.dataset.wireId}"]`);
        if (hit) hit.setAttribute("points", newStr);
    }
}

const handleLayer = document.getElementById('handleLayer');
function clearWaypointHandles() { if (handleLayer) handleLayer.innerHTML = ''; }
function placeHandleAt(h, p) { h.style.left = p.x + 'px'; h.style.top = p.y + 'px'; }

let dragging = null;
let currentWire = null;

function makeHandleDraggable(h, poly, index, isPreview) {
    h.addEventListener('pointerdown', (e) => {
        if (wiring.active) return;
        e.stopPropagation();
        h.classList.add('selected');
        h.setPointerCapture?.(e.pointerId);
        dragging = { handle: h, poly, index, isPreview };
        const wpId = h.dataset.waypointId;
        if (wpId) {
            const key = gridKeyOfPoint(polyGetPoints(poly)[index]);
            let master = (typeof findMasterByWaypoint === 'function') ? (findMasterByWaypoint(wpId) || null) : null;
            if (!master) {
                master = (typeof findMasterByGridKey === 'function') ? (findMasterByGridKey(key) || wpId) : wpId;
                if (!Junctions.has(master)) Junctions.set(master, { gridKey: key, refs: new Set() });
            }
            const node = Junctions.get(master);
            node.refs.add(refFromWpId(wpId));
            Junctions.set(master, node);
        }
    });
    h.addEventListener('click', (ev) => {
        if (wiring.active && h.dataset.waypointId) {
            ev.stopPropagation();
            finishWiringToWaypoint(h.dataset.waypointId);
        }
    });
}

function showWaypointsForPolyline(poly, opts = { isPreview: false, append: false }) {
    if (!handleLayer || !poly) return;
    if (!opts.append) clearWaypointHandles();
    currentWire = opts.isPreview ? null : poly;
    const pts = polyGetPoints(poly);
    if (pts.length < 3) return;
    for (let i = 1; i < pts.length - 1; i++) {
        const h = document.createElement("div");
        h.className = "handle-waypoint";
        h.dataset.index = String(i);
        h.dataset.preview = opts.isPreview ? "1" : "0";
        placeHandleAt(h, pts[i]);
        if (!opts.isPreview && poly.dataset.wireId) {
            const wpId = `wp_${poly.dataset.wireId}_${i}`;
            h.id = wpId;
            h.dataset.waypointId = wpId;
            h.dataset.wireId = poly.dataset.wireId;
            const key = gridKeyOfPoint(pts[i]);
            let master = findMasterByGridKey(key);
            if (master) {
                // 既存junctionに「この経由点」を合流
                Junctions.get(master).refs.add(refFromWpId(wpId));
                if (master === wpId) h.classList.add('is-junction');
                else h.classList.add('is-alias');
            } else {
                // まだjunctionがないが、この経由点を toId に使っているワイヤがあれば主として昇格
                const used = document.querySelector(`svg#wireLayer .wire[data-to-id="${wpId}"]`);
                if (used) {
                    master = wpId;
                    Junctions.set(master, { gridKey: key, refs: new Set([refFromWpId(wpId)]) });
                    h.classList.add('is-junction');
                }
            }
        }
        makeHandleDraggable(h, poly, i, opts.isPreview);
        handleLayer.appendChild(h);
    }
}

document.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = normalizeCanvasPoint({ w: 0, h: 0 }, toCanvasPoint(e), { l: 0, r: 0, t: 0, b: 0 }, "S");
    placeHandleAt(dragging.handle, p);
    const pts = polyGetPoints(dragging.poly);
    const idx = Math.max(1, Math.min(pts.length - 2, dragging.index));
    pts[idx] = p; polySetPoints(dragging.poly, pts);
    if (!dragging.isPreview) {
        if (!dragging.isPreview) {
            const wpId = dragging.handle.dataset.waypointId; // ← ドラッグ中の “経由点ID”

            // 1) junction 同期（あなたの既存コードがあればそのまま残してください）
            //    - master = findMasterByWaypoint(wpId) || wpId; ... 等
            //    - Junctions の refs に合流 / gridKey 更新 ... 等

            // 2) 依存ワイヤ（toId = master）を “その場で” 末端更新
            const master = (typeof findMasterByWaypoint === 'function' && wpId)
                ? (findMasterByWaypoint(wpId) || wpId)
                : wpId;
            if (master) {
                document.querySelectorAll('svg#wireLayer .wire').forEach(w => {
                    if (w.dataset.toId === master) {
                        const arr = polyGetPoints(w);
                        if (arr.length >= 2) {
                            arr[arr.length - 1] = p;        // 末端を今の座標 p に
                            polySetPoints(w, arr);
                        }
                    }
                });
            }

            // 3) 念のための整合（端子側の追従などは既存の updateConnections に任せる）
            if (typeof updateConnections === 'function') updateConnections();
            regenerateTikz?.();
        }
    }
});
document.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging.handle.releasePointerCapture?.(e.pointerId);
    dragging.handle.classList.remove('selected');
    dragging = null;
});

function attachWireHoverHandlers(poly, polyHit) {
    polyHit.addEventListener('pointerenter', () => { if (wiring.active) return; WaypointHandles.forWire(poly); });
    polyHit.addEventListener('pointerleave', (e) => {
        if (wiring.active) return;
        if (window.WaypointHandles.isDragging()) return;
        const rt = e.relatedTarget;
        if (rt && rt.closest && rt.closest('#handleLayer')) return;
        WaypointHandles.clear();
    });
    polyHit.addEventListener("dblclick", () => { const id = poly.dataset.wireId; if (id) removeWire(id); });
}

export function updateConnections() {
    document.querySelectorAll("svg#wireLayer .wire").forEach(poly => {
        const from = document.getElementById(poly.dataset.fromId);
        let to = null, toWp = null;
        if (poly.dataset.toId) {
            if (poly.dataset.toId.startsWith('wp_')) toWp = poly.dataset.toId;
            else to = document.getElementById(poly.dataset.toId);
        }
        if (!from && !to && !toWp) { removeWire(poly.dataset.wireId); return; }

        const pts = polyGetPoints(poly);
        if (pts.length < 2) return;
        if (from) pts[0] = snapPointToGridS(getTerminalCenterPx(from));
        if (to) pts[pts.length - 1] = snapPointToGridS(getTerminalCenterPx(to));
        else if (toWp) {
            const p = getWaypointPx(toWp);
            if (p) pts[pts.length - 1] = snapPointToGridS(p);
        }
        const s = pts.map(p => `${p.x},${p.y}`).join(" ");
        poly.setAttribute("points", s);
        const hit = document.querySelector(`svg#wireLayer .wire-hit[data-wire-id="${poly.dataset.wireId}"]`);
        if (hit) hit.setAttribute("points", s);
    });
}

export function removeWire(wireId) {
    document.querySelectorAll(`#wireLayer .wire[data-wire-id="${wireId}"], #wireLayer .wire-hit[data-wire-id="${wireId}"]`).forEach(n => n.remove());

    // a) junction refsから当該wireの参照を削除
    for (const [mid, node] of Junctions) {
        let changed = false;
        node.refs.forEach(ref => { if (ref.startsWith(`${wireId}:`)) { node.refs.delete(ref); changed = true; } });
        // refsが空になったjunctionは削除
        if (node.refs.size === 0) Junctions.delete(mid);
        else if (changed) Junctions.set(mid, node);
    }

    // b) そのwire上の経由点をmasterにしていた下流ワイヤも削除（toIdが "wp_wireId_*"）
    const prefix = `wp_${wireId}_`;
    document.querySelectorAll('#wireLayer .wire').forEach(w => {
        if (w.dataset.toId && w.dataset.toId.startsWith(prefix)) {
            const id = w.dataset.wireId;
            if (id) document.querySelectorAll(`#wireLayer .wire[data-wire-id="${id}"], #wireLayer .wire-hit[data-wire-id="${id}"]`).forEach(n => n.remove());
        }
    });
    if (window.WaypointHandles) WaypointHandles.clear();
    regenerateTikz?.();
}

export function removeElement(element) {
    const termIds = Array.from(element.querySelectorAll(".terminal")).map(t => t.id);
    document.querySelectorAll("#wireLayer .wire").forEach(poly => {
        if (termIds.includes(poly.dataset.fromId) || termIds.includes(poly.dataset.toId)) { removeWire(poly.dataset.wireId); }
    });
    element.remove();
    regenerateTikz?.();
}

// ---- ハンドルの公開API ----
const WaypointHandles = {
    forWire(poly) { showWaypointsForPolyline(poly, { isPreview: false }); },
    clear() { clearWaypointHandles(); },
    isDragging() { return !!dragging; },
    currentWire() { return currentWire; },
};
window.WaypointHandles = WaypointHandles;

// プレビューと全表示
function showAllWaypoints() {
    const wires = document.querySelectorAll("svg#wireLayer .wire");
    wires.forEach(poly => showWaypointsForPolyline(poly, { isPreview: false, append: true }));
}
window.showAllWaypoints = showAllWaypoints;

const WaypointPreview = {
    sync() {
        const prev = document.getElementById('preview');
        if (!prev) { clearWaypointHandles(); return; }
        showWaypointsForPolyline(prev, { isPreview: true, append: true });
    }
};
window.WaypointPreview = WaypointPreview;

// ---- 配線キャンバスのイベント ----
(function setupWiringCanvasEvents() {
    const canvas = document.getElementById("canvas");
    canvas.addEventListener("pointerdown", (e) => {
        if (!wiring.active) return;
        if (e.target.classList.contains("terminal")) return;
        addWaypoint(toCanvasPoint(e));
    });
    canvas.addEventListener("pointermove", (e) => { if (!wiring.active) return; updatePreview(toCanvasPoint(e)); });
    window.addEventListener("keydown", (e) => {
        const el = document.activeElement;
        const isEditing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
        if (isEditing) return;
        if (e.key === "Escape") cancelWiring();
        if (e.key === "Delete" || e.key === "Backspace") {
            const sel = document.querySelector(".selected");
            if (sel) { e.preventDefault(); removeElement(sel); return; }
            const poly = window.WaypointHandles?.currentWire?.();
            if (poly && poly.dataset.wireId) { e.preventDefault(); removeWire(poly.dataset.wireId); return; }
        }
        if (e.key.toLowerCase() === 'r') rotateSelected();
    });
})();
