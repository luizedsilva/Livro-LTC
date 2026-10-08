let machine = null;
let tape = {};
let head = 0;
let currentState = "";
let stepCount = 0;
let configurations = [];
let running = false;
let runTimer = null;
let lastError = "";
let halted = false;
let haltReason = "";
let currentTransitionKey = null;

const BLANK = "_";

function setup() {
  const canvas = createCanvas(1000, 260);
  canvas.parent("canvas-container");
  textFont("Arial");

  document
    .getElementById("buildTable")
    .addEventListener("click", buildTransitionTable);
  document.getElementById("example1").addEventListener("click", loadExample1);
  document.getElementById("example2").addEventListener("click", loadExample2);
  document.getElementById("example3").addEventListener("click", loadExample3);
  document.getElementById("example4").addEventListener("click", loadExample4);
  document
    .getElementById("initialize")
    .addEventListener("click", initializeMachine);
  document.getElementById("step").addEventListener("click", stepMachine);
  document.getElementById("run").addEventListener("click", runMachine);
  document.getElementById("pause").addEventListener("click", pauseMachine);
  document.getElementById("reset").addEventListener("click", initializeMachine);
  document
    .getElementById("generateDiagram")
    .addEventListener("click", generateDiagram);
  document.getElementById("showDot").addEventListener("click", toggleDot);

  buildTransitionTable();
}

function windowResized() {
  const container = document.getElementById("canvas-container");
  const width = Math.max(700, container.clientWidth);
  resizeCanvas(width, 260);
}

function draw() {
  background(255);
  drawTape();
}

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildTransitionTable() {
  const states = parseList(document.getElementById("states").value);
  const alphabet = parseList(document.getElementById("tapeAlphabet").value);

  if (states.length === 0 || alphabet.length === 0) {
    return;
  }

  const container = document.getElementById("transitionTableContainer");

  let html = '<table class="transition-table">';
  html += "<thead><tr><th>Estado</th>";

  alphabet.forEach((symbol) => {
    html += `<th>${escapeHtml(symbol)}</th>`;
  });

  html += "</tr></thead><tbody>";

  states.forEach((state) => {
    html += `<tr><td class="state-cell">${escapeHtml(state)}</td>`;

    alphabet.forEach((symbol) => {
      html += `
        <td>
          <input
            class="transition-input"
            data-state="${escapeHtml(state)}"
            data-symbol="${escapeHtml(symbol)}"
            value=""
            placeholder="q1,X,D"
          >
        </td>`;
    });

    html += "</tr>";
  });

  html += "</tbody></table>";

  container.innerHTML = html;
}

function loadExample1() {
  document.getElementById("states").value = "q0,q1,q2,q3,qf,qr";
  document.getElementById("inputAlphabet").value = "0,1";
  document.getElementById("tapeAlphabet").value = "0,1,X,Y,_";
  document.getElementById("initialState").value = "q0";
  document.getElementById("acceptState").value = "qf";
  document.getElementById("rejectState").value = "qr";
  document.getElementById("inputWord").value = "0011";

  buildTransitionTable();

  // Exemplo: reconhece L = { 0^n 1^n | n >= 1 }.
  // X marca zeros já processados e Y marca uns já processados.
  const transitions = {
    "q0|0": "q1,X,D",
    "q0|1": "qr,_,D",
    "q0|X": "q0,X,D",
    "q0|Y": "q3,Y,D",
    "q0|_": "qf,_,P",

    "q1|0": "q1,0,D",
    "q1|X": "q1,X,D",
    "q1|Y": "q1,Y,D",
    "q1|1": "q2,Y,E",

    "q2|0": "q2,0,E",
    "q2|1": "q2,1,E",
    "q2|Y": "q2,Y,E",
    "q2|X": "q0,X,D",
    "q2|_": "qr,_,D",

    "q3|Y": "q3,Y,D",
    "q3|1": "qr,_,D",
    "q3|0": "qr,_,D",
    "q3|_": "qf,_,P",
  };

  document.querySelectorAll(".transition-input").forEach((input) => {
    const key = input.dataset.state + "|" + input.dataset.symbol;
    if (transitions[key] !== undefined) {
      input.value = transitions[key];
    }
  });

  setStatus("Exemplo carregado. Inicialize a máquina para começar.");
}

function loadExample2() {
  document.getElementById("states").value = "q0,q1,q2,q3,q4,q5,q6,qf,qr";
  document.getElementById("inputAlphabet").value = "a,b";
  document.getElementById("tapeAlphabet").value = "a,b,_";
  document.getElementById("initialState").value = "q0";
  document.getElementById("acceptState").value = "qf";
  document.getElementById("rejectState").value = "qr";
  document.getElementById("inputWord").value = "abba";
  buildTransitionTable();

  // Exemplo baseado na tabela apresentada.
  // D = direita
  // E = esquerda
  //
  // q0: procura o primeiro símbolo e decide o caminho.
  // q1/q3: percorrem a palavra para a direita/esquerda.
  // q4/q5/q6: segundo caminho de processamento.
  // qf: aceitação
  // qr: rejeição

  const transitions = {
    // Estado q0
    "q0|a": "q1,_,D",
    "q0|b": "q4,_,D",
    "q0|_": "qf,_,D",

    // Estado q1
    "q1|a": "q1,a,D",
    "q1|b": "q1,b,D",
    "q1|_": "q2,_,E",

    // Estado q2
    "q2|a": "q3,_,E",
    "q2|b": "qr,_,D",
    "q2|_": "qr,_,D",

    // Estado q3
    "q3|a": "q3,a,E",
    "q3|b": "q3,b,E",
    "q3|_": "q0,_,D",

    // Estado q4
    "q4|a": "q4,a,D",
    "q4|b": "q4,b,D",
    "q4|_": "q5,_,E",

    // Estado q5
    "q5|a": "qr,_,D",
    "q5|b": "q6,_,E",
    "q5|_": "qr,_,D",

    // Estado q6
    "q6|a": "q6,a,E",
    "q6|b": "q6,b,E",
    "q6|_": "q0,_,D",
  };

  document.querySelectorAll(".transition-input").forEach((input) => {
    const key = input.dataset.state + "|" + input.dataset.symbol;

    if (transitions[key] !== undefined) {
      input.value = transitions[key];
    }
  });

  setStatus("Exemplo carregado. Inicialize a máquina para começar.");
}

function loadExample3() {
  document.getElementById("states").value =
    "q0,qa,qb,qa2,qb2,qret,qcheck,qf,qr";
  document.getElementById("inputAlphabet").value = "a,b,.";
  document.getElementById("tapeAlphabet").value = "a,b,x,.,_";
  document.getElementById("initialState").value = "q0";
  document.getElementById("acceptState").value = "qf";
  document.getElementById("rejectState").value = "qr";
  document.getElementById("inputWord").value = "ab.ab";
  buildTransitionTable();

  /*
   * L = { w.w | w ∈ {a,b}* }
   *
   * A entrada possui o ponto separando as duas cópias:
   *
   *     ab.ab
   *
   * A máquina marca os símbolos processados com x.
   *
   * D = direita
   * E = esquerda
   */

  const transitions = {
    // --------------------------------------------------------
    // q0: procura o próximo símbolo da primeira palavra
    // --------------------------------------------------------

    "q0|x": "q0,x,D",

    // Encontrou 'a': marca e procura o 'a' correspondente
    "q0|a": "qa,x,D",

    // Encontrou 'b': marca e procura o 'b' correspondente
    "q0|b": "qb,x,D",

    // Todos os símbolos da primeira parte foram marcados
    "q0|.": "qcheck,.,D",

    // --------------------------------------------------------
    // qa: procura o próximo símbolo da segunda parte
    //      que deve ser 'a'
    // --------------------------------------------------------

    "qa|a": "qa,a,D",
    "qa|b": "qa,b,D",
    "qa|x": "qa,x,D",

    // Passa pelo ponto
    "qa|.": "qa2,.,D",

    // qa2: encontra o próximo símbolo não marcado
    "qa2|x": "qa2,x,D",

    // Encontrou a correspondente
    "qa2|a": "qret,x,E",

    // Encontrou b: erro
    "qa2|b": "qr,b,D",

    // Terminou antes de encontrar a
    "qa2|_": "qr,_,D",

    // --------------------------------------------------------
    // qb: procura o próximo símbolo da segunda parte
    //      que deve ser 'b'
    // --------------------------------------------------------

    "qb|a": "qb,a,D",
    "qb|b": "qb,b,D",
    "qb|x": "qb,x,D",

    // Passa pelo ponto
    "qb|.": "qb2,.,D",

    // --------------------------------------------------------
    // qb2: encontra o próximo símbolo não marcado
    // --------------------------------------------------------

    "qb2|x": "qb2,x,D",

    // Encontrou b correspondente
    "qb2|b": "qret,x,E",

    // Encontrou a: erro
    "qb2|a": "qr,a,D",

    // Terminou antes de encontrar b
    "qb2|_": "qr,_,D",

    // --------------------------------------------------------
    // qret: volta para o início da fita
    // --------------------------------------------------------

    "qret|a": "qret,a,E",
    "qret|b": "qret,b,E",
    "qret|x": "qret,x,E",
    "qret|.": "qret,.,E",

    // Início da fita
    "qret|_": "q0,_,D",

    // --------------------------------------------------------
    // qcheck: verifica a segunda parte
    // --------------------------------------------------------

    "qcheck|x": "qcheck,x,D",

    // Se ainda existe a ou b, as palavras têm tamanhos
    // diferentes ou a primeira parte foi menor.
    "qcheck|a": "qr,a,D",
    "qcheck|b": "qr,b,D",

    // Fim da fita: tudo foi marcado
    "qcheck|_": "qf,_,D",
  };

  document.querySelectorAll(".transition-input").forEach((input) => {
    const key = input.dataset.state + "|" + input.dataset.symbol;

    if (transitions[key] !== undefined) {
      input.value = transitions[key];
    }
  });

  setStatus("Exemplo carregado. Inicialize a máquina para começar.");
}

function loadExample4() {
  document.getElementById("states").value =
    "q0,q1,q2,q3,q4," +
    "b1,b2,b3,b4,b5,b6,b7,b8,b9," +
    "o1,o2,o3,o4," +
    "q2a,q2b," +
    "p1,p2," +
    "f1,f2,f3," +
    "qf,qr";

  document.getElementById("inputAlphabet").value = "0,1";

  document.getElementById("tapeAlphabet").value = "0,1,x,ə,_";

  document.getElementById("initialState").value = "q0";

  // A máquina de Turing de Turing é uma máquina geradora;
  // ela não possui estado final.
  // qf e qr ficam apenas para satisfazer a interface do simulador.
  document.getElementById("acceptState").value = "qf";
  document.getElementById("rejectState").value = "qr";

  // A máquina começa com a fita em branco.
  document.getElementById("inputWord").value = "";

  buildTransitionTable();

  const transitions = {
    /*
     * =========================================================
     * b
     *
     * Pə, R, Pə, R, P0, R, R, P0, L, L
     * =========================================================
     */

    "q0|_": "b1,ə,P",
    "b1|ə": "b2,ə,D",
    "b2|_": "b3,ə,P",
    "b3|ə": "b4,ə,D",
    "b4|_": "b5,0,P",
    "b5|0": "b6,0,D",
    "b6|_": "b7,_,D",
    "b7|_": "b8,0,P",
    "b8|0": "b9,0,E",
    "b9|_": "q1,_,E",

    /*
     * =========================================================
     * o
     *
     * 1 -> R, Px, L, L, L
     * 0 -> nenhuma operação
     * =========================================================
     */

    // R
    "q1|1": "o1,1,D",
    // Px
    "o1|_": "o2,x,P",
    // primeiro L
    "o2|x": "o3,x,E",
    // segundo L
    // Pode encontrar qualquer símbolo.
    "o3|0": "o4,0,E",
    "o3|1": "o4,1,E",
    "o3|x": "o4,x,E",
    "o3|ə": "o4,ə,E",
    "o3|_": "o4,_,E",
    // terceiro L
    // Pode encontrar qualquer símbolo.
    "o4|0": "q1,0,E",
    "o4|1": "q1,1,E",
    "o4|x": "q1,x,E",
    "o4|ə": "q1,ə,E",
    "o4|_": "q1,_,E",
    // 0 -> nenhuma operação
    "q1|0": "q2,0,P",

    /*
     * =========================================================
     * q
     *
     * Any (0 ou 1) -> R,R
     * None         -> P1,L
     * =========================================================
     */

    // primeiro R
    "q2|0": "q2a,0,D",
    "q2|1": "q2a,1,D",

    // segundo R
    //
    // Depois do primeiro movimento, qualquer símbolo pode
    // estar sob o cabeçote.
    "q2a|0": "q2,0,D",
    "q2a|1": "q2,1,D",
    "q2a|x": "q2,x,D",
    "q2a|ə": "q2,ə,D",
    "q2a|_": "q2,_,D",

    // None -> P1
    "q2|_": "q2b,1,P",

    // L
    "q2b|1": "q3,1,E",

    /*
     * =========================================================
     * p
     *
     * x    -> E,R
     * ə    -> R
     * None -> L,L
     * =========================================================
     */

    // x -> E
    "q3|x": "p1,_,P",

    // R
    "p1|_": "q2,_,D",

    // ə -> R
    "q3|ə": "q4,ə,D",

    // None -> primeiro L
    "q3|_": "p2,_,E",

    // segundo L
    //
    // Pode encontrar qualquer símbolo.
    "p2|0": "q3,0,E",
    "p2|1": "q3,1,E",
    "p2|x": "q3,x,E",
    "p2|ə": "q3,ə,E",
    "p2|_": "q3,_,E",

    /*
     * =========================================================
     * f
     *
     * Any  -> R,R
     * None -> P0,L,L
     * =========================================================
     */

    // ---------------------------------------------------------
    // Any -> primeiro R
    // ---------------------------------------------------------

    "q4|0": "f1,0,D",
    "q4|1": "f1,1,D",
    "q4|x": "f1,x,D",
    "q4|ə": "f1,ə,D",
    "q4|_": "f1,_,D",

    // ---------------------------------------------------------
    // segundo R
    //
    // IMPORTANTE: f1 também pode estar sobre branco.
    // ---------------------------------------------------------

    "f1|0": "q4,0,D",
    "f1|1": "q4,1,D",
    "f1|x": "q4,x,D",
    "f1|ə": "q4,ə,D",
    "f1|_": "q4,_,D",

    // ---------------------------------------------------------
    // None -> P0
    // ---------------------------------------------------------

    "q4|_": "f2,0,P",

    // ---------------------------------------------------------
    // primeiro L
    // ---------------------------------------------------------

    "f2|0": "f3,0,E",
    "f2|1": "f3,1,E",
    "f2|x": "f3,x,E",
    "f2|ə": "f3,ə,E",
    "f2|_": "f3,_,E",

    // ---------------------------------------------------------
    // segundo L
    // ---------------------------------------------------------

    "f3|0": "q1,0,E",
    "f3|1": "q1,1,E",
    "f3|x": "q1,x,E",
    "f3|ə": "q1,ə,E",
    "f3|_": "q1,_,E",
  };

  document.querySelectorAll(".transition-input").forEach((input) => {
    const key = input.dataset.state + "|" + input.dataset.symbol;
    if (transitions[key] !== undefined) {
      input.value = transitions[key];
    }
  });

  setStatus("Exemplo carregado. Inicialize a máquina para começar.");
}

function readMachine() {
  const states = parseList(document.getElementById("states").value);
  const inputAlphabet = parseList(
    document.getElementById("inputAlphabet").value,
  );
  const tapeAlphabet = parseList(document.getElementById("tapeAlphabet").value);
  const initialState = document.getElementById("initialState").value.trim();
  const acceptState = document.getElementById("acceptState").value.trim();
  const rejectState = document.getElementById("rejectState").value.trim();
  const inputWord = document.getElementById("inputWord").value;

  if (!tapeAlphabet.includes(BLANK)) {
    throw new Error(
      "O alfabeto da fita deve conter o símbolo _ para representar o branco.",
    );
  }

  if (!states.includes(initialState)) {
    throw new Error(
      `O estado inicial "${initialState}" não está na lista de estados.`,
    );
  }

  if (!states.includes(acceptState)) {
    throw new Error(
      `O estado de aceitação "${acceptState}" não está na lista de estados.`,
    );
  }

  const transitions = {};

  document.querySelectorAll(".transition-input").forEach((input) => {
    const state = input.dataset.state;
    const symbol = input.dataset.symbol;
    const value = input.value.trim();

    if (!value) {
      return;
    }

    const parts = value.split(",").map((x) => x.trim());

    if (parts.length !== 3) {
      throw new Error(
        `Transição inválida em (${state}, ${symbol}). Use o formato q1,X,R.`,
      );
    }

    const [nextState, writeSymbol, move] = parts;

    if (!states.includes(nextState)) {
      throw new Error(`O estado de destino "${nextState}" não existe.`);
    }

    if (!tapeAlphabet.includes(writeSymbol)) {
      throw new Error(
        `O símbolo "${writeSymbol}" escrito pela transição (${state}, ${symbol}) ` +
          `não pertence ao alfabeto da fita.`,
      );
    }

    if (!["E", "D", "P"].includes(move)) {
      throw new Error(`Movimento "${move}" inválido. Use E, D ou P.`);
    }

    transitions[state + "|" + symbol] = {
      nextState,
      writeSymbol,
      move,
    };
  });

  for (const char of inputWord) {
    if (!inputAlphabet.includes(char)) {
      throw new Error(
        `O símbolo "${char}" da palavra de entrada não pertence ao alfabeto de entrada.`,
      );
    }
  }

  return {
    states,
    inputAlphabet,
    tapeAlphabet,
    initialState,
    acceptState,
    rejectState,
    inputWord,
    transitions,
  };
}

function initializeMachine() {
  pauseMachine();

  try {
    machine = readMachine();

    tape = {};

    for (let i = 0; i < machine.inputWord.length; i++) {
      tape[i] = machine.inputWord[i];
    }

    head = 0;
    currentState = machine.initialState;
    stepCount = 0;
    configurations = [];
    halted = false;
    haltReason = "";
    currentTransitionKey = null;

    addConfiguration();
    updateInterface();

    /*
     * Ao inicializar, nenhuma transição está sendo executada.
     * Portanto, o diagrama deve aparecer sem destaque.
     */
    currentTransitionKey = null;
    updateDiagramHighlight();

    setStatus("Máquina inicializada. Pronta para executar.");
    lastError = "";
  } catch (error) {
    machine = null;
    lastError = error.message;
    setStatus("Erro: " + error.message, "error");
  }
}

function stepMachine() {
  if (!machine) {
    initializeMachine();
    if (!machine) {
      return;
    }
  }

  if (isHalted()) {
    return;
  }

  const symbol = readTape(head);
  const key = currentState + "|" + symbol;
  const transition = machine.transitions[key];

  if (!transition) {
    halted = true;
    haltReason = `não existe transição para (${currentState}, ${symbol})`;

    /*
     * Não há transição sendo executada neste passo.
     * Remove o destaque da transição anterior.
     */
    currentTransitionKey = null;

    setStatus(`Computação interrompida: ${haltReason}.`, "reject");
    updateInterface();
    updateDiagramHighlight();
    return;
  }

  currentTransitionKey = key;
  writeTape(head, transition.writeSymbol);

  if (transition.move === "E") {
    head--;
  } else if (transition.move === "D") {
    head++;
  }

  currentState = transition.nextState;
  stepCount++;

  addConfiguration();
  updateInterface();

  if (currentState === machine.acceptState) {
    halted = true;
    haltReason = "aceitação";
    setStatus("A palavra foi ACEITA.", "accept");
  } else if (currentState === machine.rejectState) {
    halted = true;
    haltReason = "rejeição";
    setStatus("A palavra foi REJEITADA.", "reject");
  } else if (stepCount >= 1000) {
    halted = true;
    haltReason = "limite de 1000 passos atingido";
    setStatus(
      "Computação interrompida: limite de 1000 passos atingido.",
      "reject",
    );
  } else {
    setStatus(`Passo ${stepCount} executado.`);
  }
}

function runMachine() {
  if (!machine) {
    initializeMachine();
  }

  if (!machine || isHalted()) {
    return;
  }

  if (running) {
    return;
  }

  running = true;
  scheduleNextStep();
}

function scheduleNextStep() {
  if (!running) {
    return;
  }

  stepMachine();

  if (!isHalted() && running) {
    const speed = Number(document.getElementById("speed").value);
    const delay = map(speed, 1, 10, 1000, 80);
    runTimer = setTimeout(scheduleNextStep, delay);
  } else {
    running = false;
  }
}

function pauseMachine() {
  running = false;

  if (runTimer !== null) {
    clearTimeout(runTimer);
    runTimer = null;
  }

  updateInterface();
}

function isHalted() {
  return halted;
}

function addConfiguration() {
  configurations.push({
    state: currentState,
    head,
    tape: { ...tape },
    step: stepCount,
  });

  if (configurations.length > 1000) {
    configurations.shift();
  }

  updateInterface();
}

function readTape(position) {
  return tape[position] ?? BLANK;
}

function writeTape(position, symbol) {
  if (symbol === BLANK) {
    delete tape[position];
  } else {
    tape[position] = symbol;
  }
}

function configurationToString(config) {
  const positions = Object.keys(config.tape).map(Number);

  let min = Math.min(
    config.head,
    positions.length ? Math.min(...positions) : 0,
  );
  let max = Math.max(
    config.head,
    positions.length ? Math.max(...positions) : 0,
  );

  min = Math.min(min, -2);
  max = Math.max(max, min + 4);

  let left = "";
  let right = "";

  for (let i = min; i < config.head; i++) {
    left += readTapeFromConfig(config, i);
  }

  const underHead = readTapeFromConfig(config, config.head);

  for (let i = config.head + 1; i <= max; i++) {
    right += readTapeFromConfig(config, i);
  }

  return `⟨${left}, ${config.state}, ${underHead}${right}⟩`;
}

function readTapeFromConfig(config, position) {
  return config.tape[position] ?? BLANK;
}

function updateInterface() {
  const current = configurations[configurations.length - 1];

  if (current) {
    document.getElementById("currentConfiguration").textContent =
      configurationToString(current);
  } else {
    document.getElementById("currentConfiguration").textContent = "—";
  }

  const computation = document.getElementById("computation");

  if (configurations.length === 0) {
    computation.textContent = "Inicialize a máquina para começar.";
    return;
  }

  computation.innerHTML = configurations
    .map((config, index) => {
      const currentClass =
        index === configurations.length - 1 ? " current" : "";

      return `
        <div class="config-line${currentClass}">
          ${index}: ${escapeHtml(configurationToString(config))}
        </div>`;
    })
    .join("");

  computation.scrollTop = computation.scrollHeight;
  updateDiagramHighlight();
}

function generateDiagram() {
  try {
    const m = readMachine();
    const dot = machineToDot(m);
    const output = document.getElementById("dotOutput");
    output.textContent = dot;
    output.dataset.dot = dot;

    const container = document.getElementById("diagramContainer");
    container.innerHTML =
      '<div class="diagram-placeholder">Gerando diagrama...</div>';

    if (typeof Viz === "undefined") {
      container.innerHTML =
        '<div class="diagram-placeholder">Biblioteca Graphviz (Viz.js) não carregada.</div>';
      return;
    }

    const viz = new Viz();
    viz
      .renderSVGElement(dot)
      .then((svg) => {
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.style.maxWidth = "100%";
        svg.style.height = "auto";
        container.innerHTML = "";
        container.appendChild(svg);
        updateDiagramHighlight();
      })
      .catch((error) => {
        console.error(error);
        container.innerHTML = `<div class="diagram-placeholder">Erro ao gerar o diagrama: ${escapeHtml(error.message || error)}</div>`;
      });
  } catch (error) {
    setStatus("Erro ao gerar o diagrama: " + error.message, "error");
  }
}

function toggleDot() {
  const output = document.getElementById("dotOutput");
  if (!output.dataset.dot) {
    generateDiagram();
  }
  output.classList.toggle("hidden");
}

function dotQuote(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("<", "\\<")
    .replaceAll(">", "\\>");
}

function machineToDot(m) {
  const stateIds = {};
  m.states.forEach((state, i) => (stateIds[state] = "s" + i));

  let dot = `digraph MT {\n`;
  dot += `  rankdir=LR;\n`;
  dot += `  graph [bgcolor="white", nodesep=0.55, ranksep=0.8, pad=0.25];\n`;
  dot += `  node [shape=circle, fontname="Arial", fontsize=12, style="filled", fillcolor="white"];\n`;
  dot += `  edge [fontname="Arial", fontsize=10, arrowsize=0.8];\n\n`;
  dot += `  start [shape=point, width=0.12, label=""];\n`;
  dot += `  start -> ${stateIds[m.initialState]};\n`;

  m.states.forEach((state) => {
    const id = stateIds[state];
    let attrs = [`label="${dotQuote(state)}"`];
    if (state === m.acceptState) attrs.push("shape=doublecircle");
    if (state === m.rejectState) attrs.push('fillcolor="#fdecec"');
    dot += `  ${id} [${attrs.join(", ")}];\n`;
  });

  // Agrupa transições com mesma origem e destino.
  const grouped = {};
  Object.entries(m.transitions).forEach(([key, tr]) => {
    const [state, read] = key.split("|");
    const groupKey = `${state}|${tr.nextState}`;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push({ read, tr });
  });

  Object.entries(grouped).forEach(([groupKey, items]) => {
    const [from, to] = groupKey.split("|");
    const labels = items.map(
      (item) => `${item.read} / ${item.tr.writeSymbol},${item.tr.move}`,
    );
    const transitionKeys = items.map((item) => `${from}|${item.read}`);

    // Cada rótulo é escapado individualmente. O \n    // entre os rótulos NÃO deve passar por dotQuote(),
    // pois Graphviz usa \n    // dentro de label para criar uma quebra de linha.
    const title = labels.map(dotQuote).join("\\n");
    const id = `e_${stateIds[from]}_${stateIds[to]}_${Math.abs(hashCode(transitionKeys.join(";")))}`;
    dot += `  ${stateIds[from]} -> ${stateIds[to]} [id="${id}", label="${title}"];\n`;
  });

  dot += `}\n`;
  return dot;
}

function hashCode(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function updateDiagramHighlight() {
  const container = document.getElementById("diagramContainer");
  if (!container) return;

  /*
   * Primeiro remove TODO destaque anterior.
   */
  container.querySelectorAll(".active-edge").forEach((edge) => {
    edge.classList.remove("active-edge");

    edge.querySelectorAll("path, polygon").forEach((el) => {
      el.style.stroke = "";
      el.style.strokeWidth = "";
    });

    edge.querySelectorAll("text").forEach((el) => {
      el.style.fill = "";
      el.style.fontWeight = "";
    });
  });

  /*
   * Não há transição ativa.
   */
  if (!machine || !currentTransitionKey) {
    return;
  }

  const tr = machine.transitions[currentTransitionKey];
  if (!tr) return;

  const [from, read] = currentTransitionKey.split("|");
  const to = tr.nextState;

  /*
   * IMPORTANTE:
   *
   * Não procuramos mais a transição pelo texto do rótulo.
   *
   * Isso causava o problema mostrado na figura: se duas arestas
   * possuíam um rótulo igual, todas eram destacadas.
   *
   * O machineToDot() cria um ID único para cada aresta agrupada,
   * usando:
   *
   *   origem + destino + hash das transições daquele grupo.
   *
   * Reproduzimos exatamente esse ID aqui e destacamos SOMENTE
   * o grupo de aresta correspondente à transição atual.
   */

  const grouped = {};

  Object.entries(machine.transitions).forEach(([key, transition]) => {
    const [state, symbol] = key.split("|");
    const groupKey = `${state}|${transition.nextState}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }

    grouped[groupKey].push({
      read: symbol,
      tr: transition,
    });
  });

  const groupKey = `${from}|${to}`;
  const items = grouped[groupKey];

  if (!items) return;

  const transitionKeys = items.map((item) => `${from}|${item.read}`);

  const stateIds = {};

  machine.states.forEach((state, i) => {
    stateIds[state] = "s" + i;
  });

  const edgeId =
    `e_${stateIds[from]}_${stateIds[to]}_` +
    `${Math.abs(hashCode(transitionKeys.join(";")))}`;

  /*
   * Procura o grupo SVG pelo ID criado em machineToDot().
   */
  const edges = container.querySelectorAll("g.edge");

  edges.forEach((edge) => {
    if (edge.getAttribute("id") !== edgeId) {
      return;
    }

    /*
     * SOMENTE ESTA ARESTA É DESTACADA.
     */
    edge.classList.add("active-edge");

    edge.querySelectorAll("path, polygon").forEach((el) => {
      el.style.stroke = "#d97706";
      el.style.strokeWidth = "3px";
    });

    edge.querySelectorAll("text").forEach((el) => {
      el.style.fill = "#b45309";
      el.style.fontWeight = "bold";
    });
  });
}

function setStatus(message, type = "") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status";

  if (type) {
    status.classList.add(type);
  }
}

function drawTape() {
  const cellSize = 48;
  const centerX = width / 2;
  const y = 100;
  const visibleCells = Math.floor(width / cellSize);

  const start = head - Math.floor(visibleCells / 2);

  stroke(80);
  strokeWeight(1);
  textAlign(CENTER, CENTER);

  for (let i = 0; i < visibleCells + 1; i++) {
    const position = start + i;
    const x = centerX + (position - head) * cellSize;

    if (position === head) {
      fill(255, 243, 191);
    } else {
      fill(250);
    }

    rect(x, y, cellSize, cellSize);

    fill(35);
    noStroke();
    text(readTape(position), x + cellSize / 2, y + cellSize / 2);

    stroke(80);
  }

  noStroke();
  fill(40);
  textSize(15);
  text(`Estado: ${currentState || "—"}`, centerX, 45);

  fill(90);
  textSize(13);
  text(`Passo: ${stepCount}`, centerX, 68);

  fill(35);
  textSize(12);
  text("cabeçote", centerX + cellSize / 2, y + cellSize + 30);

  noStroke();
  fill(35);
  triangle(
    centerX + cellSize / 2,
    y + cellSize + 5,
    centerX + cellSize / 2 + 10,
    y + cellSize + 20,
    centerX + cellSize / 2 - 10,
    y + cellSize + 20,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
