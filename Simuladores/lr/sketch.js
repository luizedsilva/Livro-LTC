/*
 * ============================================================
 * SIMULADOR DE ANÁLISE SINTÁTICA LR / SLR(1)
 * ============================================================
 *
 * Projeto p5.js
 *
 * O programa implementa:
 *
 *   1. Leitura de uma gramática
 *   2. Identificação de terminais e não terminais
 *   3. FIRST
 *   4. FOLLOW
 *   5. Gramática aumentada
 *   6. Itens LR(0)
 *   7. Closure
 *   8. GOTO
 *   9. Conjunto canônico de estados
 *  10. Tabela SLR(1)
 *  11. Detecção de conflitos
 *  12. Simulação LR com pilha
 *
 * Convenção:
 *
 *   eN = empilha o símbolo e o estado N
 *   rN = redução pela produção N (em 2 passos)
 *   a  = aceita
 *
 * ============================================================
 */

/* ============================================================
 * DADOS GLOBAIS
 * ============================================================
 */

let G = null;
let parser = null;
let currentTab = "states";
let draggedNode = -1;
let dragDX = 0;
let dragDY = 0;

/* ============================================================
 * SETUP DO P5
 * ============================================================
 *
 * O programa usa p5.js principalmente para desenhar o AFD.
 * A interface principal está no index.html.
 * ============================================================
 */

function setup() {
  noCanvas();
  configurarEventos();
  build();
}

/* ============================================================
 * CONFIGURAÇÃO DOS EVENTOS DO HTML
 * ============================================================
 */

function configurarEventos() {
  document.getElementById("build-button").addEventListener("click", build);
  document
    .getElementById("list-button")
    .addEventListener("click", loadListExample);
  document
    .getElementById("expression-button")
    .addEventListener("click", loadExpressionExample);
  document.getElementById("step-button").addEventListener("click", stepParse);
  document.getElementById("run-button").addEventListener("click", runParse);
  document.getElementById("reset-button").addEventListener("click", resetParse);
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectTab(button.dataset.tab);
    });
  });
}

/* ============================================================
 * FUNÇÕES AUXILIARES DE DOM
 * ============================================================
 */

function valueOf(id) {
  return document.getElementById(id).value;
}

function setHTML(id, html) {
  document.getElementById(id).innerHTML = html;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

/* ============================================================
 * SELEÇÃO DE ABA
 * ============================================================
 */

function selectTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("active");
  });
  const panel = document.getElementById(tab + "-panel");
  if (panel) {
    panel.classList.add("active");
  }
  const button = document.querySelector(`.tab-button[data-tab="${tab}"]`);
  if (button) {
    button.classList.add("active");
  }
}

/* ============================================================
 * PARSE DA GRAMÁTICA
 * ============================================================
 */

function parseGrammar(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ""))
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("Informe pelo menos uma produção.");
  }
  const productions = [];
  for (const line of lines) {
    let position = line.indexOf("::=");
    let separatorLength = 3;
    if (position < 0) {
      position = line.indexOf("->");
      separatorLength = 2;
    }
    if (position < 0) {
      position = line.indexOf("→");
      separatorLength = 1;
    }
    if (position < 1) {
      throw new Error("Produção inválida: " + line);
    }
    const lhs = line.substring(0, position);
    let rhs = line.substring(position + separatorLength);
    if (lhs.length !== 1) {
      throw new Error(
        "Cada não terminal deve ser representado " +
          "por uma única letra: " +
          lhs,
      );
    }
    if (rhs === "ε" || rhs === "ϵ") {
      rhs = "";
    }
    productions.push({
      lhs,
      rhs,
    });
  }
  const nonterminals = [];
  for (const production of productions) {
    if (!nonterminals.includes(production.lhs)) {
      nonterminals.push(production.lhs);
    }
  }
  const start = productions[0].lhs;
  const terminals = [];
  for (const production of productions) {
    for (const symbol of production.rhs) {
      if (!nonterminals.includes(symbol) && !terminals.includes(symbol)) {
        terminals.push(symbol);
      }
    }
  }
  /*
   * # é o marcador de fim de entrada.
   */
  if (!terminals.includes("#")) {
    terminals.push("#");
  }
  return {
    productions,
    nonterminals,
    terminals,
    start,
  };
}

/* ============================================================
 * FIRST
 * ============================================================
 */

function calculateFirst(grammar) {
  const FIRST = {};
  for (const nonterminal of grammar.nonterminals) {
    FIRST[nonterminal] = new Set();
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const production of grammar.productions) {
      const A = production.lhs;
      const rhs = production.rhs;
      /*
       * A ::= ε
       */
      if (rhs.length === 0) {
        if (!FIRST[A].has("ε")) {
          FIRST[A].add("ε");
          changed = true;
        }
        continue;
      }
      let nullable = true;
      for (const symbol of rhs) {
        /*
         * Terminal
         */
        if (!grammar.nonterminals.includes(symbol)) {
          if (!FIRST[A].has(symbol)) {
            FIRST[A].add(symbol);
            changed = true;
          }
          nullable = false;
          break;
        }

        /*
         * Não terminal
         */
        for (const x of FIRST[symbol]) {
          if (x !== "ε" && !FIRST[A].has(x)) {
            FIRST[A].add(x);
            changed = true;
          }
        }
        if (!FIRST[symbol].has("ε")) {
          nullable = false;
          break;
        }
      }
      if (nullable) {
        if (!FIRST[A].has("ε")) {
          FIRST[A].add("ε");

          changed = true;
        }
      }
    }
  }
  return FIRST;
}

/* ============================================================
 * FIRST DE UMA SEQUÊNCIA
 * ============================================================
 */

function firstOfSequence(sequence, grammar, FIRST) {
  const result = new Set();
  if (sequence.length === 0) {
    result.add("ε");
    return result;
  }
  let nullable = true;
  for (const symbol of sequence) {
    /*
     * Terminal
     */
    if (!grammar.nonterminals.includes(symbol)) {
      result.add(symbol);
      nullable = false;
      break;
    }
    for (const x of FIRST[symbol]) {
      if (x !== "ε") {
        result.add(x);
      }
    }
    if (!FIRST[symbol].has("ε")) {
      nullable = false;
      break;
    }
  }
  if (nullable) {
    result.add("ε");
  }
  return result;
}

/* ============================================================
 * FOLLOW
 * ============================================================
 */

function calculateFollow(grammar, FIRST) {
  const FOLLOW = {};

  for (const nonterminal of grammar.nonterminals) {
    FOLLOW[nonterminal] = new Set();
  }

  /*
   * # pertence ao FOLLOW do símbolo inicial.
   */

  FOLLOW[grammar.start].add("#");

  let changed = true;

  while (changed) {
    changed = false;

    for (const production of grammar.productions) {
      const A = production.lhs;

      const rhs = production.rhs;

      for (let i = 0; i < rhs.length; i++) {
        const B = rhs[i];

        if (!grammar.nonterminals.includes(B)) {
          continue;
        }

        const beta = rhs.substring(i + 1);

        const firstBeta = firstOfSequence(beta, grammar, FIRST);

        /*
         * FIRST(beta) - ε
         */

        for (const symbol of firstBeta) {
          if (symbol !== "ε" && !FOLLOW[B].has(symbol)) {
            FOLLOW[B].add(symbol);

            changed = true;
          }
        }

        /*
         * Se beta gera ε:
         *
         * FOLLOW(B) += FOLLOW(A)
         */

        if (beta.length === 0 || firstBeta.has("ε")) {
          for (const symbol of FOLLOW[A]) {
            if (!FOLLOW[B].has(symbol)) {
              FOLLOW[B].add(symbol);

              changed = true;
            }
          }
        }
      }
    }
  }

  return FOLLOW;
}

/* ============================================================
 * ITEM LR(0)
 * ============================================================
 */

function itemKey(item) {
  return item.production + ":" + item.dot;
}

function stateKey(items) {
  return items.map(itemKey).sort().join("|");
}

/* ============================================================
 * CLOSURE
 * ============================================================
 */

function closure(items, grammar) {
  const result = items.map((item) => ({
    production: item.production,

    dot: item.dot,
  }));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of result) {
      const production = grammar.productions[item.production];
      const symbol = production.rhs[item.dot];
      /*
       * O símbolo após o ponto é
       * um não terminal.
       */
      if (symbol && grammar.nonterminals.includes(symbol)) {
        for (let p = 0; p < grammar.productions.length; p++) {
          if (grammar.productions[p].lhs === symbol) {
            const exists = result.some(
              (item2) => item2.production === p && item2.dot === 0,
            );
            if (!exists) {
              result.push({
                production: p,
                dot: 0,
              });
              changed = true;
            }
          }
        }
      }
    }
  }
  result.sort((a, b) => a.production - b.production || a.dot - b.dot);
  return result;
}

/* ============================================================
 * GOTO
 * ============================================================
 */

function gotoItems(items, symbol, grammar) {
  const moved = [];
  for (const item of items) {
    const production = grammar.productions[item.production];

    if (production.rhs[item.dot] === symbol) {
      moved.push({
        production: item.production,

        dot: item.dot + 1,
      });
    }
  }
  if (moved.length === 0) {
    return [];
  }
  return closure(moved, grammar);
}

/* ============================================================
 * CONSTRUÇÃO DO AFD LR(0)
 * ============================================================
 */

function buildAutomaton(originalGrammar) {
  /*
   * Fazemos uma cópia da gramática.
   * A gramática original permanece intacta.
   */
  const grammar = {
    productions: originalGrammar.productions.map((production) => ({
      lhs: production.lhs,

      rhs: production.rhs,
    })),
    nonterminals: [...originalGrammar.nonterminals],
    terminals: [...originalGrammar.terminals],
    start: originalGrammar.start,
  };

  /*
   * Produção aumentada:
   *
   * S' ::= S
   *
   * O símbolo $ é usado internamente.
   */

  grammar.productions.unshift({
    lhs: "$",
    rhs: grammar.start,
  });
  const states = [];
  const transitions = {};
  const initial = closure(
    [
      {
        production: 0,
        dot: 0,
      },
    ],
    grammar,
  );
  states.push(initial);
  const stateMap = new Map();
  stateMap.set(stateKey(initial), 0);
  for (let i = 0; i < states.length; i++) {
    transitions[i] = {};
    const symbols = [];
    /*
     * Obtém todos os símbolos que podem
     * ser deslocados a partir do estado.
     */

    for (const item of states[i]) {
      const production = grammar.productions[item.production];
      const symbol = production.rhs[item.dot];
      if (symbol && !symbols.includes(symbol)) {
        symbols.push(symbol);
      }
    }

    /*
     * Calcula GOTO para cada símbolo.
     */

    for (const symbol of symbols) {
      const next = gotoItems(states[i], symbol, grammar);
      const key = stateKey(next);
      let destination = stateMap.get(key);
      if (destination === undefined) {
        destination = states.length;
        states.push(next);
        stateMap.set(key, destination);
      }
      transitions[i][symbol] = destination;
    }
  }

  return {
    grammar,
    states,
    transitions,
  };
}

/* ============================================================
 * TABELA SLR(1)
 * ============================================================
 */

function buildSLRTable(
  originalGrammar,
  augmentedGrammar,
  states,
  transitions,
  FOLLOW,
) {
  /*
   * Tabela SLR(1) conforme o algoritmo de simulação:
   *
   *  - As colunas contêm terminais E não terminais.
   *  - Terminal -> SHIFT (e_j), REDUCE (rN) ou ACEITAR.
   *  - Não terminal -> EMPILHA (e_j).
   *
   * A redução NÃO realiza o GOTO imediatamente.
   * A simulação executará a redução em duas etapas:
   *   1. remove os estados/símbolos correspondentes ao RHS;
   *   2. no passo seguinte consulta Tabela[P[i], A] e
   *      empilha A e o estado indicado por e_j.
   */
  const action = {};
  const go = {};
  const conflicts = [];

  /*
   * Todas as colunas da tabela são mantidas em uma única estrutura.
   */
  const allSymbols = [
    ...originalGrammar.terminals,
    ...originalGrammar.nonterminals,
  ];

  for (let i = 0; i < states.length; i++) {
    action[i] = {};
    for (const symbol of allSymbols) {
      action[i][symbol] = null;
    }
  }

  function setAction(state, symbol, value) {
    const current = action[state][symbol];

    if (current !== null && current !== undefined) {
      if (JSON.stringify(current) !== JSON.stringify(value)) {
        conflicts.push({
          state,
          symbol,
          old: current,
          new: value,
        });
      }
      return;
    }

    action[state][symbol] = value;
  }

  /*
   * TRANSIÇÕES
   *
   * Tanto terminais quanto não terminais são representados
   * como uma operação de empilhamento e_j.
   *
   * Para terminal:
   *     Tabela[i,a] = Empilha(e_j)
   *
   * Para não terminal:
   *     Tabela[i,A] = Empilha(e_j)
   */
  for (let i = 0; i < states.length; i++) {
    for (const symbol in transitions[i]) {
      const destination = transitions[i][symbol];

      if (
        originalGrammar.terminals.includes(symbol) ||
        originalGrammar.nonterminals.includes(symbol)
      ) {
        setAction(i, symbol, {
          type: "push",
          to: destination,
        });
      }
    }
  }

  /*
   * ITENS COMPLETOS
   */
  for (let i = 0; i < states.length; i++) {
    for (const item of states[i]) {
      const production = augmentedGrammar.productions[item.production];

      if (item.dot < production.rhs.length) {
        continue;
      }

      /*
       * Item aumentado:
       *
       * S' ::= S .
       */
      if (item.production === 0) {
        setAction(i, "#", {
          type: "accept",
        });
        continue;
      }

      /*
       * Item completo normal:
       *
       * A ::= α .
       *
       * A redução é registrada nos terminais de FOLLOW(A).
       *
       * IMPORTANTE:
       * A célula contém apenas "reduce". O GOTO/empilhamento
       * de A será feito no passo seguinte da simulação.
       */
      const A = production.lhs;

      for (const terminal of FOLLOW[A]) {
        setAction(i, terminal, {
          type: "reduce",
          production: item.production,
        });
      }
    }
  }

  /*
   * Mantemos "go" por compatibilidade com outras partes do projeto,
   * mas a tabela principal agora contém também as transições
   * dos não terminais.
   */
  for (const nonterminal of originalGrammar.nonterminals) {
    go[nonterminal] = {};

    for (let i = 0; i < states.length; i++) {
      const entry = action[i][nonterminal];

      if (entry && entry.type === "push") {
        go[nonterminal][i] = entry.to;
      }
    }
  }

  return {
    action,
    go,
    conflicts,
    allSymbols,
  };
}
/* ============================================================
 * CONSTRUÇÃO DO ANALISADOR
 * ============================================================
 */

function build() {
  try {
    /*
     * Gramática original.
     */
    const original = parseGrammar(valueOf("grammar"));
    /*
     * FIRST/FOLLOW são calculados
     * ANTES da produção aumentada.
     */

    const FIRST = calculateFirst(original);
    const FOLLOW = calculateFollow(original, FIRST);
    /*
     * Conjunto canônico LR(0).
     */

    const automaton = buildAutomaton(original);
    /*
     * Tabela SLR(1).
     */

    const table = buildSLRTable(
      original,
      automaton.grammar,
      automaton.states,
      automaton.transitions,
      FOLLOW,
    );
    G = {
      original,
      grammar: automaton.grammar,
      states: automaton.states,
      transitions: automaton.transitions,
      FIRST,
      FOLLOW,
      table,
    };
    resetParse();
    renderStates();
    // renderTransitions();
    renderTable();
    renderFirstFollow();
    // createAFD();
    const conflictCount = table.conflicts.length;
    if (conflictCount > 0) {
      setHTML(
        "status",
        `<span class="warning">
          Foram encontrados ${conflictCount}
          conflito(s) na construção da tabela SLR(1).
        </span><br>
        Os estados LR(0) e o AFD foram construídos,
        mas a tabela não é determinística.
        `,
      );
    } else {
      setHTML(
        "status",

        `<span class="ok">
          Analisador SLR(1) construído com sucesso.
        </span><br><br>
        Estados LR(0):
        <b>${G.states.length}</b><br>
        Terminais:
        <b>${G.original.terminals.join(", ")}</b><br>
        Não terminais:
        <b>${G.original.nonterminals.join(", ")}</b>
        `,
      );
    }
    selectTab("states");
  } catch (error) {
    console.error(error);
    G = null;
    setHTML(
      "status",
      `<span class="error">
        Erro: ${escapeHTML(error.message)}
      </span>`,
    );
  }
}

/* ============================================================
 * TEXTO DE PRODUÇÃO
 * ============================================================
 */

function productionText(index) {
  const production = G.grammar.productions[index];
  if (index === 0) {
    return "S' -> " + production.rhs;
  }
  return (
    production.lhs + " -> " + (production.rhs.length ? production.rhs : "ε")
  );
}

/* ============================================================
 * TEXTO DE ITEM
 * ============================================================
 */

function itemText(item) {
  const production = G.grammar.productions[item.production];
  const rhs = production.rhs;
  const before = rhs.substring(0, item.dot);
  const after = rhs.substring(item.dot);
  return production.lhs + " -> " + before + "·" + after;
}

/* ============================================================
 * ESTADOS
 * ============================================================
 */

function renderStates() {
  if (!G) {
    return;
  }
  let html = "";
  G.states.forEach((state, index) => {
    html += `<div class="state-box">
          <div class="state-title">
            e${index}
          </div>`;
    state.forEach((item) => {
      html += `<div class="item">
              ${escapeHTML(itemText(item))}
            </div>`;
    });
    html += `</div>`;
  });
  setHTML("states-content", html);
}

/* ============================================================
 * TABELA SLR
 * ============================================================
 */

function renderTable() {
  if (!G) {
    return;
  }

  /*
   * Tabela:
   *
   *   Estado | não terminais | terminais
   *
   */
  let html = `<div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Estado</th>`;

  for (const nonterminal of G.original.nonterminals) {
    html += `<th>${escapeHTML(nonterminal)}</th>`;
  }

  for (const terminal of G.original.terminals) {
    html += `<th>${escapeHTML(terminal)}</th>`;
  }

  html += `</tr>
        </thead>
        <tbody>`;

  for (let i = 0; i < G.states.length; i++) {
    html += `<tr>
        <th>${i}</th>`;

    for (const nonterminal of G.original.nonterminals) {
      html += `<td>${actionText(G.table.action[i][nonterminal])}</td>`;
    }

    for (const terminal of G.original.terminals) {
      html += `<td>${actionText(G.table.action[i][terminal])}</td>`;
    }

    html += `</tr>`;
  }

  html += `</tbody>
      </table>
    </div>`;

  if (G.table.conflicts.length) {
    html += `<h3>Conflitos</h3>
       <ul>`;

    G.table.conflicts.forEach((conflict) => {
      html += `<li>
            Estado ${conflict.state},
            símbolo
            <b>${escapeHTML(conflict.symbol)}</b>:
            ${actionText(conflict.old)}
            ×
            ${actionText(conflict.new)}
          </li>`;
    });

    html += `</ul>`;
  }

  setHTML("table-content", html);
}
/* ============================================================
 * FIRST / FOLLOW
 * ============================================================
 */

function renderFirstFollow() {
  if (!G) {
    return;
  }

  let html = `<table>
      <thead>
        <tr>
          <th>Não terminal</th>
          <th>FIRST</th>
          <th>FOLLOW</th>
        </tr>
      </thead>
      <tbody>`;

  for (const nonterminal of G.original.nonterminals) {
    const first = [...G.FIRST[nonterminal]].join(", ");

    const follow = [...G.FOLLOW[nonterminal]].join(", ");

    html += `<tr>
        <td><b>${nonterminal}</b></td>
        <td>{ ${escapeHTML(first)} }</td>
        <td>{ ${escapeHTML(follow)} }</td>
      </tr>`;
  }

  html += `</tbody>
    </table>`;

  setHTML("first-follow-content", html);
}

/* ============================================================
 * AÇÃO DA TABELA
 * ============================================================
 */

function actionText(action) {
  if (!action) {
    return "—";
  }

  if (action.type === "push" || action.type === "shift") {
    return "e" + action.to;
  }

  if (action.type === "reduce") {
    return "r" + action.production;
  }

  if (action.type === "accept") {
    return "a";
  }

  return "?";
}
/* ============================================================
 * PILHA
 * ============================================================
 */

function stackText() {
  if (!parser) {
    return "—";
  }

  return parser.stack.map((value) => String(value)).join(" ");
}

/* ============================================================
 * ENTRADA RESTANTE
 * ============================================================
 */

function remainingInput() {
  if (!parser) {
    return "—";
  }

  return parser.input.slice(parser.ip).join("");
}

/* ============================================================
 * REINICIAR ANÁLISE
 * ============================================================
 */

function resetParse() {
  if (!G) {
    return;
  }

  const sentence = valueOf("sentence").replace(/\s+/g, "");

  if (sentence.includes("#")) {
    setHTML(
      "status",
      `<span class="error">
        Não coloque # na sentença.
        O simulador acrescenta # automaticamente.
      </span>`,
    );
    return;
  }

  parser = {
    stack: [0],
    input: [...sentence, "#"],
    ip: 0,

    /*
     * Controle explícito das duas etapas de uma redução:
     *
     * reduzido = false
     *   consulta o símbolo de entrada
     *
     * reduzido = true
     *   consulta o não terminal produzido pela redução
     */
    reduzido: false,
    simboloReduzido: null,

    // Produções reduzidas durante a análise, na ordem em que ocorreram.
    // A reconstrução da derivação mais à direita usa esta lista de trás para frente.
    reducoes: [],

    step: 0,
    trace: [],
    accepted: false,
    rejected: false,
    lastAction: "—",
    message: "Aguardando o próximo passo.",
  };

  updateSimulation();
}
/* ============================================================
 * PRÓXIMO PASSO
 * ============================================================
 */

function stepParse() {
  if (!G) {
    build();

    if (!G) {
      return;
    }
  }

  if (!parser) {
    resetParse();
  }

  if (parser.accepted || parser.rejected) {
    return;
  }

  const state = parser.stack[parser.stack.length - 1];

  /*
   * PRIMEIRO PASSO:
   *
   *   reduzido = false -> s = próximo terminal da entrada
   *
   * SEGUNDO PASSO:
   *
   *   reduzido = true -> s = variável produzida pela redução
   */
  const s = parser.reduzido ? parser.simboloReduzido : parser.input[parser.ip];

  const oldStack = stackText();
  const oldInput = remainingInput();

  /*
   * Verificação do símbolo de entrada.
   */
  if (!parser.reduzido && !G.original.terminals.includes(s)) {
    parser.rejected = true;
    parser.lastAction = "erro";
    parser.message = "Símbolo '" + s + "' não pertence ao alfabeto de entrada.";

    registerTrace("erro", oldStack, oldInput);
    updateSimulation();
    return;
  }

  /*
   * Verificação da variável produzida.
   */
  if (parser.reduzido && !G.original.nonterminals.includes(s)) {
    parser.rejected = true;
    parser.lastAction = "erro";
    parser.message = "Variável '" + s + "' não pertence à gramática.";

    registerTrace("erro", oldStack, oldInput);
    updateSimulation();
    return;
  }

  const action = G.table.action[state][s];

  /*
   * ERRO
   */
  if (!action) {
    parser.rejected = true;
    parser.lastAction = "erro";
    parser.message = "ERRO: Tabela[" + state + ", " + s + "] não definida.";

    registerTrace("erro", oldStack, oldInput);
    updateSimulation();
    return;
  }

  /*
   * =========================================================
   * EMPILHA
   * =========================================================
   */
  if (action.type === "push" || action.type === "shift") {
    /*
     * -------------------------------------------------------
     * SEGUNDO PASSO DA REDUÇÃO
     * -------------------------------------------------------
     *
     * A variável A foi produzida no passo anterior.
     *
     * Agora:
     *
     *   s = A
     *   Tabela[P[i], A] = e_j
     *
     * e:
     *
     *   P[i+1] = A
     *   P[i+2] = e_j
     */
    if (parser.reduzido) {
      const A = parser.simboloReduzido;

      parser.stack.push(A);
      parser.stack.push(action.to);

      parser.lastAction = "e" + action.to;

      parser.message =
        "EMPILHA: Tabela[" +
        state +
        ", " +
        A +
        "] = e" +
        action.to +
        ". Empilha '" +
        A +
        "' e o estado " +
        action.to +
        ".";

      /*
       * REGISTRA SOMENTE AQUI o segundo passo.
       *
       * Como simboloReduzido ainda contém A, a linha
       * do e_j mostrará A.
       */
      registerTrace(parser.lastAction, oldStack, oldInput);

      /*
       * Agora a redução está concluída.
       */
      parser.reduzido = false;
      parser.simboloReduzido = null;

      updateSimulation();
      return;
    }

    /*
     * -------------------------------------------------------
     * SHIFT NORMAL
     * -------------------------------------------------------
     */
    const lookahead = parser.input[parser.ip];

    parser.stack.push(lookahead);
    parser.stack.push(action.to);

    parser.ip++;

    parser.lastAction = "e" + action.to;

    // parser.message =
    //     "SHIFT: empilha '" + lookahead + "' e o estado " + action.to + ".";

    parser.message =
      "EMPILHA: Tabela[" +
      state +
      ", " +
      lookahead +
      "] = e" +
      action.to +
      ". Empilha '" +
      lookahead +
      "' e o estado " +
      action.to +
      ".";

    registerTrace(parser.lastAction, oldStack, oldInput);

    updateSimulation();
    return;
  }

  /*
   * =========================================================
   * REDUZIR — PRIMEIRO PASSO
   * =========================================================
   *
   * Apenas remove |α| símbolos/estados.
   *
   * NÃO consulta o GOTO.
   * NÃO empilha A.
   * NÃO executa e_j.
   *
   * O próximo clique executará o segundo passo.
   */
  if (action.type === "reduce") {
    const production = G.grammar.productions[action.production];

    const rhs = production.rhs;
    const length = rhs.length;

    /*
     * Remove símbolo + estado para cada símbolo de α.
     */
    for (let k = 0; k < 2 * length; k++) {
      parser.stack.pop();
    }

    /*
     * Guarda a produção reduzida.
     *
     * action.production é o índice da produção na gramática aumentada.
     * Como a produção aumentada ocupa o índice 0, ele coincide com a
     * numeração da produção original usada pelo simulador (1, 2, ...).
     */
    parser.reducoes.push(action.production);

    /*
     * Guarda a variável produzida para o PRÓXIMO passo.
     */
    parser.reduzido = true;
    parser.simboloReduzido = production.lhs;

    parser.lastAction = "r" + action.production;

    parser.message =
      "REDUZIR: " +
      production.lhs +
      " -> " +
      (rhs.length ? rhs : "ε") +
      ". Remover Símbolos,Estados do lado direito ";

    /*
     * REGISTRA EXATAMENTE UMA LINHA para a redução.
     *
     * O símbolo reduzido NÃO deve aparecer nesta linha.
     */
    registerTrace(parser.lastAction, oldStack, oldInput);

    /*
     * MUITO IMPORTANTE:
     *
     * Retorna imediatamente.
     * Não existe outro registerTrace() para este mesmo passo.
     */
    updateSimulation();
    return;
  }

  /*
   * =========================================================
   * ACEITAR
   * =========================================================
   */
  if (action.type === "accept") {
    parser.accepted = true;
    parser.lastAction = "a";
    parser.message = "ACEITA: a sentença pertence à linguagem.";

    registerTrace(parser.lastAction, oldStack, oldInput);

    updateSimulation();
    return;
  }

  /*
   * Tipo de ação desconhecido.
   */
  parser.rejected = true;
  parser.lastAction = "erro";
  parser.message = "ERRO: tipo de ação desconhecido.";

  registerTrace(parser.lastAction, oldStack, oldInput);

  updateSimulation();
}
/* ============================================================
 * REGISTRA PASSO
 * ============================================================
 */

function registerTrace(action, stack = null, input = null) {
  if (stack === null) {
    stack = stackText();
  }

  if (input === null) {
    input = remainingInput();
  }

  parser.trace.push({
    step: parser.step++,
    stack,
    input,

    /*
     * Na linha rN, este campo guarda A internamente.
     * O updateSimulation() NÃO o mostra nessa linha.
     * Ele o mostra na linha seguinte.
     */
    reducedSymbol: parser.simboloReduzido || null,

    action,
  });
}
/* ============================================================
 * EXECUTAR
 * ============================================================
 */

function runParse() {
  if (!G) {
    build();
    if (!G) {
      return;
    }
  }
  resetParse();
  if (!parser) {
    return;
  }
  let guard = 0;
  while (!parser.accepted && !parser.rejected && guard < 1000) {
    stepParse();
    guard++;
  }
  if (guard >= 1000) {
    parser.rejected = true;
    parser.message = "ERRO: limite de 1000 passos excedido.";
  }
  updateSimulation();
  selectTab("simulation");
}

/* ============================================================
 * DERIVAÇÃO MAIS À DIREITA
 * ============================================================
 *
 * O analisador LR registra as reduções na ordem em que elas ocorrem:
 *
 *   r1, r2, r3, ...
 *
 * Para obter a derivação mais à direita, fazemos o processo inverso:
 * começamos pelo símbolo inicial e aplicamos as reduções de trás para
 * frente. Em cada etapa substituímos o não terminal mais à direita.
 *
 * Exemplo:
 *
 *   S =3=> AB =5=> AXB =2=> AX =4=> aX =1=> aab
 *
 * Os números mostrados são os números das produções da gramática
 * original, e não os índices internos da gramática aumentada.
 */
function gerarDerivacaoMaisDireita() {
  if (!parser || !parser.accepted || !G) {
    return [];
  }

  const derivacoes = [];
  let sentenca = G.original.start;

  derivacoes.push({
    regra: null,
    sentenca,
  });

  for (let i = parser.reducoes.length - 1; i >= 0; i--) {
    const productionIndex = parser.reducoes[i];

    // A produção 0 da gramática aumentada é S' -> S.
    // As produções do usuário começam no índice 1.
    const production = G.grammar.productions[productionIndex];

    if (!production || productionIndex === 0) {
      continue;
    }

    // Localiza o não terminal mais à direita.
    let pos = -1;

    for (let j = sentenca.length - 1; j >= 0; j--) {
      if (G.original.nonterminals.includes(sentenca[j])) {
        pos = j;
        break;
      }
    }

    // Uma sequência de reduções válida deve sempre encontrar
    // o não terminal correspondente.
    if (pos < 0) {
      return [];
    }

    // Substitui A por alpha na forma sentencial: beta A gamma
    //                         => beta alpha gamma
    sentenca =
      sentenca.substring(0, pos) +
      production.rhs +
      sentenca.substring(pos + 1);

    derivacoes.push({
      // productionIndex já é 1, 2, 3, ... na gramática aumentada.
      regra: productionIndex,
      sentenca,
    });
  }

  return derivacoes;
}

function renderDerivation() {
  const container = document.getElementById("derivation-content");

  if (!container) {
    return;
  }

  if (!parser || !parser.accepted) {
    container.innerHTML = "";
    return;
  }

  const derivacoes = gerarDerivacaoMaisDireita();

  if (!derivacoes.length) {
    container.innerHTML =
      '<div class="hint">Não foi possível reconstruir a derivação.</div>';
    return;
  }

  let html = '<div class="derivation-sequence">';

  derivacoes.forEach((item, index) => {
    if (index > 0) {
      html += ` <span class="derivation-arrow">=${item.regra}=&gt;</span> `;
    }

    html += `<span class="derivation-item">${escapeHTML(item.sentenca)}</span>`;
  });

  html += "</div>";

  container.innerHTML = html;
}

/* ============================================================
 * ATUALIZA SIMULAÇÃO
 * ============================================================
 */

function updateSimulation() {
  if (!parser) {
    // setText("sim-state", "—");
    // setText("sim-lookahead", "—");
    setText("sim-action", "—");
    setText("sim-message", "—");
    return;
  }

  const state = parser.stack[parser.stack.length - 1];

  const currentSymbol = parser.reduzido
    ? parser.simboloReduzido
    : parser.input[parser.ip] || "#";

  //   if (parser.reduzido) {
  //     setText("sim-state", "Estado: " + String(state) + " — 2º passo da redução");
  //   } else {
  //     setText("sim-state", "Estado: " + String(state));
  //   }

  //   setText(
  //     "sim-lookahead",
  //     parser.reduzido
  //       ? "Símbolo reduzido: " + currentSymbol
  //       : "Lookahead: " + currentSymbol,
  //   );

  setText("sim-action", "Ação: " + parser.lastAction);

  const message = document.getElementById("sim-message");

  message.textContent = "Mensagem: " + parser.message;

  message.className = "big-value";

  if (parser.accepted) {
    message.classList.add("ok");
  } else if (parser.rejected) {
    message.classList.add("error");
  }

  /*
   * =========================================================
   * TRAÇO DA ANÁLISE
   * =========================================================
   *
   * Regra:
   *
   *   linha rN  -> Símbolo Reduzido = —
   *   linha seguinte -> Símbolo Reduzido = A
   *
   * Portanto o símbolo é obtido da linha ANTERIOR,
   * e não da própria linha.
   */
  const tbody = document.querySelector("#trace-table tbody");

  tbody.innerHTML = "";

  for (let i = 0; i < parser.trace.length; i++) {
    const row = parser.trace[i];

    let reducedSymbol = "—";

    /*
     * Se a linha anterior foi uma redução, A aparece
     * nesta linha.
     */
    if (i > 0 && parser.trace[i - 1].action.startsWith("r")) {
      reducedSymbol = parser.trace[i - 1].reducedSymbol || "—";
    }

    const tr = document.createElement("tr");

    tr.innerHTML = `<td>${row.step}</td>
       <td class="item">
         ${escapeHTML(row.stack)}
       </td>
       <td>
         ${escapeHTML(reducedSymbol)}
       </td>
       <td>
         ${escapeHTML(row.input)}
       </td>
       <td>
         ${escapeHTML(row.action)}
       </td>`;

    tbody.appendChild(tr);
  }
  const scroll = tbody.closest(".scroll");

  if (scroll) {
    scroll.scrollTop = scroll.scrollHeight;
  }

  // A derivação somente é exibida quando a sentença foi aceita.
  renderDerivation();
}
/* ============================================================
 * EXEMPLO: LISTAS
 * ============================================================
 */

function loadListExample() {
  document.getElementById("grammar").value = `S -> a
S -> [L]
L -> S
L -> L,S`;

  document.getElementById("sentence").value = "[a,a]";

  build();
}

/* ============================================================
 * EXEMPLO: EXPRESSÕES
 * ============================================================
 */

function loadExpressionExample() {
  document.getElementById("grammar").value = `E -> E+T
E -> T
T -> T*F
T -> F
F -> (E)
F -> a`;

  document.getElementById("sentence").value = "a+a*a";

  build();
}

/* ============================================================
 * ESCAPE HTML
 * ============================================================
 */

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
 * REDESENHA AFD AO MOSTRAR A ABA
 * ============================================================
 */

// function drawAFD() {
//   if (afdSketch && typeof afdSketch.redraw === "function") {
//     afdSketch.redraw();
//   }
// }
