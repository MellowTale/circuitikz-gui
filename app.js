let resistorCount = 0;

//抵抗の追加
function addResistor(){
    const canvas = document.getElementById("canvas");
    const resistor = document.createElement("div");
    resistor.className = "resistor";
    //resistor.innerText = "R";
    resistor.id = "resistor" + resistorCount;
    resistor.style.left = "10px";
    resistor.style.top = (30 * resistorCount) + "px";
    resistor.draggable = true;

    resistor.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", resistor.id);
    });

    canvas.appendChild(resistor);

    //左右の接続点を作成
    const leftTerminal = document.createElement("div");
    leftTerminal.className = "terminal";
    leftTerminal.dataset.owner = resistor.id;
    leftTerminal.dataset.side = "left";
    leftTerminal.addEventListener("click", handleTerminalClick);
    resistor.appendChild(leftTerminal);
    const rightTerminal = document.createElement("div");
    rightTerminal.className = "terminal";
    rightTerminal.dataset.owner = resistor.id;
    rightTerminal.dataset.side = "right";
    rightTerminal.addEventListener("click", handleTerminalClick);
    resistor.appendChild(rightTerminal);

    resistorCount++;

    const tikzCode = `\\draw (0,${resistorCount}) to[R] (2,${resistorCount});`;
    const output = document.getElementById("output");
    output.value += tikzCode + "\n";

    makeDraggable(resistor);
}

let selectedTerminal = null;

function handleTerminalClick(e){
    const terminal = e.target;

    if (!selectedTerminal){
        selectedTerminal = terminal;
        terminal.style.backgroundColor = "blue";
    } else {
        const from = selectedTerminal;
        const to = terminal;

        drawLineTerminals(from, to);

        const output = document.getElementById("output");
        const tikzCode = `\\draw (${from.dataset.owner}.${from.dataset.side}) -- (${to.dataset.owner}.${to.dataset.side});`;
        output.value += tikzCode + "\n";

        selectedTerminal.style.backgroundColor = "red";
        selectedTerminal = null;
    }
}

function drawLineTerminals(from, to){
    const canvas = document.getElementById("canvas");
    const line = document.createElement("div");
    line.className = "connection-line";

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
}

function makeDraggable(element) {
    let offsetX, offsetY;
    let isDragging = false;

    element.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (isDragging){
            const canvas = document.getElementById("canvas");
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - offsetX;
            const y = e.clientY - canvasRect.top - offsetY;
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        }
    });

    document.addEventListener("mouseup", () =>{
        isDragging = false;
        document.body.style.userSelect = "auto";
    });
}