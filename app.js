document.getElementById("canvas").addEventListener("click", (e) => {
    if(wiring.active) return;
    if(e.target.id === "canvas" || e.target.id === "wireLayer" || e.target.id === "zero"){
        clearSelection();
    }
});

document.querySelectorAll('.tool').forEach(btn=>{
    btn.addEventListener('click', ()=>{
        document.querySelectorAll('.tool').forEach(b=>b.classList.remove('is-active'));
        btn.classList.add('is-active');
    });
});

//#canvas要素のワールド座標を取得
function getCanvasRect(){
    return document.getElementById("canvas").getBoundingClientRect();
}

//グリッドのサイズ・Tikz上の原点の設定
const GRID = 20;
const ORIGIN_PX = {
    x: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--origin-x")) || 120, 
    y: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--origin-y")) || 30
};

//ブラウザ上の座標をTikzに変換
function getCoordinate(r){
    return {
        x: r.x - ORIGIN_PX.x,
        y: r.y - ORIGIN_PX.y
    };
}

function getHandleRadiusPx(){
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--termRadius")) || 5;
}

function getTerminalCenterPx(termEl){
    const owner = document.getElementById(termEl.dataset.owner);
    const side = termEl.dataset.side; //left | right | top | bottom

    const termStyle = getComputedStyle(termEl);
    const termRadius = getHandleRadiusPx();
    const canvasRect = getCanvasRect();
    const ownerRect = owner.getBoundingClientRect();

    const base = {
        x: ownerRect.left - canvasRect.left,
        y: ownerRect.top - canvasRect.top
    };

    if(side === "left"){
        return {
        x: base.x + parseFloat(termStyle.left) + termRadius,
        y: base.y + ownerRect.height / 2
        };
    }
    if(side === "right"){
        return {
        x: base.x + ownerRect.width - parseFloat(termStyle.right) - termRadius,
        y: base.y + ownerRect.height / 2
        };
    }
    if(side === "top"){
        return {
        x: base.x + ownerRect.width / 2,
        y: base.y + parseFloat(termStyle.top) + termRadius
        };
    }
    // bottom
    return {
        x: base.x + ownerRect.width / 2,
        y: base.y + ownerRect.height - parseFloat(termStyle.bottom) - termRadius
    };
}

function halfPxToGrid(r){
    return {
        x: Math.round(r.x * 2 / GRID) / 4,
        y: - Math.round(r.y * 2 / GRID) / 4
    };
}

function snapPointToGridS(pt){
    return {
        x: Math.round(pt.x * 2 / GRID) * GRID / 2,
        y: Math.round(pt.y * 2 / GRID) * GRID / 2,
    };
}

function snapPointToGridL(pt){
    return {
        x: Math.round(pt.x  / GRID) * GRID,
        y: Math.round(pt.y  / GRID) * GRID
    };
}

function clampPointToCanvas(elsize, pt, margin={l:0,r:0,t:0,b:0}){
    const canvas = document.getElementById("canvas");

    const maxR = {
        x: canvas.clientWidth - margin.r - 1,
        y: canvas.clientHeight - margin.b - 1
    };

    return {
        x: Math.max(margin.l, Math.min(pt.x, maxR.x)),
        y: Math.max(margin.t, Math.min(pt.y, maxR.y))
    };
}
function normalizeCanvasPoint(elsize, pt, margin = {l:0,r:0,t:0,b:0}, gridSize = "L"){
    const clamped = clampPointToCanvas(elsize, pt, margin);
    if(gridSize == "S"){
        return snapPointToGridS(clamped);
    } else if(gridSize == "L"){
        return snapPointToGridL(clamped);
    }

}

let elementCount = 0;
let placing = { active:false, el:null, kind:null };

//配置する要素を判別・placingに格納
function startPlacing(kind){
  if(wiring.active) cancelWiring();
  if(placing.active) cancelPlacing();

  let el = null;
  if(kind === 'ground-img'){
    el = addGround();
  }else if(kind === 'resistor'){
    el = add2PinElement('resistor');
  }else if(kind === 'vsource'){
    el = add2PinElement('vsource');
  }
  if(!el) return;
    // elRect = el.getBoundingClientRect();
    // console.log(elRect.width);
  // プレビュー化
  el.classList.add('component-preview');
  placing = { active:true, el, kind };

  document.getElementById("canvas").classList.add("placing-active");
}

function finalizePlacing(e){
  if(!placing.active) return;
  placeElementUnderCursor(placing.el, e);            // 最終位置に合わせる
  placing.el.classList.remove('component-preview');  // プレビュー解除
  placing.el.style.pointerEvents = '';               // イベント復活
  makeDraggable(placing.el);                         // 通常ドラッグ化
  regenerateTikz?.();
  document.getElementById('canvas').classList.remove('placing-active');
  document.querySelectorAll('.tool').forEach(b=>b.classList.remove('is-active'));
  placing = { active:false, el:null, kind:null };
}

function cancelPlacing(){
  if(!placing.active) return;
  placing.el?.remove();                              // 生成済みプレビューを破棄
  document.getElementById('canvas').classList.remove('placing-active');
  placing = { active:false, el:null, kind:null };
}

// ---- 配置モードのイベント（キャンバス優先）----
(function setupPlacingEvents(){
  const canvas = document.getElementById('canvas');

  // 配置中はカーソル追従
  canvas.addEventListener('pointermove', (e)=>{
    if(!placing.active) return;
    placeElementUnderCursor(placing.el, e);
  }, {passive:true});

  // 左クリックで配置確定
  canvas.addEventListener('pointerdown', (e)=>{
    if(!placing.active) return;
    if(e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    finalizePlacing(e);
  });

  // Esc で配置キャンセル（入力中は無視）
  window.addEventListener('keydown', (e)=>{
    const el = document.activeElement;
    const isEditing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if(isEditing) return;
    if(e.key === 'Escape') cancelPlacing();
  });
})();

function createComponent({className, pinSides = [], innerHTML = "", idPrefix, extraMargin = {l:0,r:0,t:0,b:0}}){
    const canvas = document.getElementById("canvas");
    const el = document.createElement("div");
    el.className = className;
    el.id = (idPrefix || className) + (elementCount++);
    el.innerHTML = innerHTML;

    // 選択
    el.addEventListener("pointerdown", onElementClick);

    // 端子を追加
    pinSides.forEach(side => {
        const t = document.createElement("div");
        t.className = "terminal";
        t.id = `${el.id}-${side}`;
        t.dataset.owner = el.id;
        t.dataset.side  = side;
        t.addEventListener("pointerdown", handleTerminalClick);
        el.appendChild(t);
    });

    canvas.appendChild(el);

    // マージン（要素全体を内側に収めるための半幅/半高）
    el.margin = {
        l: el.offsetWidth / 2 + extraMargin.l,
        r: el.offsetWidth / 2 + extraMargin.r,
        t: el.offsetHeight / 2 + extraMargin.t,
        b: el.offsetHeight / 2 + extraMargin.b
    };

    regenerateTikz?.();
    return el;
}

function placeElementUnderCursor(el, e){
    const pt = toCanvasPoint(e);
    const elsize = { w: el.offsetWidth, h: el.offsetHeight };
    const margin = el.margin || {l:0,r:0,t:0,b:0};

    const raw = { x: pt.x, y: pt.y };
    const p = normalizeCanvasPoint({w:elsize.w, h:elsize.h}, raw, margin, "S");
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
}

function add2PinElement(className, imgPath){
    const extra = className === 'resistor' ? {l:20,r:20,t:0,b:0} : {l:0,r:0,t:0,b:0};
    return createComponent({
        className,
        pinSides: ["left","right"],
        extraMargin: extra
    });
}

function addGround(){
    return createComponent({
        className: "ground-img",
        pinSides: ["top"],
        innerHTML: `<img src="gnd.svg" alt="GND">`
    });
}

function rotateElement(el){
    const cur = parseInt(el.dataset.angle, 10) || 0;
    const next = (cur + 90 + 360) % 360;
    el.dataset.angle = String(next);

    el.classList.toggle("o0", next === 0);
    el.classList.toggle("o90", next === 90);
    el.classList.toggle("o180", next === 180);
    el.classList.toggle("o270", next === 270);

    const MAP = { left:'top', top:'right', right:'bottom', bottom:'left' };
    el.querySelectorAll('.terminal').forEach(t => {
        const next = MAP[t.dataset.side];
        if (next) t.dataset.side = next;
    });
    updateConnections();
    regenerateTikz?.();
    // if(el.classList.contains("o90")){
    //     el.classList.add("o180");
    //     el.classList.remove("o90");
    //     console.log("180");
    // } else if(el.classList.contains("o180")){
    //     el.classList.add("o270");
    //     el.classList.remove("o180");
    //     console.log("270");
    // } else if(el.classList.contains("o270")){
    //     el.classList.remove("o270");
    //     console.log("null");
    // } else {
    //     el.classList.add("o90");
    // }

    // el.querySelectorAll('.terminal').forEach(term => {
    //     switch(term.dataset.side){
    //         case "left":
    //             term.dataset.side = "top";
    //             break;
    //         case "top":
    //             term.dataset.side = "right";
    //             break;
    //         case "right":
    //             term.dataset.side = "bottom";
    //             break;
    //         case "bottom":
    //             term.dataset.side = "left";
    //             break;
    //         default: return;
    //     }
    // });
    

    // updateConnections();
    // if (typeof regenerateTikz === 'function') regenerateTikz();
}
// 例: 選択中の抵抗/電源だけ回転（R キー）
function rotateSelected(){
    const el = document.querySelector('.resistor.selected, .vsource.selected, .ground-img.selected');
    if (!el) return;
    rotateElement(el);
}

function clearSelection(){
    document.querySelectorAll(".selected")
        .forEach(el => el.classList.remove("selected"));
    if(window.WaypointHandles) WaypointHandles.clear();
}

function onElementClick(e){
    if(e.target.classList.contains("terminal")) return;
    if(wiring.active) return;
    clearSelection();
    e.currentTarget.classList.add("selected")
}

//端子選択
function handleTerminalClick(e){
    e.stopPropagation();
    const terminal = e.target;
    if(!wiring.active){
        startWiring(terminal);
    } else {
        finishWiring(terminal);
    }
}

function makeDraggable(element) {
    let offset = {x: 0, y: 0};
    let isDragging = false;

    element.addEventListener('pointerdown', onPointerDown);
    // element.addEventListener("dblclick", (e) => {
    //     const sel = document.querySelector(".selected");
    //     if (sel){
    //         e.preventDefault();
    //         removeElement(sel);
    //         return;
    //     }
    // });

    function onPointerDown(e){
        if(e.button !== 0 && e.pointerType === 'mouse') return;
        element.setPointerCapture?.(e.pointerId);
        const elRect = element.getBoundingClientRect();
        isDragging = true;
        offset.x = e.clientX - elRect.left - elRect.width / 2; offset.y = e.clientY - elRect.top - elRect.height / 2;
        document.body.classList.add("no-select");
        document.addEventListener('pointermove', onPointerMove, {passive: true});
        document.addEventListener('pointerup', onPointerUp, {passive: true});
    }

    function onPointerMove(e){
        if(isDragging){
            const canvas = document.getElementById("canvas");
            const canvasRect = canvas.getBoundingClientRect();
            const raw = {
                x: e.clientX - canvasRect.left - offset.x,
                y: e.clientY - canvasRect.top - offset.y
            };
            const elsize = {
                w: element.offsetWidth,
                h: element.offsetHeight
            };
            let margin = {l:0,r:0,t:0,b:0}
            if(element.margin) margin = {
                l:element.margin.l,
                r:element.margin.r,
                t:element.margin.t,
                b:element.margin.b
            };

            let p = normalizeCanvasPoint(elsize, raw, margin, "S");

            element.style.left = `${p.x}px`;
            element.style.top = `${p.y}px`;
            updateConnections();
            scheduleTikz();
        }
    }

    let tikzQueued = false;
    function scheduleTikz(){
        if(tikzQueued) return;
        tikzQueued = true;
        requestAnimationFrame(() => {
            tikzQueued = false;
            regenerateTikz();
        });
    }

    function onPointerUp(e){
        isDragging = false;
        element.releasePointerCapture?.(e.pointerId);
        document.body.classList.remove("no-select");
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        if (typeof regenerateTikz === 'function') regenerateTikz();
    }
}

let wiring = {
    active: false,
    fromTerminal: null, //起点
    tempPoints: [], //{x,y}の配列（キャンバス相対）
    preview: null,
};

//マウス位置の取得
function toCanvasPoint(e){
    const canvasRect = getCanvasRect();
    return {
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top
    };
}

//配線モード開始
function startWiring(fromTerminal){
    fromTerminal.style.backgroundColor = "#59f";
    wiring.active = true;
    wiring.fromTerminal = fromTerminal;
    wiring.tempPoints = [];
    
    document.getElementById("canvas").classList.add("wiring-active");
    if (typeof window.showAllWaypoints === 'function') {
        window.showAllWaypoints();
    }

    const svg = document.getElementById("wireLayer");
    //プレビュー
    wiring.preview = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    wiring.preview.setAttribute("id", "preview");
    wiring.preview.setAttribute("fill", "none");
    wiring.preview.setAttribute("stroke", "black");
    wiring.preview.setAttribute("stroke-width", "2");
    svg.appendChild(wiring.preview);
}

//経由点追加
function addWaypoint(pt){
    const p = snapPointToGridS(pt);
    wiring.tempPoints.push(p);
    updatePreview();
}

//プレビュー更新
function updatePreview(currentPt){
    if (!wiring.preview) return;

    const p0 = snapPointToGridS(getTerminalCenterPx(wiring.fromTerminal));
    const pts = [p0, ...wiring.tempPoints];
    if(currentPt) pts.push(snapPointToGridS(currentPt));

    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(" ");
    wiring.preview.setAttribute("points", pointsStr);

    WaypointPreview.sync();
}

//配線確定
function finishWiring(toPt){
    if (toPt.dataset.owner && (toPt.dataset.owner === wiring.fromTerminal.dataset.owner)) return cancelWiring();
    if (wiring.fromTerminal)
        wiring.fromTerminal.style.backgroundColor = "red";
    const svg = document.getElementById("wireLayer");

    const wireId = "w" + Date.now() + Math.random().toString(36).slice(2,6);

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "black");
    poly.setAttribute("stroke-width", "2");
    poly.classList.add("wire");
    poly.dataset.wireId = wireId;

    // 当たり判定用（透明で太い）
    const polyHit = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyHit.classList.add("wire-hit");
    polyHit.dataset.wireId = wireId;

    const pStart = snapPointToGridS(getTerminalCenterPx(wiring.fromTerminal));
    const pEnd = toPt.dataset.owner ? snapPointToGridS(getTerminalCenterPx(toPt)): snapPointToGridS({x: parseFloat(toPt.style.left), y: parseFloat(toPt.style.top)});
    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    const pointsStr = allPts.map(p => `${p.x},${p.y}`).join(" ");

    poly.setAttribute("points", pointsStr);
    polyHit.setAttribute("points", pointsStr);

    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = toPt.id;

    svg.appendChild(poly);
    svg.appendChild(polyHit);
    attachWireHoverHandlers(poly, polyHit);

    //プレビュー削除
    if(wiring.preview){
        wiring.preview.remove();
        wiring.preview = null;
    }

    regenerateTikz();

    wiring.active = false;
    wiring.fromTerminal = null;
    wiring.tempPoints = [];

    document.getElementById("canvas").classList.remove("wiring-active");
    if (window.WaypointHandles) WaypointHandles.clear();
}

function cancelWiring(){
    if(wiring.fromTerminal){
        wiring.fromTerminal.style.backgroundColor = "red";
    }
    if(wiring.preview){
        wiring.preview.remove();
        wiring.preview = null;
    }
    wiring.active = false;
    wiring.fromTerminal = null;
    wiring.tempPoints = [];

    document.getElementById("canvas").classList.remove("wiring-active");
    if(window.WaypointHandles) WaypointHandles.clear();
}

function attachWireHoverHandlers(poly, polyHit){
    polyHit.addEventListener('pointerenter', () => {
        if(wiring.active) return; //配線中は無視
        WaypointHandles.forWire(poly);
    });
    polyHit.addEventListener('pointerleave', (e) => {
        if(wiring.active) return;
        if(window.WaypointHandles.isDragging()) return;
        const rt = e.relatedTarget;
        if(rt && rt.closest && rt.closest('#handleLayer')) return;
        WaypointHandles.clear();
    });
    polyHit.addEventListener("dblclick", (e) => {
        const id = poly.dataset.wireId;
        if (id) removeWire(id);
    });
}

function updateConnections(){
    // 端子にバインドされたSVGワイヤを更新
    document.querySelectorAll("svg#wireLayer .wire").forEach(poly => {
        const from = document.getElementById(poly.dataset.fromId);
        const to   = document.getElementById(poly.dataset.toId);
        if (!from || !to) {
            removeWire(poly.dataset.wireId);
            return;
        }

        const pts = poly.getAttribute("points")
                        .split(" ")
                        .filter(s => s.length)
                        .map(s => {
                        const [x,y] = s.split(",").map(Number);
                        return {x,y};
                        });

        if (pts.length < 2) return;

        // 先頭と末尾を端子中心へ更新（中間点はそのまま）
        pts[0] = snapPointToGridS(getTerminalCenterPx(from));
        pts[pts.length-1] = snapPointToGridS(getTerminalCenterPx(to));

        const newStr = pts.map(p => `${p.x},${p.y}`).join(" ");
        poly.setAttribute("points", newStr);
        //当たり判定も更新
        const hit = document.querySelector(`svg#wireLayer .wire-hit[data-wire-id="${poly.dataset.wireId}"]`);
        if (hit) hit.setAttribute("points", newStr);
    });
}

(function(){
    //polyline points ⇒配列 変換
    function polyGetPoints(poly){
        return(poly.getAttribute('points')||'')
            .split(' ')
            .filter(Boolean)
            .map(t => {const [x,y] = t.split(',').map(Number); return{x,y};})
    }
    //polyline pointsを更新
    function polySetPoints(poly, pts){
        const newStr = pts.map(p => `${p.x},${p.y}`).join(' ')
        poly.setAttribute('points', newStr);
        if(poly.classList.contains("wire") && poly.dataset.wireId){
            const hit = document.querySelector(`svg#wireLayer .wire-hit[data-wire-id="${poly.dataset.wireId}"]`);
            if (hit) hit.setAttribute("points", newStr);
        }
    }

    const handleLayer = document.getElementById('handleLayer');
    function clearWaypointHandles(){
        if(handleLayer) handleLayer.innerHTML='';
    }
    function placeHandleAt(h, p){h.style.left = p.x + 'px'; h.style.top = p.y + 'px';}

    let dragging = null;
    let currentWire = null;

    function makeHandleDraggable(h, poly, index, isPreview){
        h.addEventListener('pointerdown', (e) => {
            if(wiring.active) return;
            e.stopPropagation();
            h.classList.add('selected');
            h.setPointerCapture?.(e.pointerId);
            dragging = {handle: h, poly, index, isPreview};
        });
        h.addEventListener("click", (ev) => {
            if(wiring.active){
                ev.stopPropagation();
                finishWiring(h);
            }
        });
    }

    function showWaypointsForPolyline(poly, opts = {isPreview: false, append: false}){
        if(!handleLayer || !poly) return;
        if(!opts.append) clearWaypointHandles();
        currentWire = opts.isPreview ? null: poly;
        const pts = polyGetPoints(poly);
        if(pts.length < 3) return;
        for(let i=1; i < pts.length-1; i++){
            const h = document.createElement("div");
            h.className = "handle-waypoint";
            h.dataset.index = String(i);
            h.dataset.preview = opts.isPreview ? "1":"0";
            placeHandleAt(h, pts[i]);
            if(!opts.isPreview && poly.dataset.wireId){
                const wpId = `wp_${poly.dataset.wireId}_${i}`;
                h.id = wpId;
                h.dataset.wireId = poly.dataset.wireId;
                h.dataset.waypointId = wpId;
            }
            makeHandleDraggable(h, poly, i, opts.isPreview);
            handleLayer.appendChild(h);
        }
    }

    document.addEventListener('pointermove', (e) => {
        if(!dragging) return;

        const margin = {l:0,r:0,t:0,b:0};
        const p = normalizeCanvasPoint({w:0,h:0}, toCanvasPoint(e), margin, "S");
        placeHandleAt(dragging.handle, p);

        const pts = polyGetPoints(dragging.poly);
        const idx = Math.max(1, Math.min(pts.length-2, dragging.index));
        pts[idx] = p;
        polySetPoints(dragging.poly, pts);

        if(!dragging.isPreview){
            if(typeof regenerateTikz === 'function') regenerateTikz();
        }
    });
    document.addEventListener('pointerup', (e) => {
        if(!dragging) return;
        dragging.handle.releasePointerCapture?.(e.pointerId);
        dragging.handle.classList.remove('selected');
        dragging = null;
    });

    const WaypointHandles = {
        forWire(poly){ showWaypointsForPolyline(poly, {isPreview:false}); },
        clear(){ clearWaypointHandles(); },
        isDragging(){ return !!dragging; },
        currentWire(){ return currentWire; },
    };
    window.WaypointHandles = WaypointHandles;

    function showAllWaypoints(){
        const wires = document.querySelectorAll("svg#wireLayer .wire");
        wires.forEach((poly) => {
            showWaypointsForPolyline(poly, {isPreview:false, append:true});
        });
    }
    window.showAllWaypoints = showAllWaypoints;

    const WaypointPreview = {
        sync(){
            // if(!window.wiring || !wiring.active){clearWaypointHandles(); return;}
            const prev = document.getElementById('preview');
            if(!prev){clearWaypointHandles(); return;}
            showWaypointsForPolyline(prev, {isPreview:true, append:true});
        }
    };
    window.WaypointPreview = WaypointPreview;

})();


function regenerateTikz(){
    const out = [];

    if (true){
        out.push(`\\begin{figure}[h]\n\\centering\n\\begin{circuitikz}[american]`);
    }    

    // 1) 抵抗
    document.querySelectorAll(".resistor").forEach((el) => {
        const left = el.querySelector('.terminal[data-side="left"]');
        const right = el.querySelector('.terminal[data-side="right"]');
        const top = el.querySelector('.terminal[data-side="top"]');
        const bottom = el.querySelector('.terminal[data-side="bottom"]');
        let p1 = 0; let p2 = 0;
        if(left && right){
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(left)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(right)));
        } else if (top && bottom){
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(top)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(bottom)));
        } else return;
        if(el.classList.contains("o180") || el.classList.contains("o270")){
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
        if(left && right){
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(left)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(right)));
        } else if (top && bottom){
            p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(top)));
            p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(bottom)));
        } else return;
        if(el.classList.contains("o180") || el.classList.contains("o270")){
            out.push(`\\draw (${p2.x},${p2.y}) to[battery1] (${p1.x},${p1.y});`);
        } else {
            out.push(`\\draw (${p1.x},${p1.y}) to[battery1] (${p2.x},${p2.y});`);
        }
    });

    // 3) GND
    document.querySelectorAll(".ground-img").forEach((g) => {
        const term = g.querySelector('.terminal');
        if(!term) return;
        const p = halfPxToGrid(getCoordinate(getTerminalCenterPx(term)));
        let angle = ""
        if(g.classList.contains("o90")) {angle = ", rotate=270";}
        else if(g.classList.contains("o180")) {angle = ", rotate=180"}
        else if(g.classList.contains("o270")) {angle = ", rotate=90"}
        else {angle = ""}
        out.push(`\\draw (${p.x},${p.y}) node[ground${angle}] {};`);
    });

    // 4) 導線
    document.querySelectorAll("svg#wireLayer .wire").forEach(poly => {
    const pts = poly.getAttribute("points")
                    .split(" ")
                    .filter(s => s.length)
                    .map(s => {
                        const [x,y] = s.split(",").map(Number);
                        return {x, y};
                    });

    if (pts.length < 2) return;

    const seq = pts.map(p => {
        const g = halfPxToGrid(getCoordinate(p));
        return `(${g.x},${g.y})`;
    }).join(" -- ");

    out.push(`\\draw ${seq};`);
    });

    if (true){
        out.push(`\\end{circuitikz}\n\\end{figure}`);
    }    

    document.getElementById("output").value = out.join("\n");
}

function removeWire(wireId){
    document.querySelectorAll(`#wireLayer .wire[data-wire-id="${wireId}"], #wireLayer .wire-hit[data-wire-id="${wireId}"]`).forEach(n => n.remove());
    if (window.WaypointHandles) WaypointHandles.clear();
    if(typeof regenerateTikz === 'function') regenerateTikz();
}

function removeElement(element){
    const termIds = Array.from(element.querySelectorAll(".terminal")).map(t => t.id);
    document.querySelectorAll("#wireLayer .wire").forEach(poly => {
        if (termIds.includes(poly.dataset.fromId) || termIds.includes(poly.dataset.toId)){
            removeWire(poly.dataset.wireId)
        }
    });
    element.remove();
    if(typeof regenerateTikz === 'function') regenerateTikz();
}

(function setupWiringCanvasEvents(){
    const canvas = document.getElementById("canvas");

    // 経由点を置く（端子以外をクリックしたら）
    canvas.addEventListener("pointerdown", (e) => {
        if (!wiring.active) return;
        // 端子は除外
        if (e.target.classList.contains("terminal")) return;
        addWaypoint(toCanvasPoint(e));
    });

    // マウス移動でプレビュー更新
    canvas.addEventListener("pointermove", (e) => {
        if (!wiring.active) return;
        updatePreview(toCanvasPoint(e));
    });

    // キーボード操作
    window.addEventListener("keydown", (e) => {
        const el = document.activeElement;
        const isEditing = el && (
            el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
        );
        if (isEditing) return;

        if (e.key === "Escape") cancelWiring();
        if (e.key === "Delete" || e.key === "Backspace"){
            const sel = document.querySelector(".selected");
            if (sel){
                e.preventDefault();
                removeElement(sel);
                return;
            }
            const poly = window.WaypointHandles?.currentWire?.();
            if (poly && poly.dataset.wireId){
                e.preventDefault()
                removeWire(poly.dataset.wireId);
                return;
            }
        }
        if (e.key.toLowerCase() === 'r') rotateSelected();
        return;
    });
})();