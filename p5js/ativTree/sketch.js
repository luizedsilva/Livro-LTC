// Simulador de árvore de ativação e pilha do Quicksort.
// Os estados visuais são capturados em cada evento: árvore + pilha + vetor.
let activationNodes = [];
let executionEvents = [];
let stepIndex = -1;
let originalValues = [];
let finalValues = [];
let nodeMap = new Map();
let canvasWidth = 700;
let canvasHeight = 360;
let showExecutionEvents = true;

function setup() {
  const holder = document.getElementById("treeCanvas");
  canvasWidth = Math.max(500, holder.clientWidth || 700);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("treeCanvas");
  canvas.elt.tabIndex = 0;
  canvas.elt.setAttribute("aria-label", "Árvore de ativação do Quicksort");
  pixelDensity(1);
  textFont("sans-serif");
  noLoop();

  document.getElementById("resetBtn").addEventListener("click", resetSimulation);
  document.getElementById("prevBtn").addEventListener("click", previousStep);
  document.getElementById("nextBtn").addEventListener("click", nextStep);
  document.getElementById("runBtn").addEventListener("click", runAll);
  installEventToggle();
  window.addEventListener("resize", handleResize);
  resetSimulation();
}

function installEventToggle() {
  const eventList = document.getElementById("eventLog");
  if (!eventList) return;

  // Cria o controle automaticamente; não é necessário alterar o HTML.
  let toggle = document.getElementById("toggleEvents");
  if (!toggle) {
    const label = document.createElement("label");
    label.id = "eventToggleLabel";
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "0.45rem";
    label.style.margin = "0.5rem 0";
    label.style.cursor = "pointer";

    toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = "toggleEvents";
    toggle.checked = showExecutionEvents;
    toggle.addEventListener("change", () => {
      showExecutionEvents = toggle.checked;
      eventList.hidden = !showExecutionEvents;
      renderEventLog();
    });

    const text = document.createElement("span");
    text.textContent = "Mostrar eventos da execução";
    label.append(toggle, text);
    eventList.parentElement.insertBefore(label, eventList);
  }
  eventList.hidden = !showExecutionEvents;
}

function focusActivationTree() {
  const holder = document.getElementById("treeCanvas");
  const canvas = holder && holder.querySelector("canvas");
  if (!canvas) return;

  if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
  try {
    canvas.focus({ preventScroll: true });
  } catch (_) {
    canvas.focus();
  }
}

function handleResize() {
  const holder = document.getElementById("treeCanvas");
  canvasWidth = Math.max(500, holder.clientWidth || 700);
  resizeCanvas(canvasWidth, canvasHeight);
  renderVisualState();
}

function resetSimulation() {
  const raw = document.getElementById("arrayInput").value.trim();
  const values = raw.split(",").map(s => Number(s.trim()));
  if (!raw || values.length < 2 || values.some(v => !Number.isFinite(v))) {
    alert("Informe pelo menos dois números válidos, separados por vírgula.");
    return;
  }

  originalValues = values.slice();
  finalValues = values.slice();
  activationNodes = [];
  executionEvents = [];
  nodeMap = new Map();
  stepIndex = -1;
  let nextNodeId = 0;

  function record(type, message, nodeId, extra = {}) {
    executionEvents.push({
      type, message, nodeId,
      values: finalValues.slice(),
      ...extra
    });
  }

  function partition(left, right, nodeId) {
    const pivot = finalValues[right];
    let i = left - 1;
    record("partition", `partition(${left}, ${right}): pivô x = ${pivot}.`, nodeId, {pivot});
    for (let j = left; j < right; j++) {
      record("compare", `Compara a[${j}] = ${finalValues[j]} com o pivô ${pivot}.`, nodeId, {j, pivot});
      if (finalValues[j] <= pivot) {
        i++;
        const oldI = finalValues[i], oldJ = finalValues[j];
        [finalValues[i], finalValues[j]] = [finalValues[j], finalValues[i]];
        record("swap", `Troca a[${i}] = ${oldJ} com a[${j}] = ${oldI}.`, nodeId, {i, j, pivot});
      }
    }
    [finalValues[i + 1], finalValues[right]] = [finalValues[right], finalValues[i + 1]];
    const pivotPosition = i + 1;
    record("pivot", `Pivô ${pivot} colocado na posição ${pivotPosition}; partition retorna ${pivotPosition}.`,
      nodeId, {pivot, pivotPosition});
    return pivotPosition;
  }

  function qSort(m, n, parentId = null, branch = "raiz") {
    const id = nextNodeId++;
    const depth = parentId === null ? 0 : nodeMap.get(parentId).depth + 1;
    const node = {
      id, m, n, parentId, branch, depth, children: [],
      pivotPosition: null, status: "pendente"
    };
    activationNodes.push(node);
    nodeMap.set(id, node);
    if (parentId !== null) nodeMap.get(parentId).children.push(id);

    record("call", `Chamada qSort(${m}, ${n}): cria e empilha o registro de ativação.`, id);
    node.status = "ativa";
    record("status", `Ativação qSort(${m}, ${n}) está ativa.`, id);

    if (n > m) {
      const pivotPosition = partition(m, n, id);
      node.pivotPosition = pivotPosition;
      record("left-call", `Inicia a chamada recursiva à esquerda: qSort(${m}, ${pivotPosition - 1}).`, id);
      qSort(m, pivotPosition - 1, id, "esquerda");

      record("right-call", `A chamada à esquerda retornou. Inicia qSort(${pivotPosition + 1}, ${n}).`, id);
      qSort(pivotPosition + 1, n, id, "direita");
    } else {
      record("base", `Caso-base de qSort(${m}, ${n}): n ≤ m; nenhuma partição é necessária.`, id);
    }

    node.status = "concluída";
    record("return", `Retorna de qSort(${m}, ${n}) e remove seu registro do topo da pilha.`, id);
  }

  qSort(0, finalValues.length - 1);

  // Cada evento armazena o estado da pilha após a operação descrita.
  const stack = [];
  for (const ev of executionEvents) {
    if (ev.type === "call") stack.push(ev.nodeId);
    ev.stack = stack.slice();
    if (ev.type === "return") stack.pop();
  }

  canvasHeight = Math.max(360, 70 + (Math.max(0, ...activationNodes.map(n => n.depth)) + 1) * 76);
  canvasWidth = Math.max(500, document.getElementById("treeCanvas").clientWidth || 700);
  resizeCanvas(canvasWidth, canvasHeight);

  document.getElementById("prevBtn").disabled = true;
  document.getElementById("nextBtn").disabled = false;
  document.getElementById("stepCount").textContent = `0 / ${executionEvents.length}`;
  document.getElementById("eventText").textContent = "Pressione “Próximo passo” para iniciar.";
  renderArray(originalValues);
  renderStack([], null);
  renderEventLog();
  renderVisualState();
  focusActivationTree();
}

function nextStep() {
  // Avança até o próximo evento de chamada: a rotina executa internamente
  // comparações/trocas da partição e para quando um novo registro é empilhado.
  let nextCall = -1;
  for (let i = stepIndex + 1; i < executionEvents.length; i++) {
    if (executionEvents[i].type === "call") {
      nextCall = i;
      break;
    }
  }

  if (nextCall >= 0) {
    stepIndex = nextCall;
  } else {
    // Depois da última chamada, avança até o fim para mostrar os retornos finais.
    stepIndex = executionEvents.length - 1;
  }
  updateInterface();
}
function previousStep() {
  if (stepIndex >= 0) {
    stepIndex--;
    updateInterface();
  }
}
function runAll() {
  stepIndex = executionEvents.length - 1;
  updateInterface();
}

function updateInterface() {
  document.getElementById("prevBtn").disabled = stepIndex < 0;
  document.getElementById("nextBtn").disabled = stepIndex >= executionEvents.length - 1;
  document.getElementById("stepCount").textContent =
    `${Math.max(0, stepIndex + 1)} / ${executionEvents.length}`;
  const ev = stepIndex < 0 ? null : executionEvents[stepIndex];
  document.getElementById("eventText").textContent = ev ? ev.message : "Antes da primeira chamada.";
  renderArray(ev ? ev.values : originalValues);
  renderStack(ev ? ev.stack : [], ev);
  renderEventLog();
  renderVisualState();
  focusActivationTree();
}

function renderArray(values) {
  const container = document.getElementById("arrayView");
  container.innerHTML = "";
  values.forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "array-cell";
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = index;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = value;
    cell.append(idx, val);
    container.appendChild(cell);
  });
}

function renderStack(stackIds, event) {
  const container = document.getElementById("stackView");
  container.innerHTML = "";
  if (!stackIds.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "A pilha está vazia antes da primeira chamada.";
    container.appendChild(empty);
    return;
  }
  [...stackIds].reverse().forEach((id, index) => {
    const node = nodeMap.get(id);
    const isTop = index === 0;
    const isReturning = isTop && event && event.type === "return" && event.nodeId === id;
    const card = document.createElement("div");
    card.className = "stack-record" + (isTop ? " current" : "");
    const title = document.createElement("div");
    title.className = "record-title";
    const name = document.createElement("span");
    name.textContent = `qSort(${node.m}, ${node.n})`;
    const state = document.createElement("span");
    state.className = "state";
    state.textContent = isReturning ? "retornando" : isTop ? "topo — chamada atual" : "suspensa";
    title.append(name, state);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Registro #${node.id} · parâmetros m=${node.m}, n=${node.n}` +
      (node.pivotPosition !== null ? ` · posição do pivô: ${node.pivotPosition}` : "");
    card.append(title, meta);
    container.appendChild(card);
  });
}

function renderEventLog() {
  const list = document.getElementById("eventLog");
  if (!list) return;

  list.hidden = !showExecutionEvents;
  list.innerHTML = "";
  if (!showExecutionEvents) return;

  executionEvents.forEach((ev, index) => {
    const item = document.createElement("li");
    item.textContent = ev.message;
    if (index === stepIndex) item.classList.add("selected");
    else if (index > stepIndex) item.classList.add("future");
    list.appendChild(item);
  });

  // Não desloca a página para a lista de eventos: o foco permanece na árvore.
}

function renderVisualState() {
  clear();
  background(255);
  if (!activationNodes.length) return;

  const maxDepth = Math.max(...activationNodes.map(n => n.depth));
  const levels = [];
  for (let d = 0; d <= maxDepth; d++) levels.push(activationNodes.filter(n => n.depth === d));
  const widestLevel = Math.max(1, ...levels.map(level => level.length));
  const neededWidth = Math.max(canvasWidth, widestLevel * 112 + 40);
  if (width !== neededWidth) resizeCanvas(neededWidth, canvasHeight);

  const positions = new Map();
  const topMargin = 36, levelGap = 76;
  levels.forEach((level, depth) => {
    const y = topMargin + depth * levelGap;
    level.forEach((node, i) => {
      positions.set(node.id, {x: ((i + 1) * width) / (level.length + 1), y});
    });
  });

  // Mostrar apenas nós que já foram criados até o passo atual.
  const visibleIds = new Set();
  activationNodes.forEach(node => {
    if (stepIndex === -1) return;
    const wasCalled = executionEvents.slice(0, stepIndex + 1)
      .some(ev => ev.type === "call" && ev.nodeId === node.id);
    if (wasCalled) visibleIds.add(node.id);
  });

  stroke(160, 174, 191);
  strokeWeight(1.5);
  activationNodes.forEach(node => {
    if (!visibleIds.has(node.id) || node.parentId === null || !visibleIds.has(node.parentId)) return;
    const a = positions.get(node.parentId), b = positions.get(node.id);
    line(a.x, a.y + 18, b.x, b.y - 18);
  });

  const ev = stepIndex >= 0 ? executionEvents[stepIndex] : null;
  activationNodes.forEach(node => {
    if (!visibleIds.has(node.id)) return;
    const p = positions.get(node.id);
    const inStack = !!(ev && ev.stack.includes(node.id));
    const isCurrent = !!(ev && ev.nodeId === node.id && ev.type !== "return");
    const hasReturned = !!(ev && executionEvents.slice(0, stepIndex + 1)
      .some(e => e.type === "return" && e.nodeId === node.id));
    stroke(isCurrent ? "#c18411" : hasReturned ? "#4b9b69" : "#8b9bad");
    strokeWeight(isCurrent ? 3 : 1.2);
    fill(isCurrent ? "#fff0c2" : hasReturned ? "#dff3e6" : inStack ? "#e7efff" : "#f4f7fb");
    rectMode(CENTER);
    rect(p.x, p.y, 94, 36, 8);
    noStroke();
    fill("#1d2733");
    textAlign(CENTER, CENTER);
    textSize(11);
    text(`q(${node.m},${node.n})`, p.x, p.y - 3);
    fill("#5e6b78");
    textSize(8);
    text(`#${node.id}`, p.x, p.y + 11);
  });
}
function draw() {}
