//---------------------------------------------------------
// Regex -> AFN (Thompson) -> AFD (subconjuntos) -> AFD mínimo
// Visualizador em p5.js baseado no GraphViz
//---------------------------------------------------------

let currentStage = 0;
let regexInput;
let message = "";
let result = null;
let canvas;

const STAGES = ["AFN", "AFD", "AFD mínimo", "Busca no texto"];

// =========================================================
// 0. SIMULAÇÃO DE BUSCA DE PADRÕES
// =========================================================

let searchText = [];
let searchMatches = [];
let searchLine = 0;
let searchStart = 0;
let searchPos = 0;
let searchState = 0;
let searchActive = false;
let searchPaused = false;
let searchLastStep = 0;
let searchSteps = 0;
let searchFound = 0;
let searchAlphabet = [];
let searchMessage = "";
const SEARCH_LINES = 12;
const SEARCH_COLS = 52;

const SEARCH_COLORS = [
  [255, 235, 120, 180],
  [170, 220, 255, 180],
  [180, 245, 180, 180],
  [255, 190, 210, 180],
  [220, 190, 255, 180],
  [255, 205, 150, 180],
  [170, 240, 230, 180],
  [240, 220, 170, 180],
];
const SEARCH_STEP_MS = 180;

function setup() {
  canvas = createCanvas(980, 560);
  canvas.parent("canvas-container");

  createDiagramContainer();
  textAlign(CENTER, CENTER);

  regexInput = document.getElementById("regex");
  document.getElementById("generate").addEventListener("click", generate);
  document.getElementById("clear").addEventListener("click", clearAll);

  document.getElementById("new-text").addEventListener("click", () => {
    if (!result) return;
    createRandomSearchText();
    findPatternsInText();
    updateInfo();
  });

  document.querySelectorAll("[data-stage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentStage = Number(btn.dataset.stage);
      if (currentStage === 3 && result) {
        createRandomSearchText();
        findPatternsInText();
      }
      updateStageButtons();
      renderCurrentStage();
    });
  });

  regexInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") generate();
  });

  updateStageButtons();
  showHelp();
}

function mousePressed() {
  // O diagrama Graphviz é renderizado como SVG e não usa o mecanismo
  // de arraste do Automata.js.
}

function mouseDragged() {
  // Reservado para futuras interações com o SVG.
}

function mouseReleased() {
  // Reservado para futuras interações com o SVG.
}

function draw() {
  background(247);
  drawHeader();

  if (currentStage === 3) {
    drawSearchStage();
  } else {
    // O AFN/AFD/AFD mínimo é exibido pelo SVG gerado pelo Viz.js.
  }
}

function drawHeader() {
  noStroke();
  fill(247);
  rect(0, 0, width, 58);
  fill(30);
  textAlign(LEFT, CENTER);
  textSize(18);
  text(
    `${STAGES[currentStage]} — ${result ? result.regex : "digite uma expressão regular"}`,
    20,
    29,
  );

  textAlign(RIGHT, CENTER);
  textSize(13);
  const count = result && currentStage < 3 ? getStageData().states.length : 0;
  text(
    currentStage === 3
      ? result
        ? `${searchFound} padrões encontrados`
        : ""
      : `${count} estados`,
    width - 20,
    29,
  );
  textAlign(CENTER, CENTER);
}

function clearAll() {
  regexInput.value = "";
  result = null;
  message = "";
  clearDiagram();
  resetSearch();
  updateInfo();
}

function generate() {
  const expression = regexInput.value.trim();

  try {
    if (!expression) throw new Error("Digite uma expressão regular.");

    const tokens = tokenize(expression);
    const postfix = toPostfix(tokens);
    const nfa = thompson(postfix);
    const dfa = subsetConstruction(nfa);
    const minimized = minimizeDFA(dfa);

    result = { regex: expression, tokens, postfix, nfa, dfa, minimized };
    createRandomSearchText();
    findPatternsInText();
    currentStage = 0;
    message = `Expressão reconhecida. AFN: ${nfa.states.length} estados; AFD: ${dfa.states.length}; mínimo: ${minimized.states.length}.`;

    updateStageButtons();
    renderCurrentStage();
    updateInfo();
  } catch (e) {
    result = null;
    clearDiagram();
    message = `Erro: ${e.message}`;
    updateInfo();
  }
}

function getStageData() {
  if (!result) return { states: [], transitions: [] };
  if (currentStage === 0) return result.nfa;
  if (currentStage === 1) return result.dfa;
  return result.minimized;
}

function createDiagramContainer() {
  const parent = document.getElementById("canvas-container");
  if (!parent) {
    throw new Error('Elemento "canvas-container" não encontrado.');
  }

  // O SVG fica sobre o canvas do p5.js, mas começa abaixo do cabeçalho.
  parent.style.position = "relative";

  const diagram = document.createElement("div");
  diagram.id = "diagram-container";
  diagram.style.position = "absolute";
  diagram.style.left = "0";
  diagram.style.top = "58px";
  diagram.style.width = "100%";
  diagram.style.height = "calc(100% - 58px)";
  diagram.style.overflow = "hidden";
  diagram.style.background = "#f7f7f7";
  diagram.style.zIndex = "2";
  diagram.style.display = "none";
  parent.appendChild(diagram);

  // O canvas continua sendo usado para o cabeçalho e para a busca.
  canvas.elt.style.position = "relative";
  canvas.elt.style.zIndex = "1";
  canvas.elt.style.pointerEvents = "none";
}

function clearDiagram() {
  const diagram = document.getElementById("diagram-container");
  if (diagram) {
    diagram.innerHTML = "";
    diagram.style.display = "none";
  }
}

function renderCurrentStage() {
  const simulationControls = document.getElementById("simulation-controls");
  simulationControls.style.display = currentStage === 3 ? "flex" : "none";

  if (currentStage === 3) {
    clearDiagram();

    if (result && searchText.length === 0) {
      createRandomSearchText();
    }

    return;
  }

  if (!result) {
    clearDiagram();
    updateInfo();
    return;
  }

  const data = getStageData();

  if (!data.states.length) {
    clearDiagram();
    updateInfo();
    return;
  }

  renderGraphviz(data);
  updateInfo();
}

// =========================================================
// RENDERIZAÇÃO COM VIZ.JS / GRAPHVIZ
// =========================================================
//
// O algoritmo de construção dos autômatos permanece exatamente o mesmo.
// A única alteração é a camada de visualização: a estrutura do autômato
// é convertida para DOT e o Viz.js gera o SVG usando o layout do Graphviz.
// =========================================================

function renderGraphviz(data) {
  const diagram = document.getElementById("diagram-container");

  if (!diagram) {
    throw new Error('Elemento "diagram-container" não encontrado.');
  }

  if (typeof Viz === "undefined") {
    throw new Error(
      "Viz.js não foi carregado. Inclua viz.js e full.render.js no HTML."
    );
  }

  diagram.style.display = "block";
  diagram.innerHTML = '<div class="graphviz-loading">Gerando diagrama...</div>';

  const dot = automatonToDot(data);

  // Viz.js 2.x: new Viz().renderSVGElement(dot)
  const viz = new Viz();

  viz.renderSVGElement(dot)
    .then((svg) => {
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.display = "block";
      svg.style.width = "100%";
      svg.style.height = "100%";

      diagram.innerHTML = "";
      diagram.appendChild(svg);
    })
    .catch((error) => {
      console.error("Erro ao renderizar Graphviz:", error);
      diagram.innerHTML =
        `<div class="graphviz-error">
          <strong>Erro ao gerar o diagrama:</strong><br>
          ${escapeHtml(error.message || String(error))}
        </div>`;
    });
}

function automatonToDot(data) {
  const lines = [];

  lines.push("digraph Automaton {");
  lines.push('  graph [rankdir=LR, bgcolor="transparent",');
  lines.push('         pad="0.20", margin="0.05",');
  lines.push('         nodesep="0.55", ranksep="0.90",');
  lines.push('         splines=true, overlap=false,');
  lines.push('         outputorder=edgesfirst];');

  lines.push('  node [shape=circle, style="filled", fillcolor="white",');
  lines.push('        color="#303030", penwidth=1.6,');
  lines.push('        fontname="Arial", fontsize=14,');
  lines.push('        width=0.52, height=0.52, fixedsize=true];');

  lines.push('  edge [color="#303030", penwidth=1.5,');
  lines.push('        fontname="Arial", fontsize=12, arrowsize=0.75];');

  // Estado inicial: uma seta invisível/sem rótulo aponta para o estado.
  // Usamos um nó auxiliar para que o Graphviz mantenha o estado inicial
  // claramente à esquerda.
  const initial = data.states.find((s) => s.initial);

  if (initial) {
    lines.push('  __start [shape=point, width=0.08, label="", color="transparent"];');
    lines.push(
      `  __start -> ${dotId(initial.id)} [color="#303030", penwidth=1.5, arrowsize=0.75];`
    );
  }

  for (const state of data.states) {
    let shape = "circle";

    if (state.initial && state.final) {
      shape = "doublecircle";
    } else if (state.final) {
      shape = "doublecircle";
    }

    const label = graphvizEscape(stateLabel(state));

    lines.push(
      `  ${dotId(state.id)} [shape=${shape}, label="${label}"];`
    );
  }

  for (const transition of data.transitions) {
    const label = transition.symbols
      .map((symbol) => symbol === "ε" ? "ε" : symbol)
      .join(", ");

    lines.push(
      `  ${dotId(transition.from)} -> ${dotId(transition.to)} ` +
      `[label="${graphvizEscape(label)}"];`
    );
  }

  lines.push("}");

  return lines.join("\n");
}

function dotId(id) {
  return `s${Number(id)}`;
}

function stateLabel(state) {
  // No AFN, AFD e AFD mínimo, preservamos os rótulos produzidos
  // pelos algoritmos (q0, q1, Q0, ...).
  if (state.label !== undefined) {
    return state.label;
  }

  return `q${state.id}`;
}

function graphvizEscape(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

// Compatibilidade com versões anteriores do exemplo.
// O layout agora é sempre calculado pelo Graphviz/Viz.js.
function setLayoutMode(mode) {
  if (!["graphviz", "circular", "sequential"].includes(mode)) {
    throw new Error(
      'Use "graphviz", "circular" ou "sequential".'
    );
  }

  if (result && currentStage !== 3) {
    renderCurrentStage();
  }
}

window.setLayoutMode = setLayoutMode;

function updateStageButtons() {
  document.querySelectorAll("[data-stage]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.stage) === currentStage);
  });
}

function updateInfo() {
  const info = document.getElementById("info");
  const details = document.getElementById("details");

  if (!result) {
    info.textContent = message;
    details.innerHTML =
      "<p>Digite uma expressão regular e clique em <strong>Gerar autômatos</strong>.</p>";
    return;
  }

  info.textContent = message;

  if (currentStage === 3) {
    details.innerHTML = `
      <p><strong>Expressão:</strong> <code>${escapeHtml(result.regex)}</code></p>
      <p><strong>Autômato utilizado:</strong> AFD mínimo.</p>
      <p><strong>Busca:</strong> todas as linhas e posições iniciais são analisadas automaticamente.</p>
      <p>Para cada posição inicial, somente o <strong>maior padrão</strong> reconhecido é apresentado.
      Em caso de empate, o primeiro é mantido.</p>
      <p><strong>Padrões encontrados:</strong> ${searchFound}.</p>
      <p><strong>Alfabeto:</strong> ${escapeHtml(searchAlphabet.join(", ") || "∅")}</p>`;
    return;
  }

  const d = getStageData();

  details.innerHTML = `
    <p><strong>Expressão:</strong> <code>${escapeHtml(result.regex)}</code></p>
    <p><strong>Estados:</strong> ${d.states.length}</p>
    <p><strong>Transições:</strong> ${d.transitions.length}</p>
    <p><strong>Alfabeto:</strong> ${escapeHtml([...d.alphabet].join(", ") || "∅")}</p>
    ${
      currentStage === 0
        ? `<p><strong>Layout:</strong> Graphviz (Viz.js)</p>`
        : ""
    }`;
}
function showHelp() {
  updateInfo();
}

// =========================================================
// 0A. SIMULAÇÃO DO AFD PARA BUSCA DE PADRÕES
// =========================================================

function createRandomSearchText() {
  if (!result) return;

  searchAlphabet = [...result.minimized.alphabet]
    .filter((s) => s !== "ε")
    .sort();

  searchText = [];

  if (searchAlphabet.length === 0) {
    searchText = [""];
    searchMatches = [];
    searchFound = 0;
    return;
  }

  for (let line = 0; line < SEARCH_LINES; line++) {
    let str = "";
    for (let col = 0; col < SEARCH_COLS; col++) {
      str += random(searchAlphabet);
    }
    searchText.push(str);
  }
}

function transitionFor(data, stateId, symbol) {
  for (const t of data.transitions) {
    if (t.from === stateId && t.symbols.includes(symbol)) return t.to;
  }
  return null;
}

// Busca completa, sem animação.
// Todas as linhas e todas as posições iniciais são analisadas.
function findPatternsInText() {
  searchMatches = [];
  searchFound = 0;

  if (!result || !searchText.length) return;

  const data = result.minimized;
  const initialState = data.states.find((st) => st.initial);
  if (!initialState) return;

  /*
   * Encontra TODOS os padrões aceitos em cada linha.
   *
   * Depois resolve somente os conflitos entre padrões sobrepostos:
   *
   *   - se dois padrões se sobrepõem, fica o maior;
   *   - se tiverem o mesmo tamanho, fica o que começa primeiro;
   *   - padrões que não se sobrepõem são todos mantidos.
   *
   * Assim, por exemplo, para 10*1:
   *
   *   1010011001
   *   └101┘
   *       └001?  (não pertence a 10*1)
   *
   * e ocorrências distintas como 101 e 1001, quando não sobrepostas,
   * são todas apresentadas.
   */

  for (let line = 0; line < searchText.length; line++) {
    const text = searchText[line];
    const candidates = [];

    // 1. Encontrar todas as substrings aceitas.
    for (let start = 0; start < text.length; start++) {
      let state = initialState.id;

      for (let pos = start; pos < text.length; pos++) {
        const next = transitionFor(data, state, text.charAt(pos));

        if (next === null) break;

        state = next;

        const stateObject = data.states.find((st) => st.id === state);

        if (stateObject && stateObject.final) {
          candidates.push({
            line,
            start,
            end: pos,
            length: pos - start + 1,
          });
        }

        if (stateObject && isDeadState(data, state)) {
          break;
        }
      }
    }

    /*
     * 2. Resolver sobreposições.
     *
     * Ordenamos por tamanho decrescente. Assim, quando houver conflito,
     * o maior padrão tem prioridade. Para padrões do mesmo tamanho,
     * o que aparece primeiro na linha tem prioridade.
     */
    candidates.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return a.start - b.start;
    });

    const selected = [];

    for (const candidate of candidates) {
      const overlaps = selected.some(
        (existing) =>
          candidate.start <= existing.end && candidate.end >= existing.start,
      );

      if (!overlaps) {
        selected.push(candidate);
      }
    }

    /*
     * 3. Ordenar novamente pela posição no texto para que as cores e a
     * apresentação sigam a ordem em que os padrões aparecem na linha.
     */
    selected.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

    for (const match of selected) {
      addSearchMatch(match.line, match.start, match.end);
    }
  }
}
function addSearchMatch(line, start, end) {
  if (end < start) return;

  const lineLength = searchText[line]?.length || 0;
  if (!lineLength) return;

  // Nunca ultrapassa o último caractere da linha.
  end = Math.min(end, lineLength - 1);

  searchMatches.push({
    line,
    start,
    end,
    key: `${line}:${start}:${end}`,
    colorIndex: searchMatches.length % SEARCH_COLORS.length,
  });

  searchFound++;
}
function isDeadState(data, stateId) {
  const state = data.states.find((s) => s.id === stateId);
  if (!state) return false;

  if (Array.isArray(state.subset) && state.subset.length === 0) return true;
  if (state.final) return false;

  const symbols = [...data.alphabet].filter((s) => s !== "ε");
  if (!symbols.length) return false;

  return symbols.every(
    (symbol) => transitionFor(data, stateId, symbol) === stateId,
  );
}

function drawSearchStage() {
  if (!result) {
    fill(30);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("Gere um autômato para iniciar a busca.", width / 2, height / 2);
    return;
  }

  const marginX = 28;
  const top = 92;
  const lineHeight = 34;

  textFont("monospace");
  textSize(17);

  const charW = Math.min(textWidth("0"), (width - 2 * marginX) / SEARCH_COLS);

  fill(30);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(16);
  text(`Busca de padrões com o AFD mínimo — ${result.regex}`, marginX, 72);

  textFont("monospace");
  textSize(17);

  for (let line = 0; line < searchText.length; line++) {
    const y = top + line * lineHeight;

    fill(90);
    textAlign(LEFT, CENTER);
    text(String(line + 1).padStart(2, "0"), 5, y);

    // Apenas os caracteres que pertencem aos padrões recebem fundo.
    for (const m of searchMatches) {
      if (m.line !== line) continue;

      const x = marginX + m.start * charW;
      const w = (m.end - m.start + 1) * charW;
      const c = SEARCH_COLORS[m.colorIndex % SEARCH_COLORS.length];

      fill(c[0], c[1], c[2], c[3]);
      noStroke();
      rect(x, y - 13, w, 26, 4);
    }

    fill(30);
    text(searchText[line], marginX, y);
  }

  const footerY = height - 28;
  fill(30);
  textAlign(LEFT, CENTER);
  textSize(13);
  text(`${searchFound} padrão(ões) encontrado(s)`, marginX, footerY);

  textAlign(RIGHT, CENTER);
  text(
    'Clique em "Novo texto aleatório" para gerar outro texto.',
    width - marginX,
    footerY,
  );
}

// =========================================================
// 1. TOKENIZAÇÃO E PARSER
// =========================================================

function tokenize(regex) {
  const tokens = [];
  for (let i = 0; i < regex.length; i++) {
    const c = regex[i];

    if (c === "\\") {
      if (i + 1 >= regex.length)
        throw new Error("Escape incompleto no final da expressão.");
      tokens.push({ type: "symbol", value: regex[++i] });
    } else if (c === "ε" || c === "e") {
      tokens.push({ type: "epsilon", value: "ε" });
    } else if ("|()*+?".includes(c)) {
      tokens.push({ type: c, value: c });
    } else if (!/\s/.test(c)) {
      tokens.push({ type: "symbol", value: c });
    }
  }

  if (!tokens.length) throw new Error("A expressão não possui símbolos.");

  const output = [];
  for (let i = 0; i < tokens.length; i++) {
    output.push(tokens[i]);
    const a = tokens[i];
    const b = tokens[i + 1];

    if (!b) continue;

    const aCanEnd =
      a.type === "symbol" ||
      a.type === "epsilon" ||
      a.type === ")" ||
      a.type === "*" ||
      a.type === "+" ||
      a.type === "?";
    const bCanStart =
      b.type === "symbol" || b.type === "epsilon" || b.type === "(";

    if (aCanEnd && bCanStart) {
      output.push({ type: ".", value: "." });
    }
  }
  return output;
}

function precedence(type) {
  if (type === "|") return 1;
  if (type === ".") return 2;
  return 0;
}

function toPostfix(tokens) {
  const output = [];
  const stack = [];

  for (const token of tokens) {
    if (token.type === "symbol" || token.type === "epsilon") {
      output.push(token);
    } else if (token.type === "*" || token.type === "+" || token.type === "?") {
      output.push(token);
    } else if (token.type === "(") {
      stack.push(token);
    } else if (token.type === ")") {
      while (stack.length && stack.at(-1).type !== "(")
        output.push(stack.pop());
      if (!stack.length) throw new Error("Parênteses não balanceados.");
      stack.pop();
    } else if (token.type === "|" || token.type === ".") {
      while (
        stack.length &&
        stack.at(-1).type !== "(" &&
        precedence(stack.at(-1).type) >= precedence(token.type)
      ) {
        output.push(stack.pop());
      }
      stack.push(token);
    }
  }

  while (stack.length) {
    if (stack.at(-1).type === "(")
      throw new Error("Parênteses não balanceados.");
    output.push(stack.pop());
  }

  validatePostfix(output);
  return output;
}

function validatePostfix(postfix) {
  let depth = 0;
  for (const t of postfix) {
    if (t.type === "symbol" || t.type === "epsilon") depth++;
    else if (t.type === "*" || t.type === "+" || t.type === "?") {
      if (depth < 1) throw new Error(`Operador ${t.value} sem operando.`);
    } else if (t.type === ".") {
      if (depth < 2) throw new Error("Concatenação inválida.");
      depth--;
    } else if (t.type === "|") {
      if (depth < 2) throw new Error("União inválida.");
      depth--;
    }
  }
  if (depth !== 1) throw new Error("Expressão regular inválida.");
}

// =========================================================
// 2. THOMPSON: ER -> AFN-ε
//    Construção conforme os esquemas apresentados por Sipser:
//
//    - símbolo: novo estado inicial e novo estado final;
//    - união R|S: cria apenas um novo estado inicial;
//      os estados finais de R e S permanecem finais;
//    - concatenação RS: não cria estados; cada final de R
//      recebe uma transição ε para o início de S e deixa de
//      ser final; os finais de S permanecem finais;
//    - fecho de Kleene R*: cria um novo estado que é inicial
//      e final; ele aponta por ε para o início de R e todos
//      os finais de R apontam por ε de volta para o início de R.
//      Os estados que já eram finais em R continuam sendo finais.
// =========================================================

function thompson(postfix) {
  let nextId = 0;
  const states = [];
  const transitions = [];

  function newState() {
    const id = nextId++;
    states.push({
      id,
      initial: false,
      final: false,
    });
    return id;
  }

  function addTransition(from, to, symbol) {
    transitions.push({
      from,
      to,
      symbols: [symbol],
    });
  }

  // Fragmento: um estado inicial + conjunto de estados finais.
  function makeFragment(start, finals) {
    return {
      start,
      finals: new Set(finals),
    };
  }

  // R = a
  function makeSymbol(symbol) {
    const start = newState();
    const final = newState();

    addTransition(start, final, symbol);

    return makeFragment(start, [final]);
  }

  // R|S
  //
  // Conforme Sipser:
  //
  //                 ε ──► início(R)
  //                /
  // novo início ──
  //                \
  //                 ε ──► início(S)
  //
  // Não é criado um novo estado final.
  function makeUnion(A, B) {
    const start = newState();

    addTransition(start, A.start, "ε");
    addTransition(start, B.start, "ε");

    return makeFragment(start, [...A.finals, ...B.finals]);
  }

  // RS
  //
  // Não são criados estados.
  // Cada estado final de R recebe uma transição ε
  // para o estado inicial de S e deixa de ser final.
  function makeConcat(A, B) {
    for (const finalA of A.finals) {
      addTransition(finalA, B.start, "ε");
    }

    return makeFragment(A.start, B.finals);
  }

  // R*
  //
  // Cria um novo estado que é simultaneamente inicial e final.
  //
  // novo estado ──ε──► início(R)
  //
  // final(R) ──ε──► início(R)
  function makeStar(A) {
    const start = newState();

    addTransition(start, A.start, "ε");

    for (const finalA of A.finals) {
      addTransition(finalA, A.start, "ε");
    }

    // O novo estado é final e os estados que já eram finais
    // em A continuam sendo finais.
    return makeFragment(start, [start, ...A.finals]);
  }

  // R+
  //
  // Mantido como extensão didática:
  // R+ = RR*.
  // A construção abaixo não cria um novo estado inicial;
  // os finais de R apontam para o início de R e continuam
  // sendo finais.
  function makePlus(A) {
    for (const finalA of A.finals) {
      addTransition(finalA, A.start, "ε");
    }

    return makeFragment(A.start, A.finals);
  }

  // R?
  //
  // Construção equivalente a ε|R.
  function makeOptional(A) {
    const epsilon = makeSymbol("ε");
    return makeUnion(epsilon, A);
  }

  const stack = [];

  for (const token of postfix) {
    if (token.type === "symbol") {
      stack.push(makeSymbol(token.value));
    } else if (token.type === "epsilon") {
      stack.push(makeSymbol("ε"));
    } else if (token.type === ".") {
      if (stack.length < 2) {
        throw new Error("Concatenação inválida.");
      }

      const B = stack.pop();
      const A = stack.pop();

      stack.push(makeConcat(A, B));
    } else if (token.type === "|") {
      if (stack.length < 2) {
        throw new Error("União inválida.");
      }

      const B = stack.pop();
      const A = stack.pop();

      stack.push(makeUnion(A, B));
    } else if (token.type === "*") {
      if (stack.length < 1) {
        throw new Error("Fecho de Kleene sem operando.");
      }

      const A = stack.pop();

      stack.push(makeStar(A));
    } else if (token.type === "+") {
      if (stack.length < 1) {
        throw new Error("Fecho positivo sem operando.");
      }

      const A = stack.pop();

      stack.push(makePlus(A));
    } else if (token.type === "?") {
      if (stack.length < 1) {
        throw new Error("Operador opcional sem operando.");
      }

      const A = stack.pop();

      stack.push(makeOptional(A));
    }
  }

  if (stack.length !== 1) {
    throw new Error("Não foi possível construir o AFN.");
  }

  const result = stack.pop();

  // Apenas aqui marcamos o estado inicial e os estados finais
  // do AFN completo.
  states[result.start].initial = true;

  for (const final of result.finals) {
    states[final].final = true;
  }

  return normalizeAutomaton(states, transitions);
}

// =========================================================
// 3. AFN -> AFD: CONSTRUÇÃO DOS SUBCONJUNTOS
// =========================================================

function epsilonClosure(nfa, inputSet) {
  const closure = new Set(inputSet);
  const stack = [...inputSet];

  while (stack.length) {
    const s = stack.pop();
    for (const t of nfa.transitions) {
      if (t.from === s && t.symbols.includes("ε") && !closure.has(t.to)) {
        closure.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return closure;
}

function move(nfa, set, symbol) {
  const result = new Set();
  for (const s of set) {
    for (const t of nfa.transitions) {
      if (t.from === s && t.symbols.includes(symbol)) result.add(t.to);
    }
  }
  return result;
}

function subsetConstruction(nfa) {
  const alphabet = [...nfa.alphabet].filter((s) => s !== "ε").sort();
  const initialNfa = nfa.states.filter((s) => s.initial).map((s) => s.id);
  const initial = epsilonClosure(nfa, initialNfa);

  const key = setKey(initial);
  const map = new Map([[key, 0]]);
  const subsets = [initial];
  const transitions = [];

  for (let index = 0; index < subsets.length; index++) {
    const subset = subsets[index];

    for (const symbol of alphabet) {
      // Na construção dos subconjuntos, δ(S, a) é sempre definida:
      //
      //     δ_D(S, a) = ε-fecho(move(S, a))
      //
      // Quando move(S, a) é vazio, o resultado é o conjunto vazio ∅.
      // O conjunto vazio também é um estado do AFD completo e, por isso,
      // NÃO devemos simplesmente descartar a transição.
      const target = epsilonClosure(nfa, move(nfa, subset, symbol));

      const targetKey = setKey(target);

      // Se o conjunto destino ainda não foi descoberto, ele passa a
      // ser um novo estado do AFD. Isso também vale para ∅.
      if (!map.has(targetKey)) {
        map.set(targetKey, subsets.length);
        subsets.push(target);
      }

      transitions.push({
        from: index,
        to: map.get(targetKey),
        symbols: [symbol],
      });
    }
  }

  const states = subsets.map((subset, i) => ({
    id: i,
    initial: i === 0,
    final: [...subset].some((id) => nfa.states[id].final),
    // O conjunto vazio representa o estado poço quando alguma
    // transição δ(S,a) não é possível no AFN.
    label: `q${i}`,
    subset: [...subset].sort((a, b) => a - b),
  }));

  return normalizeAutomaton(states, transitions, alphabet);
}

function setKey(set) {
  return [...set].sort((a, b) => a - b).join(",");
}

// =========================================================
// 4. MINIMIZAÇÃO DO AFD
// =========================================================

function minimizeDFA(dfa) {
  const alphabet = [...dfa.alphabet].filter((s) => s !== "ε").sort();
  const complete = completeDFA(dfa, alphabet);

  const n = complete.states.length;
  const distinguishable = Array.from({ length: n }, () => Array(n).fill(false));

  // Pares final / não final são distinguíveis.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (complete.states[i].final !== complete.states[j].final) {
        distinguishable[i][j] = distinguishable[j][i] = true;
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (distinguishable[i][j]) continue;

        for (const symbol of alphabet) {
          const a = transitionTarget(complete, i, symbol);
          const b = transitionTarget(complete, j, symbol);
          if (a === b) continue;

          if (distinguishable[a][b]) {
            distinguishable[i][j] = distinguishable[j][i] = true;
            changed = true;
            break;
          }
        }
      }
    }
  }

  // Relação de equivalência: dois estados não distinguíveis pertencem
  // à mesma classe.
  const classes = [];
  const classOf = Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (classOf[i] !== -1) continue;

    const cls = [];
    for (let j = i; j < n; j++) {
      if (!distinguishable[i][j]) cls.push(j);
    }

    const id = classes.length;
    cls.forEach((s) => (classOf[s] = id));
    classes.push(cls);
  }

  const states = classes.map((cls, i) => ({
    id: i,
    initial: cls.includes(complete.states.find((s) => s.initial).id),
    final: cls.some((s) => complete.states[s].final),
    label: `Q${i}`,
    members: cls,
  }));

  const transitionMap = new Map();

  for (let i = 0; i < classes.length; i++) {
    const representative = classes[i][0];

    for (const symbol of alphabet) {
      const target = transitionTarget(complete, representative, symbol);
      const to = classOf[target];
      const key = `${i}|${to}`;

      if (!transitionMap.has(key)) transitionMap.set(key, []);
      transitionMap.get(key).push(symbol);
    }
  }

  const transitions = [];
  for (const [key, symbols] of transitionMap) {
    const [from, to] = key.split("|").map(Number);
    transitions.push({ from, to, symbols: [...new Set(symbols)].sort() });
  }

  // Remove o estado poço se ele foi criado apenas para completar o AFD
  // e não é necessário para a linguagem. Isso deixa o desenho didático.
  if (complete.sink !== undefined) {
    const sinkClass = classOf[complete.sink];
    const sinkOnly = classes[sinkClass].every((s) => s === complete.sink);

    if (sinkOnly && !states[sinkClass].final) {
      const incomingToSink = transitions.some((t) => t.to === sinkClass);
      if (!incomingToSink) {
        return normalizeAutomaton(
          states
            .filter((s) => s.id !== sinkClass)
            .map((s, i) => ({ ...s, id: i })),
          transitions
            .filter((t) => t.from !== sinkClass && t.to !== sinkClass)
            .map((t) => ({
              ...t,
              from: remapId(t.from, sinkClass),
              to: remapId(t.to, sinkClass),
            })),
          alphabet,
        );
      }
    }
  }

  return normalizeAutomaton(states, transitions, alphabet);
}

function remapId(id, removed) {
  return id > removed ? id - 1 : id;
}

function completeDFA(dfa, alphabet) {
  const states = dfa.states.map((s) => ({ ...s }));
  const transitions = dfa.transitions.map((t) => ({
    from: t.from,
    to: t.to,
    symbols: [...t.symbols],
  }));

  let sink = states.find((s) => s.label === "⊥")?.id;

  const transitionExists = (from, symbol) =>
    transitions.some((t) => t.from === from && t.symbols.includes(symbol));

  // Só cria o estado poço se realmente houver alguma transição ausente.
  let needsSink = false;
  for (const s of states) {
    for (const a of alphabet) {
      if (!transitionExists(s.id, a)) {
        needsSink = true;
        break;
      }
    }
    if (needsSink) break;
  }

  if (needsSink && sink === undefined) {
    sink = states.length;
    states.push({
      id: sink,
      initial: false,
      final: false,
      label: "⊥",
    });
  }

  if (needsSink) {
    for (const s of states) {
      for (const a of alphabet) {
        if (!transitionExists(s.id, a)) {
          transitions.push({ from: s.id, to: sink, symbols: [a] });
        }
      }
    }

    for (const a of alphabet) {
      if (!transitionExists(sink, a)) {
        transitions.push({ from: sink, to: sink, symbols: [a] });
      }
    }
  }

  return normalizeAutomaton(states, transitions, alphabet, sink);
}

function transitionTarget(dfa, from, symbol) {
  const t = dfa.transitions.find(
    (t) => t.from === from && t.symbols.includes(symbol),
  );
  return t ? t.to : -1;
}

// =========================================================
// NORMALIZAÇÃO E APOIO
// =========================================================

function normalizeAutomaton(
  states,
  rawTransitions,
  alphabet = null,
  sink = undefined,
) {
  const transitions = rawTransitions.map((t) => {
    if (Array.isArray(t.symbols)) return t;
    return { from: t.from, to: t.to, symbols: [t.symbol] };
  });

  const symbols =
    alphabet ||
    [
      ...new Set(
        transitions.flatMap((t) => t.symbols).filter((s) => s !== "ε"),
      ),
    ].sort();

  const normalizedStates = states.map((s, i) => ({
    ...s,
    id: i,
    label: s.label ?? `q${i}`,
  }));

  return {
    states: normalizedStates,
    transitions,
    alphabet: new Set(symbols),
    sink,
  };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Disponibiliza também a estrutura no console para uso didático.
window.regexAutomata = () => result;
