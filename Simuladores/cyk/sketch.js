let grammarInput;
let stringInput;
// let startInput;

let runButton;
let stepButton;
let resetButton;

let grammar = [];
let nonTerminals = [];
let startSymbol = "S";

let inputString = "";

let P = [];
let back = [];

let steps = [];
let currentStep = -1;

let resultMessage = "";
let selectedCell = null;

// Árvores de derivação
let derivationTrees = [];
let currentTreeIndex = 0;
let treePrevButton;
let treeNextButton;
let treeInfo = "";
let currentTreeBST = null;
let currentTreeRoot = null;

const cellWidth = 72;
const cellHeight = 52;

function setup() {
  const canvas = createCanvas(900, 500);
  canvas.parent("cyk-canvas-container");

  textFont("Arial");

  grammarInput = document.getElementById("grammar");
  stringInput = document.getElementById("sentence");

  runButton = document.getElementById("run-button");
  stepButton = document.getElementById("step-button");
  resetButton = document.getElementById("reset-button");
  treePrevButton = document.getElementById("tree-prev-button");
  treeNextButton = document.getElementById("tree-next-button");

  noLoop();

  // Expõe as funções explicitamente para os onclick do index.html.
  window.executarCYK = runCYK;
  window.proximoPassoCYK = nextStep;
  window.limparCYK = resetSimulation;
  window.arvoreAnteriorCYK = previousDerivationTree;
  window.proximaArvoreCYK = nextDerivationTree;
}
function runCYK() {
  try {
    parseGrammar();

    inputString = (stringInput.value || "").trim().replace(/\s+/g, "");

    if (inputString.length === 0) {
      resultMessage = "Informe uma cadeia.";
      redraw();
      drawDerivationTreeHTML();
      return;
    }

    if (grammar.length === 0) {
      resultMessage = "Informe uma gramática válida.";
      redraw();
      drawDerivationTreeHTML();
      return;
    }

    if (!nonTerminals.includes(startSymbol)) {
      resultMessage =
        "O símbolo inicial não aparece no lado esquerdo das produções.";
      redraw();
      drawDerivationTreeHTML();
      return;
    }

    initializeCYK();
    generateSteps();

    // Executar = aplicar TODOS os passos.
    for (const step of steps) {
      applyStep(step);
    }

    currentStep = steps.length - 1;

    checkResult();

    if (hasVariable(inputString.length, 1, startSymbol)) {
      enumerateDerivationTrees();
    } else {
      derivationTrees = [];
      currentTreeIndex = 0;
      currentTreeBST = null;
      currentTreeRoot = null;
      treeInfo = "";
    }

    redraw();

    // O canvas da árvore é independente do p5.
    setTimeout(drawDerivationTreeHTML, 0);
  } catch (error) {
    console.error("Erro ao executar CYK:", error);
    resultMessage = "Erro ao executar o algoritmo: " + error.message;
    redraw();
    drawDerivationTreeHTML();
  }
}
function parseGrammar() {
  let firstRule = true;
  grammar = [];
  nonTerminals = [];

  const lines = grammarInput.value.split("\n");

  for (let line of lines) {
    line = line.trim();

    if (line.length === 0) continue;

    line = line.replace(/→/g, "->");

    const parts = line.split("->");

    if (parts.length !== 2) continue;

    const left = parts[0].trim();
    const rightSide = parts[1].trim();
    if (firstRule) {
      startSymbol = left;
      firstRule = false;
    }

    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(left)) continue;

    if (!nonTerminals.includes(left)) {
      nonTerminals.push(left);
    }

    const alternatives = rightSide.split("|");

    for (let alternative of alternatives) {
      alternative = alternative.trim().replace(/\s+/g, "");

      if (alternative.length > 0) {
        grammar.push({
          left: left,
          right: alternative,
        });
      }
    }
  }
}

function initializeCYK() {
  const n = inputString.length;

  P = Array.from({ length: n + 1 }, () =>
    Array.from({ length: n + 1 }, () => Object.create(null)),
  );

  back = Array.from({ length: n + 1 }, () =>
    Array.from({ length: n + 1 }, () => Object.create(null)),
  );

  resultMessage = "";
  selectedCell = null;
}

function generateSteps() {
  steps = [];

  const n = inputString.length;

  // Produções A -> a
  for (let s = 1; s <= n; s++) {
    const terminalSymbol = inputString[s - 1];

    for (const production of grammar) {
      if (production.right === terminalSymbol) {
        steps.push({
          type: "terminal",
          l: 1,
          s: s,
          variable: production.left,
          symbol: terminalSymbol,
        });
      }
    }
  }

  // Produções A -> BC
  for (let l = 2; l <= n; l++) {
    for (let s = 1; s <= n - l + 1; s++) {
      for (let p = 1; p <= l - 1; p++) {
        for (const production of grammar) {
          const pair = parseBinaryRightSide(production.right);

          if (!pair) continue;

          steps.push({
            type: "binary",
            l: l,
            s: s,
            p: p,
            A: production.left,
            B: pair[0],
            C: pair[1],
          });
        }
      }
    }
  }
}

function parseBinaryRightSide(right) {
  // O simulador aceita FNC com não terminais de um caractere,
  // por exemplo A -> BC.
  if (right.length !== 2) return null;

  const B = right[0];
  const C = right[1];

  if (!nonTerminals.includes(B) || !nonTerminals.includes(C)) {
    return null;
  }

  return [B, C];
}

function applyStep(step) {
  if (step.type === "terminal") {
    setVariable(step.l, step.s, step.variable);

    addBackPointer(step.l, step.s, step.variable, {
      type: "terminal",
      symbol: step.symbol,
    });
  }

  if (step.type === "binary") {
    if (
      hasVariable(step.p, step.s, step.B) &&
      hasVariable(step.l - step.p, step.s + step.p, step.C)
    ) {
      setVariable(step.l, step.s, step.A);

      addBackPointer(step.l, step.s, step.A, {
        type: "binary",
        partition: step.p,
        left: step.B,
        right: step.C,
      });
    }
  }
}

function hasVariable(l, s, variable) {
  return P[l] && P[l][s] && P[l][s][variable] === true;
}

function setVariable(l, s, variable) {
  P[l][s][variable] = true;
}

function addBackPointer(l, s, variable, pointer) {
  if (!back[l][s][variable]) {
    back[l][s][variable] = [];
  }

  // Evita duplicação de backpointers idênticos.
  const serialized = JSON.stringify(pointer);

  if (
    !back[l][s][variable].some((item) => JSON.stringify(item) === serialized)
  ) {
    back[l][s][variable].push(pointer);
  }
}

function nextStep() {
  // Inicializa uma nova execução, caso ainda não exista.
  if (steps.length === 0) {
    parseGrammar();

    inputString = stringInput.value.trim().replace(/\s+/g, "");
    // startSymbol = startInput.value().trim();

    if (inputString.length === 0 || grammar.length === 0) {
      resultMessage = "Informe uma gramática e uma cadeia válidas.";
      redraw();
      return;
    }

    initializeCYK();
    generateSteps();
    currentStep = -1;
  }

  if (currentStep >= steps.length - 1) {
    checkResult();
    redraw();
    return;
  }

  currentStep++;
  applyStep(steps[currentStep]);

  if (currentStep === steps.length - 1) {
    checkResult();
    if (hasVariable(inputString.length, 1, startSymbol)) {
      enumerateDerivationTrees();
    }

    setTimeout(drawDerivationTreeHTML, 0);
  } else {
    resultMessage =
      "Execução em andamento: passo " +
      (currentStep + 1) +
      " de " +
      steps.length +
      ".";
  }

  redraw();
}

function checkResult() {
  const n = inputString.length;

  if (hasVariable(n, 1, startSymbol)) {
    resultMessage = "✓ A cadeia pertence à linguagem.";
  } else {
    resultMessage = "✗ A cadeia NÃO pertence à linguagem.";
  }
}

// -----------------------------------------------------------------------------
// Enumeração das árvores de derivação
//
// A tabela CYK guarda, em back[l][s][A], todas as possibilidades de derivação
// de A para o trecho correspondente. A partir dessas alternativas, fazemos
// uma busca recursiva e combinamos todas as possibilidades dos filhos.
//
// Cada árvore resultante é armazenada em uma instância de BinarySearchTree,
// usando a classe de bst.js. Como a estrutura de uma árvore de derivação não
// precisa obedecer à propriedade de ordenação de uma BST, construímos os
// objetos Node diretamente e os colocamos como raiz da BinarySearchTree.
// Assim, a classe BST é utilizada também para posicionamento e desenho.
function enumerateDerivationTrees() {
  derivationTrees = [];
  currentTreeIndex = 0;
  currentTreeBST = null;
  currentTreeRoot = null;
  treeInfo = "";

  if (
    inputString.length === 0 ||
    !hasVariable(inputString.length, 1, startSymbol)
  ) {
    return;
  }

  const trees = buildDerivationTrees(inputString.length, 1, startSymbol);

  // Remove árvores duplicadas que eventualmente possam surgir por
  // alternativas equivalentes na gramática/backpointers.
  const seen = new Set();

  for (const tree of trees) {
    const key = JSON.stringify(tree);
    if (!seen.has(key)) {
      seen.add(key);
      derivationTrees.push(tree);
    }
  }

  if (derivationTrees.length > 0) {
    currentTreeRoot = derivationTrees[0];
    currentTreeBST = null;

    treeInfo =
      "Árvore " + (currentTreeIndex + 1) + " de " + derivationTrees.length;
  }
}

// Retorna todas as árvores possíveis para P[l,s,A].
function buildDerivationTrees(l, s, A) {
  const pointers = (back[l] && back[l][s] && back[l][s][A]) || [];
  const result = [];

  for (const pointer of pointers) {
    if (pointer.type === "terminal") {
      result.push({
        label: A,
        l: l,
        s: s,
        left: null,
        right: {
          label: pointer.symbol,
          left: null,
          right: null,
        },
      });
      continue;
    }

    if (pointer.type === "binary") {
      const leftTrees = buildDerivationTrees(
        pointer.partition,
        s,
        pointer.left,
      );

      const rightTrees = buildDerivationTrees(
        l - pointer.partition,
        s + pointer.partition,
        pointer.right,
      );

      // Produto cartesiano: cada combinação de filho esquerdo e direito
      // representa uma árvore de derivação diferente.
      for (const leftTree of leftTrees) {
        for (const rightTree of rightTrees) {
          result.push({
            label: A,
            l: l,
            s: s,
            left: leftTree,
            right: rightTree,
          });
        }
      }
    }
  }

  return result;
}

function showDerivationTree(index) {
  if (derivationTrees.length === 0) return;

  currentTreeIndex = (index + derivationTrees.length) % derivationTrees.length;

  currentTreeRoot = derivationTrees[currentTreeIndex];
  currentTreeBST = null;

  treeInfo =
    "Árvore " + (currentTreeIndex + 1) + " de " + derivationTrees.length;

  // Como o canvas do CYK está em noLoop(), é necessário redesenhar
  // a tabela sempre que a árvore selecionada mudar.
  // drawCell() consulta currentTreeRoot e, portanto, as variáveis
  // destacadas passam a corresponder à nova árvore.
  redraw();
  drawDerivationTreeHTML();
}
function previousDerivationTree() {
  if (derivationTrees.length === 0) return;
  showDerivationTree(currentTreeIndex - 1);
}

function nextDerivationTree() {
  if (derivationTrees.length === 0) return;
  showDerivationTree(currentTreeIndex + 1);
}

function drawDerivationTreeHTML() {
  const canvas = document.getElementById("tree-canvas");
  const info = document.getElementById("tree-info");

  if (!canvas) return;

  const container = canvas.parentElement;
  const width = Math.max(500, Math.floor(container.clientWidth || 700));
  const height = 500;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = "100%";
  canvas.style.height = height + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (info) {
    info.textContent = treeInfo || "Nenhuma árvore disponível.";
  }

  // A árvore agora é desenhada diretamente a partir do objeto
  // de derivação. Não depende de bst.js.
  if (!currentTreeRoot) return;

  const root = currentTreeRoot;

  function countLeaves(node) {
    if (!node) return 0;
    if (!node.left && !node.right) return 1;
    return countLeaves(node.left) + countLeaves(node.right);
  }

  const leaves = Math.max(1, countLeaves(root));
  const horizontalStep = Math.max(30, Math.min(70, (width - 70) / leaves));

  const top = 35;
  const verticalStep = 55;
  let leafIndex = 0;

  function assign(node, depth) {
    if (!node) return;

    node._x = null;
    node._y = top + depth * verticalStep;

    if (!node.left && !node.right) {
      node._x = 35 + leafIndex * horizontalStep;
      leafIndex++;
      return;
    }

    assign(node.left, depth + 1);
    assign(node.right, depth + 1);

    if (node.left && node.right) {
      node._x = (node.left._x + node.right._x) / 2;
    } else if (node.left) {
      node._x = node.left._x;
    } else {
      node._x = node.right._x;
    }
  }

  assign(root, 0);

  let minX = Infinity;
  let maxX = -Infinity;

  function bounds(node) {
    if (!node) return;
    minX = Math.min(minX, node._x);
    maxX = Math.max(maxX, node._x);
    bounds(node.left);
    bounds(node.right);
  }

  bounds(root);

  const offset = width / 2 - (minX + maxX) / 2;

  function edges(node) {
    if (!node) return;

    const x = node._x + offset;
    const y = node._y;

    if (node.left) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(node.left._x + offset, node.left._y);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (node.right) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(node.right._x + offset, node.right._y);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    edges(node.left);
    edges(node.right);
  }

  function nodes(node) {
    if (!node) return;

    nodes(node.left);
    nodes(node.right);

    const x = node._x + offset;
    const y = node._y;
    const leaf = !node.left && !node.right;

    ctx.beginPath();

    if (leaf) {
      ctx.fillStyle = "#d2f0d2";
      ctx.fillRect(x - 15, y - 15, 30, 30);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 15, y - 15, 30, 30);
    } else {
      if (node.left == null) ctx.fillStyle = "#d2f0d2";
      else ctx.fillStyle = "#d2e6fa";
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = "#000000";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, x, y);
  }

  edges(root);
  nodes(root);
}

function draw() {
  background(245);
  drawCYKTable();
  drawInformation();
  drawDerivationTreeHTML();
}

function drawCYKTable() {
  if (inputString.length === 0 || P.length === 0) return;

  const n = inputString.length;
  const startX = 80;
  const baseY = 420;

  for (let l = 1; l <= n; l++) {
    const y = baseY - (l - 1) * cellHeight;

    for (let s = 1; s <= n - l + 1; s++) {
      const x = startX + (s - 1) * cellWidth + ((l - 1) * cellWidth) / 2;

      drawCell(x, y, l, s);
    }
  }
  noStroke();
  fill(20);
  textAlign(CENTER);
  textSize(12);

  for (let i = 0; i < n; i++) {
    const x = startX + i * cellWidth + cellWidth / 2;

    text(inputString[i], x, baseY + 35);

    textSize(12);
    text(i + 1, x, baseY + 68);
    textSize(14);
  }

  textAlign(RIGHT);
  textSize(14);

  for (let l = 1; l <= n; l++) {
    const y = baseY - (l - 1) * cellHeight;
    text("l = " + l, startX - 15, y + 35);
  }

  textAlign(LEFT);
}

function isVariableInCurrentTree(l, s, variable) {
  if (!currentTreeRoot) return false;

  function search(node) {
    if (!node) return false;

    // Cada nó não-terminal da árvore de derivação foi criado por
    // buildDerivationTrees() com exatamente os campos l, s e label.
    if (
      node.label === variable &&
      Number(node.l) === Number(l) &&
      Number(node.s) === Number(s)
    ) {
      return true;
    }

    return search(node.left) || search(node.right);
  }

  return search(currentTreeRoot);
}
function drawCell(x, y, l, s) {
  const variables = Object.keys(P[l][s]);

  const isSelected =
    selectedCell && selectedCell.l === l && selectedCell.s === s;

  // ------------------------------------------------------------
  // Cor de fundo da célula
  // ------------------------------------------------------------

  if (variables.length === 0) {
    fill(255);
  } else if (l === 1) {
    fill(210, 240, 210);
  } else {
    fill(210, 230, 250);
  }

  // ------------------------------------------------------------
  // Borda da célula
  // ------------------------------------------------------------

  if (l === inputString.length && s === 1 && hasVariable(l, s, startSymbol)) {
    stroke(0, 150, 0);
    strokeWeight(3);
  } else if (isSelected) {
    stroke(255, 140, 0);
    strokeWeight(3);
  } else {
    stroke(100);
    strokeWeight(1);
  }

  rect(x, y, cellWidth, cellHeight);

  // ------------------------------------------------------------
  // Variáveis da célula
  // ------------------------------------------------------------

  textAlign(CENTER, CENTER);
  textSize(14);

  const textY = y + 20;

  if (variables.length > 0) {
    // Calcula a largura total dos elementos:
    //
    // { S, A, B, C }
    //
    let totalWidth = 0;

    for (const variable of variables) {
      totalWidth += textWidth(variable);
    }

    // Espaço entre as variáveis
    const spacing = 5;

    if (variables.length > 1) {
      totalWidth += spacing * (variables.length - 1);
    }

    // Largura das chaves
    const braceWidth = textWidth("{") + 6;

    totalWidth += 2 * braceWidth;

    // Posição inicial
    let currentX = x + cellWidth / 2 - totalWidth / 2;

    // ----------------------------------------------------------
    // Chave esquerda
    // ----------------------------------------------------------

    noStroke();
    fill(20);

    text("{", currentX + braceWidth / 2, textY);

    currentX += braceWidth;

    // ----------------------------------------------------------
    // Variáveis
    // ----------------------------------------------------------

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];

      const variableWidth = textWidth(variable);

      // Verifica se esta variável aparece na árvore atual
      const highlighted = isVariableInCurrentTree(l, s, variable);

      // Vermelho se estiver na árvore
      if (highlighted) {
        stroke(200, 0, 0);
        strokeWeight(1);
        fill(200, 0, 0);
      } else {
        noStroke();
        fill(20);
      }

      text(variable, currentX + variableWidth / 2, textY);
      noStroke();

      currentX += variableWidth;

      // Espaço entre variáveis
      if (i < variables.length - 1) {
        currentX += spacing;
      }
    }

    // ----------------------------------------------------------
    // Chave direita
    // ----------------------------------------------------------

    noStroke();
    fill(20);

    text("}", currentX + braceWidth / 2, textY);
  }

  // ------------------------------------------------------------
  // Coordenadas da célula
  // ------------------------------------------------------------

  fill(20);

  textSize(11);

  text("(" + l + "," + s + ")", x + cellWidth / 2, y + 45);

  textAlign(LEFT, BASELINE);
}

function drawInformation() {
  const resultElement = document.getElementById("result");

  if (!resultElement) return;

  if (resultMessage.includes("✓")) {
    resultElement.innerHTML =
      '<span style="color:#16803c;font-weight:bold;">' +
      resultMessage +
      "</span>";
  } else if (resultMessage.includes("✗")) {
    resultElement.innerHTML =
      '<span style="color:#c62828;font-weight:bold;">' +
      resultMessage +
      "</span>";
  } else {
    resultElement.textContent = resultMessage || "Aguardando execução.";
  }

  if (steps.length > 0 && currentStep >= 0) {
    resultElement.innerHTML +=
      '<br><span style="font-size:13px;color:#667085;">' +
      "Passo: " +
      (currentStep + 1) +
      " / " +
      steps.length +
      "</span>";
  }
}

function resetSimulation() {
  P = [];
  back = [];
  steps = [];
  currentStep = -1;
  resultMessage = "";
  selectedCell = null;
  inputString = "";
  derivationTrees = [];
  currentTreeIndex = 0;
  currentTreeBST = null;
  currentTreeRoot = null;
  treeInfo = "";

  redraw();
  setTimeout(drawDerivationTreeHTML, 0);
}
