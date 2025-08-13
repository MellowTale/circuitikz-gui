document.getElementById("canvas").addEventListener("click", (e) => {
    if(wiring.active) return;
    if(e.target.id === "canvas" || e.target.id === "wireLayer" || e.target.id === "zero"){
        clearSelection();
    }
});

//#canvas要素のワールド座標を取得
function getCanvasRect(){
    return document.getElementById("canvas").getBoundingClientRect();
}

//グリッドのサイズ・Tikz上の原点の設定
const GRID = 20;
const ORIGIN_PX = {x: 120, y: 70};

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
    const side = termEl.dataset.side; //left || right

    const termStyle = getComputedStyle(termEl);
    const termRadius = getHandleRadiusPx();
    const canvasRect = getCanvasRect();
    const ownerRect = owner.getBoundingClientRect();
    const r = {
        x: ownerRect.left - canvasRect.left,
        y: ownerRect.top - canvasRect.top
    };
    return {
        x: r.x 
        +(side === "left"
            ? parseFloat(termStyle.left) + termRadius
            : ownerRect.width - parseFloat(termStyle.right) - termRadius
        ),
        y: r.y + ownerRect.height / 2
    };
}

function halfPxToGrid(r){
    return {
        x: Math.round(r.x / GRID) / 2,
        y: Math.round(r.y / GRID) / 2
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
        x: canvas.clientWidth - margin.r - elsize.w,
        y: canvas.clientHeight - margin.b - elsize.h
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

let resistorCount = 0;

//抵抗の追加
function addResistor(){
    const canvas = document.getElementById("canvas");
    const resistor = document.createElement("div");
    resistor.className = "resistor";
    //resistor.innerText = "R";
    resistor.id = "resistor" + resistorCount;
    resistor.style.left = "20px";
    resistor.style.top = (20 * resistorCount) + "px";
    resistor.addEventListener("pointerdown", onResistorClick);

    canvas.appendChild(resistor);

    resistor.margin = {l: 20, r: 20, t: 0, b: 0};
    
    //左右の接続点を作成
    const leftTerminal = document.createElement("div");
    leftTerminal.className = "terminal";
    leftTerminal.id = resistor.id + "-left";
    leftTerminal.dataset.owner = resistor.id;
    leftTerminal.dataset.side = "left";
    leftTerminal.addEventListener('pointerdown', handleTerminalClick);
    resistor.appendChild(leftTerminal);

    const rightTerminal = document.createElement("div");
    rightTerminal.className = "terminal";
    rightTerminal.id = resistor.id + "-right";
    rightTerminal.dataset.owner = resistor.id;
    rightTerminal.dataset.side = "right";
    rightTerminal.addEventListener("pointerdown", handleTerminalClick);
    resistor.appendChild(rightTerminal);

    resistorCount++;

    makeDraggable(resistor);
    regenerateTikz();
}

function clearSelection(){
    document.querySelectorAll(".resistor.selected")
        .forEach(el => el.classList.remove("selected"));
    if(window.WaypointHandles) WaypointHandles.clear();
}

function onResistorClick(e){
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

    function onPointerDown(e){
        if(e.button !== 0 && e.pointerType === 'mouse') return;
        element.setPointerCapture?.(e.pointerId);
        const elRect = element.getBoundingClientRect();
        isDragging = true;
        offset.x = e.clientX - elRect.left; offset.y = e.clientY - elRect.top;
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
            // const maxX = canvas.clientWidth - element.offsetWidth;
            // const maxY = canvas.clientHeight - element.offsetHeight;

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

            let p = normalizeCanvasPoint(elsize, raw, margin, "L");

            element.style.left = `${p.x}px`;
            element.style.top = `${p.y}px`;
            updateConnections();
            regenerateTikz();
        }
    }
    function onPointerUp(e){
        isDragging = false;
        element.releasePointerCapture?.(e.pointerId);
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
    fromTerminal.style.backgroundColor = "blue";
    wiring.active = true;
    wiring.fromTerminal = fromTerminal;
    wiring.tempPoints = [];
    
    document.getElementById("canvas").classList.add("wiring-active");

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
function finishWiring(toTerminal){
    if (toTerminal.dataset.owner === wiring.fromTerminal.dataset.owner) return cancelWiring();
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
    const pEnd = snapPointToGridS(getTerminalCenterPx(toTerminal));
    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    const pointsStr = allPts.map(p => `${p.x},${p.y}`).join(" ");

    poly.setAttribute("points", pointsStr);
    polyHit.setAttribute("points", pointsStr);

    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = toTerminal.id;

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
}

function attachWireHoverHandlers(poly, polyHit){
    polyHit.addEventListener('pointerenter', () => {
        if(window.wiring && wiring.active) return; //配線中は無視
        WaypointHandles.forWire(poly);
    });
    polyHit.addEventListener('pointerleave', (e) => {
        if(window.wiring && wiring.active) return;
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
    function clearWaypointHandles(){if(handleLayer) handleLayer.innerHTML='';}
    function placeHandleAt(h, p){h.style.left = p.x + 'px'; h.style.top = p.y + 'px';}

    let dragging = null;
    let currentWire = null;

    function makeHandleDraggable(h, poly, index, isPreview){
        h.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            h.classList.add('selected');
            h.setPointerCapture?.(e.pointerId);
            dragging = {handle: h, poly, index, isPreview};
        });
    }

    function showWaypointsForPolyline(poly, opts = {isPreview: false}){
        if(!handleLayer || !poly) return;
        clearWaypointHandles();
        currentWire = opts.isPreview ? null: poly;
        const pts = polyGetPoints(poly);
        if(pts.length < 3) return;
        for(let i=1; i < pts.length-1; i++){
            const h = document.createElement("div");
            h.className = "handle-waypoint";
            h.dataset.index = String(i);
            h.dataset.preview = opts.isPreview ? "1":"0";
            placeHandleAt(h, pts[i]);
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
        currentWire(){ return currentWire; }
    };
    window.WaypointHandles = WaypointHandles;
    // window.WaypointHandles = Object.assign(window.WaypointHandles, {
    //     isDragging:() => !!dragging
    // });

    const WaypointPreview = {
        sync(){
            if(!window.wiring || !wiring.active){clearWaypointHandles(); return;}
            const prev = document.getElementById('preview');
            if(!prev){clearWaypointHandles(); return;}
            showWaypointsForPolyline(prev, {isPreview:true});
        }
    };
    window.WaypointPreview = WaypointPreview;

})();


function regenerateTikz(){
    const out = [];

    // 1) 抵抗
    document.querySelectorAll(".resistor").forEach((res) => {
        const left = res.querySelector('.terminal[data-side="left"]');
        const right = res.querySelector('.terminal[data-side="right"]');
        if(!left || !right) return;

        const p1 = halfPxToGrid(getCoordinate(getTerminalCenterPx(left)));
        const p2 = halfPxToGrid(getCoordinate(getTerminalCenterPx(right)));
    
        out.push(`\\draw (${p1.x},${p1.y}) to[european resistor] (${p2.x},${p2.y});`);
    });

    // 2) 導線
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

    document.getElementById("output").value = out.join("\n");
}

function removeWire(wireId){
    document.querySelectorAll(`#wireLayer .wire[data-wire-id="${wireId}"], #wireLayer .wire-hit[data-wire-id="${wireId}"]`).forEach(n => n.remove());
    if (window.WaypointHandles) WaypointHandles.clear();
    if(typeof regenerateTikz === 'function') regenerateTikz();
}

function removeElement(element){
    const termIds = [`${element.id}-left`, `${element.id}-right`];
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
        return;
    });
})();