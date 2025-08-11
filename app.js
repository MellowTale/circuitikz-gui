//#canvas要素のワールド座標を取得
function getCanvasRect(){
    return document.getElementById("canvas").getBoundingClientRect();
}

function getCenterPx(el, canvasRect){
    const r = el.getBoundingClientRect();
    return {
        x: r.left + r.width  / 2 - canvasRect.left - canvasRect.width / 5,
        y: r.top  + r.height / 2 - canvasRect.top - canvasRect.height / 5
    };
}

const GRID = 20;
function pxToGrid(v){
    return Math.round(v / GRID) / 2;
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
    resistor.draggable = true;

    resistor.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", resistor.id);
    });

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

    const tikzCode = `\\draw (0,${resistorCount}) to[R] (2,${resistorCount});`;
    const output = document.getElementById("output");
    output.value += tikzCode + "\n";

    makeDraggable(resistor);
    regenerateTikz();
}

let selectedTerminal = null;

//端子選択
function handleTerminalClick(e){
    const terminal = e.target;

    if(!wiring.active){
        startWiring(terminal);
        terminal.style.backgroundColor = "blue";
    } else {
        finishWireing(terminal);
        if(wiring.fromTerminal) wiring.fromTerminal.style.backgroundColor = "red"; 
    }
    // if (!selectedTerminal){
    //     selectedTerminal = terminal;
    //     terminal.style.backgroundColor = "blue";
    // } else {
    //     const from = selectedTerminal;
    //     const to = terminal;

    //     drawLineTerminals(from, to);

    //     const output = document.getElementById("output");

    //     selectedTerminal.style.backgroundColor = "red";
    //     selectedTerminal = null;
    // }
}

//導線を描画
function drawLineTerminals(from, to){
    const canvas = document.getElementById("canvas");
    const line = document.createElement("div");
    line.className = "connection-line";
    line.dataset.fromId = from.id;
    line.dataset.toId = to.id;

    const rect1 = from.getBoundingClientRect();
    const rect2 = to.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const x1 = rect1.left + rect1.width / 2 - canvasRect.left;
    const y1 = rect1.top + rect1.height / 2 - canvasRect.top;
    const x2 = rect2.left + rect2.width / 2 - canvasRect.left;
    const y2 = rect2.top + rect2.height / 2 - canvasRect.top;
    
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    line.style.width = length + "px";
    line.style.transform = `rotate(${angle}deg)`;
    line.style.left = (x1 - 1) + "px";
    line.style.top = (y1 - 2) + "px";

    canvas.appendChild(line);
    regenerateTikz();
}

function makeDraggable(element) {
    let offsetX, offsetY;
    let isDragging = false;

    element.ondragstart = () => false;

    element.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            const canvas = document.getElementById("canvas");
            const canvasRect = canvas.getBoundingClientRect();
            let x = e.clientX - canvasRect.left - offsetX;
            let y = e.clientY - canvasRect.top - offsetY;
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
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "auto";
    });
}

let wiring = {
    active: false,
    fromTerminal: null, //起点
    tempPoints: [], //{x,y}の配列（キャンバス相対）
    preview: null,
};

function snapPointToGrid(pt){
    return {
        x: Math.round(pt.x / GRID) * GRID,
        y: Math.round(pt.y / GRID) * GRID,
    };
}

function toCanvasPoint(e){
    const rect = getCanvasRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top};
}

//配線モード開始
function startWiring(fromTerminal){
    wiring.active = true;
    wiring.fromTerminal = fromTerminal;
    wiring.tempPoints = [];

    const svg = document.getElementById("wireLayer");
    //プレビュー
    wiring.preview = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
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
    const rect = getCanvasRect();

    const p0 = getCenterPx(wiring.fromTerminal, rect);
    const pts = [p0, ...wiring.tempPoints];
    if(currentPt) pts.push(snapPointToGrid(currentPT));

    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(" ");
    wiring.preview.setAttribute("points", pointsStr);
}

//配線確定
function finishWiring(toTerminal){
    const rect = getCanvasRect();
    const svg = document.getElementById("wireLayer");

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "black");
    poly.setAttribute("stroke-width", "2");

    const pStart = getCenterPx(wiring.fromTerminal, rect);
    const pEnd = getCenterPx(toTerminal, rect);

    const allPts = [pStart, ...wiring.tempPoints, pEnd];
    poly.setAttribute("points", allPts.map(p => `${p.x},${p.y}`).join(" "));

    poly.dataset.fromId = wiring.fromTerminal.id;
    poly.dataset.toId = toTerminal.id;
    poly.classList.add("wire");

    svg.appendChild(poly);

    //プレビュー削除
    if(wiring.preview){
        wiring.preview.remove();
        wiring.preview = null;
    }

    regenerateTikz();

    wiring.active = false;wiring.fromTerminal = null;
    wiring.fromTerminal = null;
    wiring.tempPoints = [];
}

function cancelWiring(){
    if(wiring.preview){
        wiring.preview.remove();
        wiring.preview = null;
    }
    wiring.active = false;
    wiring.fromTerminal = null;
    wiring.tempPoints = [];
}

function updateConnections(){
    function updateConnections(){
    const rect = getCanvasRect();
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
        pts[0] = getCenterPx(from, rect);
        pts[pts.length-1] = getCenterPx(to, rect);

        poly.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
    });
    /*
    const lines = document.querySelectorAll(".connection-line");
    const canvas = document.getElementById("canvas");
    const canvasRect = canvas.getBoundingClientRect();

    lines.forEach(line => {
        const from = document.getElementById(line.dataset.fromId);
        const to = document.getElementById(line.dataset.toId);

        if (!from || !to) return;

        const rect1 = from.getBoundingClientRect();
        const rect2 = to.getBoundingClientRect();

        const x1 = rect1.left + rect1.width / 2 - canvasRect.left;
        const y1 = rect1.top + rect1.height / 2 - canvasRect.top;
        const x2 = rect2.left + rect2.width / 2 - canvasRect.left;
        const y2 = rect2.top + rect2.height / 2 - canvasRect.top;

        const length = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}deg)`;
        line.style.left = `${x1 - 1}px`;
        line.style.top = `${y1 - 2}px`;
    })
    */
}

function regenerateTikz(){
    const canvasRect = getCanvasRect();
    const out = [];

    // 1) 抵抗
    document.querySelectorAll(".resistor").forEach((res) => {
        const left = res.querySelector('.terminal[data-side="left"]');
        const right = res.querySelector('.terminal[data-side="right"]');
        if(!left || !right) return;

        const p1 = getCenterPx(left,  canvasRect);
        const p2 = getCenterPx(right, canvasRect);
        const x1 = pxToGrid(p1.x), y1 = pxToGrid(p1.y);
        const x2 = pxToGrid(p2.x), y2 = pxToGrid(p2.y);

        out.push(`\\draw (${x1},${y1}) to[european resistor] (${x2},${y2});`);
    });

    // 2) 導線
    document.querySelectorAll(".connection-line").forEach((line) => {
        const from = document.getElementById(line.dataset.fromId);
        const to   = document.getElementById(line.dataset.toId);
        if (!from || !to) return;

        const p1 = getCenterPx(from, canvasRect);
        const p2 = getCenterPx(to,   canvasRect);
        const x1 = pxToGrid(p1.x), y1 = pxToGrid(p1.y);
        const x2 = pxToGrid(p2.x), y2 = pxToGrid(p2.y);

        out.push(`\\draw (${x1},${y1}) -- (${x2},${y2});`);
    })

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