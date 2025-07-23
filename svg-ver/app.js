let resistorId = 0;

function addResistor() {
  const svg = document.getElementById("svg");

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-id", `r${resistorId}`);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", 100);
  rect.setAttribute("y", 100);
  rect.setAttribute("width", 60);
  rect.setAttribute("height", 30);
  rect.setAttribute("class", "resistor-body");

  const leadLeft = document.createElementNS("http://www.w3.org/2000/svg", "line");
  leadLeft.setAttribute("class", "resistor-line");

  const leadRight = document.createElementNS("http://www.w3.org/2000/svg", "line");
  leadRight.setAttribute("class", "resistor-line");

  group.appendChild(leadLeft);
  group.appendChild(leadRight);
  group.appendChild(rect);
  svg.appendChild(group);

  enableDrag(group, rect, leadLeft, leadRight);

  resistorId++;
}

function enableDrag(group, rect, leadLeft, leadRight) {
  let offsetX, offsetY;
  let isDragging = false;

  rect.addEventListener("mousedown", (e) => {
    isDragging = true;
    const x = parseFloat(rect.getAttribute("x"));
    const y = parseFloat(rect.getAttribute("y"));
    offsetX = e.clientX - x;
    offsetY = e.clientY - y;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const svgRect = document.getElementById("svg").getBoundingClientRect();
    const x = e.clientX - svgRect.left - offsetX;
    const y = e.clientY - svgRect.top - offsetY;
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);

    leadLeft.setAttribute("x1", x - 10);
    leadLeft.setAttribute("y1", y + 15);
    leadLeft.setAttribute("x2", x);
    leadLeft.setAttribute("y2", y + 15);

    leadRight.setAttribute("x1", x + 60);
    leadRight.setAttribute("y1", y + 15);
    leadRight.setAttribute("x2", x + 70);
    leadRight.setAttribute("y2", y + 15);
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}
