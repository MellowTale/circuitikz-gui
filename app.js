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

function getTerminalCenterPx(termEl){
    const owner = document.getElementById(termEl.dataset.owner);
    const side = termEl.dataset.side; //left || right

    const termStyle = getComputedStyle(termEl);
    const termRadius = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--termRadius")) || 5;
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

function snapPointToGrid(pt){
    return {
        x: Math.round(pt.x * 2 / GRID) * GRID / 2,
        y: Math.round(pt.y * 2 / GRID) * GRID / 2,
    };
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

    resistor.addEventListener("click", onResistorClick);

    canvas.appendChild(resistor);

    //左右の接続点を作成
    const leftTerminal = document.createElement("div");
    leftTerminal.className = "terminal";
    leftTerminal.id = resistor.id + "-left";
    leftTerminal.dataset.owner = resistor.id;
    leftTerminal.dataset.side = "left";
    leftTerminal.addEventListener("click", handleTerminalClick);
    resistor.appendChild(leftTerminal);

    const rightTerminal = document.createElement("div");
    rightTerminal.className = "terminal";
    rightTerminal.id = resistor.id + "-right";
    rightTerminal.dataset.owner = resistor.id;
    rightTerminal.dataset.side = "right";
    rightTerminal.addEventListener("click", handleTerminalClick);
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
    console.log("detyadame");
    if(wiring.active) return;
    clearSelection();
    e.currentTarget.classList.add("selected")
}

let selectedTerminal = null;
document.querySelectorAll('.terminal').forEach(t=>{
  t.addEventListener('click', e=>{
    console.log('[terminal click]', e.eventPhase, e.target, e.currentTarget);
  }, true);   // ← キャプチャ側でも
  t.addEventListener('click', e=>{
    console.log('[terminal click-bubble]', e.eventPhase, e.target, e.currentTarget);
  });
});
//端子選択
function handleTerminalClick(e){
      e.stopPropagation();  
    const terminal = e.target;
    console.log("clicked");
    if(!wiring.active){
        console.log("start");
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
            let x = e.clientX - canvasRect.left - offset.x;
            let y = e.clientY - canvasRect.top - offset.y;
            const maxX = canvas.clientWidth - element.offsetWidth;
            const maxY = canvas.clientHeight - element.offsetHeight;
            x = Math.max(0, Math.min(x, maxX));
            y = Math.max(0, Math.min(y, maxY));
            x = Math.round(x / GRID) * GRID;
            y = Math.round(y / GRID) * GRID;

            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            updateConnections();
            regenerateTikz();
        }
    }
    function onPointerUp(){
        isDragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        if (typeof regenerateTikz === 'function') regenerateTikz();
    }
    // element.ondragstart = () => false;

    // element.addEventListener("mousedown", (e) => {
    //     isDragging = true;
    //     offsetX = e.clientX - element.getBoundingClientRect().left;
    //     offsetY = e.clientY - element.getBoundingClientRect().top;
    //     document.body.style.userSelect = "none";
    // });

    // document.addEventListener("mousemove", (e) => {
    //     if (isDragging) {
    //         const canvas = document.getElementById("canvas");
    //         const canvasRect = canvas.getBoundingClientRect();
    //         let x = e.clientX - canvasRect.left - offsetX;
    //         let y = e.clientY - canvasRect.top - offsetY;
    //         const maxX = canvas.clientWidth - element.offsetWidth;
    //         const maxY = canvas.clientHeight - element.offsetHeight;
    //         x = Math.max(0, Math.min(x, maxX));
    //         y = Math.max(0, Math.min(y, maxY));
    //         x = Math.round(x / GRID) * GRID;
    //         y = Math.round(y / GRID) * GRID;

    //         element.style.left = `${x}px`;
    //         element.style.top = `${y}px`;
    //         updateConnections();
    //         regenerateTikz();
    //     }
    // });

    // document.addEventListener("mouseup", () => {
    //     isDragging = false;
    //     document.body.style.userSelect = "auto";
    // });
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
    const p = snapPointToGrid(pt);
    wiring.tempPoints.push(p);
    updatePreview();
}

//プレビュー更新
function updatePreview(currentPt){
    if (!wiring.preview) return;

    const p0 = snapPointToGrid(getTerminalCenterPx(wiring.fromTerminal));
    const pts = [p0, ...wiring.tempPoints];
    if(currentPt) pts.push(snapPointToGrid(currentPt));

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

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "black");
    poly.setAttribute("stroke-width", "2");

    const pStart = snapPointToGrid(getTerminalCenterPx(wiring.fromTerminal));
    const pEnd = snapPointToGrid(getTerminalCenterPx(toTerminal));

    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    poly.setAttribute("points", allPts.map(p => `${p.x},${p.y}`).join(" "));

    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = toTerminal.id;
    poly.classList.add("wire");

    svg.appendChild(poly);
    attachWireHoverHandlers(poly);

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

function attachWireHoverHandlers(poly){
    poly.addEventListener('pointerenter', (e) => {
        if(window.wiring && wiring.active) return; //配線中は無視
        WaypointHandles.forWire(e.currentTarget);
    });
    poly.addEventListener('pointerleave', (e) => {
        if(window.wiring && wiring.active) return;
        const rt = e.relatedTarget;
        if(rt && rt.closest && rt.closest('#handleLayer')) return;
        WaypointHandles.clear();
    });
}

function updateConnections(){
    // 1) 端子にバインドされたSVGワイヤを更新
    document.querySelectorAll("svg#wireLayer .wire").forEach(poly => {
        const from = document.getElementById(poly.dataset.fromId);
        const to   = document.getElementById(poly.dataset.toId);
        if (!from || !to) return;

        const pts = poly.getAttribute("points")
                        .split(" ")
                        .filter(s => s.length)
                        .map(s => {
                        const [x,y] = s.split(",").map(Number);
                        return {x,y};
                        });

        if (pts.length < 2) return;

        // 先頭と末尾を端子中心へ更新（中間点はそのまま）
        pts[0] = snapPointToGrid(getTerminalCenterPx(from));
        pts[pts.length-1] = snapPointToGrid(getTerminalCenterPx(to));

        poly.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
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
    function polySetPoints(poly, pts){
        poly.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
    }

    const handleLayer = document.getElementById('handleLayer');
    function clearWaypointHandles(){if(handleLayer) handleLayer.innerHTML='';}
    function placeHandleAt(h, p){h.style.left = p.x + 'px'; h.style.top = p.y + 'px';}

    let dragging = null;

    function showWaypointsForPolyline(poly, opts = {isPreview: false}){
        if(!handleLayer || !poly) return;
        clearWaypointHandles();
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

    function makeHandleDraggable(h, poly, index, isPreview){
        h.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            h.classList.add('selected');
            dragging = {handle: h, poly, index, isPreview};
        });
    }

    document.addEventListener('mousemove', (e) => {
        if(!dragging) return;
        const p = snapPointToGrid(toCanvasPoint(e));

        placeHandleAt(dragging.handle, p);
        const pts = polyGetPoints(dragging.poly);
        const idx = Math.max(1, Math.min(pts.length-2, dragging.index));
        pts[idx] = p;
        polySetPoints(dragging.poly, pts);

        if(!dragging.isPreview){
            if(typeof regenerateTikz === 'function') regenerateTikz();
        }
    });
    document.addEventListener('mouseup', () => {
        if(!dragging) return;
        dragging.handle.classList.remove('selected');
        dragging = null;
    });

    const WaypointHandles = {
        forWire(poly){showWaypointsForPolyline(poly, {isPreview:false});},
        clear(){clearWaypointHandles();}
    };
    window.WaypointHandles = WaypointHandles;
    window.WaypointHandles = Object.assign(window.WaypointHandles, {
        isDragging:() => !!dragging
    });

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

(function setupWiringCanvasEvents(){
    const canvas = document.getElementById("canvas");

    // 経由点を置く（端子以外をクリックしたら）
    canvas.addEventListener("click", (e) => {
        if (!wiring.active) return;
        // 端子は除外
        if (e.target.classList.contains("terminal")) return;

        addWaypoint(toCanvasPoint(e));
    });

    // マウス移動でプレビュー更新
    canvas.addEventListener("mousemove", (e) => {
        if (!wiring.active) return;
        updatePreview(toCanvasPoint(e));
    });

    // Escでキャンセル
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cancelWiring();
    });
})();