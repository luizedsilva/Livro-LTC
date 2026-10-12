const EXAMPLE1 = `\tINPP
\tAMEM 2
\tCRCT 7
\tARZG 0
\tCRCT 5
\tARZG 1
\tCRVG 0
\tCRVG 1
\tSOMA
\tESCR
\tFIMP`;

const EXAMPLE2 = `\tINPP
\tAMEM 2
\tCRCT 5
\tARZG 0
L1\tNADA
\tCRVG 0
\tCRCT 1
\tCMMA
\tDSVF L2
\tCRVG 0
\tESCR
\tCRVG 0
\tCRCT 1
\tSUBT
\tARZG 0
\tDSVS L1
L2\tNADA
\tFIMP`;

let program = [];
let labels = {};
let memory = [];
let s = 0;
let i = 0;
let running = false;
let halted = false;
let waitingInput = false;
let inputValues = [];
let inputCursor = 0;
let terminalLines = [];
let lastInstruction = -1;
let currentMessage = "Carregue o programa para iniciar.";
let currentError = false;
let animationTimer = null;
let p5Instance = null;

const $ = (id) => document.getElementById(id);
const aliases = {
  CRVL: "CRVG",
  ARMZ: "ARZG",
  INVE: "INVE",
  CMEN: "CMME",
  CMLE: "CMEG",
  CMGR: "CMMA",
  CMGE: "CMAG",
  AND: "CONJ",
  OR: "DISJ",
  NOT: "NEGA",
};
const known = new Set([
  "INPP",
  "AMEM",
  "DMEM",
  "CRCT",
  "CRVG",
  "ARZG",
  "SOMA",
  "SUBT",
  "MULT",
  "DIVI",
  "INVE",
  "CMIG",
  "CMDG",
  "CMME",
  "CMEG",
  "CMMA",
  "CMAG",
  "CONJ",
  "DISJ",
  "NEGA",
  "DSVS",
  "DSVF",
  "NADA",
  "LEIA",
  "ESCR",
  "FIMP",
]);

function updateLineNumbers() {
  const editor = $("code");
  const gutter = $("lineNumbers");
  if (!editor || !gutter) return;
  const count = editor.value.split("\n").length;
  gutter.textContent = Array.from(
    { length: count },
    (_, index) => index + 1,
  ).join("\n");
  gutter.scrollTop = editor.scrollTop;
}
function syncEditorScroll() {
  $("lineNumbers").scrollTop = $("code").scrollTop;
}

function setStatus(message, isError = false) {
  currentMessage = message;
  currentError = isError;
  $("status").textContent = message;
  $("status").className = "status" + (isError ? " error" : "");
}
function addTerminal(text, kind = "sys") {
  terminalLines.push({ text: String(text), kind });
  renderTerminal();
}
function renderTerminal() {
  const box = $("terminal");
  box.innerHTML = "";
  for (const line of terminalLines) {
    const span = document.createElement("span");
    span.className = line.kind;
    span.textContent = line.text + "\n";
    box.appendChild(span);
  }
  box.scrollTop = box.scrollHeight;
}
function clearTerminal() {
  terminalLines = [];
  renderTerminal();
}
function parseProgram(source) {
  const parsed = [];
  const labelMap = {};
  const rawLines = source.split(/\r?\n/);

  for (let lineNo = 0; lineNo < rawLines.length; lineNo++) {
    const original = rawLines[lineNo];
    // Remove comentários sem eliminar a indentação, pois ela define a sintaxe.
    let text = original.replace(/\/\/.*$/, "").replace(/#.*$/, "");
    if (!text.trim()) continue;

    let label = null;
    let instructionText = "";

    if (text.startsWith("\t")) {
      // Instrução sem rótulo: deve começar por TAB.
      instructionText = text.slice(1).trim();
      if (!instructionText) {
        throw new Error(`Instrução ausente após TAB na linha ${lineNo + 1}.`);
      }
    } else {
      // Linha com rótulo: LABEL<TAB>NADA. Rótulos não usam dois-pontos.
      const tabPos = text.indexOf("\t");
      if (tabPos < 1) {
        throw new Error(
          `Linha ${lineNo + 1}: use TAB antes de instruções sem rótulo ou escreva "RÓTULO<TAB>NADA" para declarar um rótulo.`,
        );
      }
      label = text.slice(0, tabPos).trim().toUpperCase();
      instructionText = text.slice(tabPos + 1).trim();

      if (!/^[A-Z_][A-Z0-9_]*$/.test(label)) {
        throw new Error(
          `Rótulo inválido "${label}" na linha ${lineNo + 1}. Não use dois-pontos.`,
        );
      }
      if (!instructionText) {
        throw new Error(
          `Linha ${lineNo + 1}: o rótulo deve ser seguido de TAB e NADA.`,
        );
      }
      const labelParts = instructionText.split(/\s+/);
      if (labelParts[0].toUpperCase() !== "NADA" || labelParts.length !== 1) {
        throw new Error(
          `Linha ${lineNo + 1}: uma declaração de rótulo deve ter o formato "RÓTULO<TAB>NADA".`,
        );
      }
      if (Object.prototype.hasOwnProperty.call(labelMap, label)) {
        throw new Error(`Rótulo duplicado "${label}" na linha ${lineNo + 1}.`);
      }
      labelMap[label] = parsed.length;
    }

    const parts = instructionText.split(/\s+/);
    let op = parts.shift().toUpperCase();
    op = aliases[op] || op;
    if (!known.has(op)) {
      throw new Error(`Instrução desconhecida "${op}" na linha ${lineNo + 1}.`);
    }

    if (label !== null && (op !== "NADA" || parts.length !== 0)) {
      throw new Error(
        `Linha ${lineNo + 1}: rótulos devem ser declarados com NADA.`,
      );
    }

    parsed.push({
      op,
      args: parts,
      label,
      operand: parts.length ? parts[0] : null,
      lineNo: lineNo + 1,
      source: original.trimStart(),
      target: null,
    });
  }

  for (let pc = 0; pc < parsed.length; pc++) {
    const ins = parsed[pc];
    if (["CRCT", "CRVG", "ARZG", "AMEM", "DMEM"].includes(ins.op)) {
      if (ins.args.length !== 1 || !Number.isFinite(Number(ins.args[0]))) {
        throw new Error(
          `${ins.op} exige um argumento numérico (linha ${ins.lineNo}).`,
        );
      }
      ins.arg = Number(ins.args[0]);
      if (
        ["AMEM", "DMEM"].includes(ins.op) &&
        (!Number.isInteger(ins.arg) || ins.arg < 0)
      )
        throw new Error(
          `${ins.op} exige um inteiro não negativo (linha ${ins.lineNo}).`,
        );
      if (
        ["CRVG", "ARZG"].includes(ins.op) &&
        (!Number.isInteger(ins.arg) || ins.arg < 0)
      )
        throw new Error(
          `${ins.op} exige um endereço inteiro não negativo (linha ${ins.lineNo}).`,
        );
    } else if (["DSVS", "DSVF"].includes(ins.op)) {
      if (ins.args.length !== 1)
        throw new Error(
          `${ins.op} exige um rótulo ou índice de instrução (linha ${ins.lineNo}).`,
        );
      const dest = ins.args[0].toUpperCase();
      if (Object.prototype.hasOwnProperty.call(labelMap, dest))
        ins.target = labelMap[dest];
      else if (/^\d+$/.test(dest)) ins.target = Number(dest);
      else
        throw new Error(
          `Rótulo de desvio "${dest}" não definido (linha ${ins.lineNo}).`,
        );
      if (ins.target < 0 || ins.target >= parsed.length)
        throw new Error(
          `Destino de desvio fora de P: ${dest} (linha ${ins.lineNo}).`,
        );
    } else if (ins.args.length) {
      throw new Error(`${ins.op} não recebe argumentos (linha ${ins.lineNo}).`);
    }
  }
  return { program: parsed, labels: labelMap };
}
function loadProgram(resetTerminal = true) {
  stopRun();
  try {
    const result = parseProgram($("code").value);
    program = result.program;
    labels = result.labels;
    resetMachine(resetTerminal);
    setStatus(
      `Programa carregado: ${program.length} instruções. Pressione “Executar passo” ou “Executar tudo”.`,
    );
    return true;
  } catch (e) {
    program = [];
    labels = {};
    setStatus(e.message, true);
    return false;
  }
}
function resetMachine(resetTerminal = true) {
  memory = [];
  s = 0;
  i = 0;
  running = false;
  halted = false;
  waitingInput = false;
  inputValues = $("stdin")
    .value.split(/\r?\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  inputCursor = 0;
  lastInstruction = -1;
  if (resetTerminal) clearTerminal();
  $("regI").value = program.length ? "0" : "—";
  $("regS").value = "0";
  updateButtons();
  redrawViz();
}
function stopRun() {
  running = false;
  if (animationTimer !== null) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
  updateButtons();
}
function updateButtons() {
  $("step").disabled = halted || program.length === 0 || running;
  $("run").disabled = halted || program.length === 0 || running;
  $("pause").disabled = !running;
}
function fail(message) {
  stopRun();
  halted = true;
  setStatus(message, true);
  addTerminal("ERRO: " + message, "err");
  updateRegisters();
  redrawViz();
}
function updateRegisters() {
  $("regI").value = program.length
    ? i < program.length
      ? String(i)
      : "fim"
    : "—";
  $("regS").value = String(s);
}
function push(value) {
  memory[s] = value;
  s++;
}
function pop() {
  if (s <= 0) throw new Error("Pilha vazia: não há operando disponível.");
  s--;
  const value = memory[s];
  return value;
}
function peek() {
  if (s <= 0) throw new Error("Pilha vazia: não há operando disponível.");
  return memory[s - 1];
}
function readValue(text) {
  const t = text.trim();
  if (/^(verdadeiro|true)$/i.test(t)) return true;
  if (/^(falso|false)$/i.test(t)) return false;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
    return t.slice(1, -1);
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
    return t.slice(1, -1);
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  return t;
}
function truth(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}
function formatValue(value) {
  if (typeof value === "boolean") return value ? "verdadeiro" : "falso";
  if (typeof value === "number" && Number.isFinite(value))
    return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(8)));
  return String(value);
}
function requireMemoryAddress(address) {
  if (!Number.isInteger(address) || address < 0 || address >= memory.length)
    throw new Error(
      `Endereço M[${address}] inválido. Use AMEM para reservar memória antes de acessar variáveis.`,
    );
}
function binary(fn) {
  const b = pop();
  const a = pop();
  push(fn(a, b));
}
function executeOne() {
  if (halted) return false;
  if (!program.length) {
    setStatus("Carregue um programa antes de executar.", true);
    return false;
  }
  if (i < 0 || i >= program.length) {
    halted = true;
    stopRun();
    setStatus(
      "Execução encerrada: o registrador i saiu dos limites do programa.",
    );
    updateRegisters();
    redrawViz();
    updateButtons();
    return false;
  }
  const pc = i;
  const ins = program[i];
  lastInstruction = pc;
  waitingInput = false;
  try {
    // Por padrão, avança para a próxima instrução; desvios substituem i.
    i++;
    switch (ins.op) {
      case "INPP":
        memory = [];
        s = 0;
        break;
      case "AMEM":
        for (let n = 0; n < ins.arg; n++) {
          memory[s] = 0;
          s++;
        }
        break;
      case "DMEM":
        if (ins.arg > s)
          throw new Error(
            `DMEM ${ins.arg} tenta liberar mais posições que o tamanho atual da memória.`,
          );
        for (let n = 0; n < ins.arg; n++) {
          s--;
          delete memory[s];
        }
        break;
      case "CRCT":
        push(ins.arg);
        break;
      case "CRVG":
        requireMemoryAddress(ins.arg);
        push(memory[ins.arg]);
        break;
      case "ARZG": {
        if (s <= 0) throw new Error("ARZG exige um valor no topo da pilha.");
        requireMemoryAddress(ins.arg);
        const value = pop();
        memory[ins.arg] = value;
        break;
      }
      case "SOMA":
        binary((a, b) => a + b);
        break;
      case "SUBT":
        binary((a, b) => a - b);
        break;
      case "MULT":
        binary((a, b) => a * b);
        break;
      case "DIVI":
        binary((a, b) => {
          if (Number(b) === 0) throw new Error("Divisão por zero.");
          return Number(a) / Number(b);
        });
        break;
      case "INVE": {
        const a = pop();
        push(-Number(a));
        break;
      }
      case "CMIG":
        binary((a, b) => a === b);
        break;
      case "CMDG":
        binary((a, b) => a !== b);
        break;
      case "CMME":
        binary((a, b) => a < b);
        break;
      case "CMEG":
        binary((a, b) => a <= b);
        break;
      case "CMMA":
        binary((a, b) => a > b);
        break;
      case "CMAG":
        binary((a, b) => a >= b);
        break;
      case "CONJ":
        binary((a, b) => truth(a) && truth(b));
        break;
      case "DISJ":
        binary((a, b) => truth(a) || truth(b));
        break;
      case "NEGA": {
        const a = pop();
        push(!truth(a));
        break;
      }
      case "DSVS":
        i = ins.target;
        break;
      case "DSVF": {
        const condition = pop();
        if (!truth(condition)) i = ins.target;
        break;
      }
      case "NADA":
        break;
      case "LEIA":
        if (inputCursor >= inputValues.length) {
          i = pc;
          waitingInput = true;
          throw new Error(
            "Entrada necessária: informe mais valores na caixa de entrada e carregue o programa novamente.",
          );
        }
        const value = readValue(inputValues[inputCursor++]);
        addTerminal("entrada: " + formatValue(value), "in");
        push(value);
        break;
      case "ESCR": {
        const value = pop();
        addTerminal("saída: " + formatValue(value), "out");
        break;
      }
      case "FIMP":
        halted = true;
        setStatus(
          `Programa finalizado após ${pc + 1} instrução(ões) executada(s).`,
        );
        break;
      default:
        throw new Error(`Sem implementação para ${ins.op}.`);
    }
    if (!halted && i >= program.length) {
      halted = true;
      setStatus("Fim de P alcançado. O programa terminou sem executar FIMP.");
    } else if (!halted) {
      setStatus(
        `Executada P[${pc}]: ${ins.source || ins.op}. Próxima instrução: P[${i}].`,
      );
    }
  } catch (e) {
    if (waitingInput) {
      stopRun();
      setStatus(e.message, true);
      addTerminal("aguardando entrada: " + e.message, "err");
      updateRegisters();
      redrawViz();
      updateButtons();
      return false;
    }
    fail(`P[${pc}] ${ins.op}: ${e.message}`);
    return false;
  }
  updateRegisters();
  redrawViz();
  updateButtons();
  return !halted;
}
function runAll() {
  if (halted || running || !program.length) return;
  running = true;
  updateButtons();
  const tick = () => {
    if (!running) return;
    const stillRunning = executeOne();
    if (stillRunning && running) animationTimer = setTimeout(tick, 280);
    else {
      running = false;
      animationTimer = null;
      updateButtons();
    }
  };
  tick();
}
function updateInputValues() {
  inputValues = $("stdin")
    .value.split(/\r?\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
function redrawViz() {
  if (p5Instance) p5Instance.redraw();
}
function setupP5(p) {
  p5Instance = p;
  p.setup = () => {
    const holder = $("p5-holder");
    const w = Math.max(320, Math.min(760, holder.clientWidth || 620));
    const c = p.createCanvas(w, 520);
    c.parent("p5-holder");
    p.textFont("monospace");
    p.noLoop();
    redrawViz();
  };
  p.windowResized = () => {
    const holder = $("p5-holder");
    if (!holder) return;
    p.resizeCanvas(
      Math.max(320, Math.min(760, holder.clientWidth || 620)),
      520,
    );
    p.redraw();
  };
  p.draw = () => {
    p.background(251, 252, 254);
    const w = p.width;
    p.noStroke();
    p.fill(33, 43, 54);
    p.textSize(15);
    p.textStyle(p.BOLD);
    p.text("Programa P", 14, 24);
    p.textStyle(p.NORMAL);
    p.textSize(11);
    p.fill(95, 107, 120);
    p.text(`${program.length} instruções`, w - 105, 24);
    const codeX = 12,
      codeY = 36,
      codeW = Math.floor(w * 0.55) - 16,
      codeH = 465;
    p.stroke(220, 226, 233);
    p.fill(255);
    p.rect(codeX, codeY, codeW, codeH, 6);

    // Cabeçalho da listagem de P: endereço, rótulo, instrução e operando.
    const headerH = 27;
    p.noStroke();
    p.fill(241, 245, 249);
    p.rect(codeX + 1, codeY + 1, codeW - 2, headerH, 5);
    p.fill(55, 65, 81);
    p.textSize(10);
    p.textStyle(p.BOLD);
    const colX = [
      codeX + 7,
      codeX + Math.floor(codeW * 0.22),
      codeX + Math.floor(codeW * 0.43),
      codeX + Math.floor(codeW * 0.72),
    ];
    p.text("End.", colX[0], codeY + 17);
    p.text("Rótulo", colX[1], codeY + 17);
    p.text("Instr.", colX[2], codeY + 17);
    p.text("Oper.", colX[3], codeY + 17);
    p.textStyle(p.NORMAL);

    const rowH = 22;
    const visibleRows = Math.floor((codeH - headerH - 5) / rowH);
    let start = Math.max(
      0,
      Math.min(
        Math.max(0, program.length - visibleRows),
        i - Math.floor(visibleRows / 2),
      ),
    );
    for (let row = 0; row < visibleRows; row++) {
      const idx = start + row;
      if (idx >= program.length) break;
      const y = codeY + headerH + 7 + row * rowH;
      if (idx === i && !halted) {
        p.noStroke();
        p.fill(219, 234, 254);
        p.rect(codeX + 1, y - 13, codeW - 2, 21, 3);
      } else if (idx === lastInstruction) {
        p.noStroke();
        p.fill(240, 247, 255);
        p.rect(codeX + 1, y - 13, codeW - 2, 21, 3);
      }

      const ins = program[idx];
      const cells = [
        String(idx).padStart(3, "0"),
        ins.label || "—",
        ins.op,
        ins.operand === null || ins.operand === undefined
          ? "—"
          : String(ins.operand),
      ];
      p.textSize(10);
      cells.forEach((value, col) => {
        const nextX =
          col < 3
            ? colX[col + 1] - colX[col] - 4
            : codeX + codeW - colX[col] - 5;
        const maxChars = Math.max(3, Math.floor(nextX / 6.1));
        let shown =
          value.length > maxChars ? value.slice(0, maxChars - 1) + "…" : value;
        p.fill(
          idx === i && !halted ? 20 : 55,
          idx === i && !halted ? 65 : 65,
          idx === i && !halted ? 130 : 81,
        );
        p.text(shown, colX[col], y + 1);
      });
    }
    const mx = codeX + codeW + 13,
      mw = w - mx - 12;
    p.noStroke();
    p.fill(33, 43, 54);
    p.textStyle(p.BOLD);
    p.textSize(15);
    p.text("Memória M", mx, 24);
    p.textStyle(p.NORMAL);
    p.textSize(11);
    p.fill(95, 107, 120);
    p.text(`${memory.length} posições`, mx, 48);
    const memY = 61,
      memH = 440;
    p.stroke(220, 226, 233);
    p.fill(255);
    p.rect(mx, memY, mw, memH, 6);
    p.noStroke();
    p.fill(95, 107, 120);
    p.textSize(10);
    p.text("end.", mx + 8, memY + 17);
    p.text("valor", mx + 55, memY + 17);
    const maxMemRows = Math.max(1, Math.floor((memH - 35) / 25));
    const visibleMem = Math.min(s, maxMemRows);
    // Exibe as últimas células utilizadas para manter o topo visível.
    const mStart = Math.max(0, s - visibleMem);
    for (let j = 0; j < visibleMem; j++) {
      const addr = mStart + j,
        y = memY + 29 + j * 25;
      if (addr === s - 1) {
        p.noStroke();
        p.fill(209, 250, 229);
        p.rect(mx + 2, y - 12, mw - 4, 23, 3);
      } else {
        p.noStroke();
        p.fill(247, 249, 251);
        p.rect(mx + 2, y - 12, mw - 4, 23, 3);
      }
      p.fill(80, 90, 102);
      p.textSize(11);
      p.text(String(addr), mx + 8, y + 3);
      p.fill(25, 35, 45);
      p.textSize(12);
      let val = formatValue(memory[addr]);
      const maxVal = Math.max(5, Math.floor((mw - 64) / 7));
      if (val.length > maxVal) val = val.slice(0, maxVal - 1) + "…";
      p.text(val, mx + 55, y + 3);
    }
    if (s === 0) {
      p.noStroke();
      p.fill(140, 148, 158);
      p.textSize(11);
      p.text("memória vazia", mx + 8, memY + 44);
    }
    // Indicador s aponta para a próxima posição livre.
    p.noStroke();
    p.fill(21, 94, 239);
    p.textStyle(p.BOLD);
    p.textSize(11);
    p.text(`s = ${s}`, mx + 8, Math.min(memY + memH - 10, memY + memH - 15));
    p.textStyle(p.NORMAL);
    p.fill(95, 107, 120);
    p.textSize(10);
    const state = halted
      ? "ENCERRADA"
      : waitingInput
        ? "AGUARDANDO ENTRADA"
        : running
          ? "EXECUTANDO"
          : "PAUSADA";
    p.text(state, 14, 518);
    p.text(
      `i = ${i < program.length ? i : "fim"}   |   s = ${s}`,
      Math.max(140, w - 210),
      518,
    );
  };
}
new p5(setupP5);

// No editor, TAB insere um caractere de tabulação em vez de mudar o foco.
$("code").addEventListener("input", updateLineNumbers);
$("code").addEventListener("scroll", syncEditorScroll);
// Atualiza o contador também para o programa que já vem preenchido no index.html.
updateLineNumbers();
$("code").addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("\t", start, end, "end");
  }
});

$("assemble").addEventListener("click", () => loadProgram(true));
$("step").addEventListener("click", () => {
  if (!program.length) {
    if (!loadProgram(true)) return;
  }
  if (halted) return;
  if (waitingInput) {
    updateInputValues();
    if (inputCursor >= inputValues.length) {
      setStatus(
        "Acrescente pelo menos um valor à entrada e clique em Carregar programa para reiniciar.",
        true,
      );
      return;
    }
    waitingInput = false;
  }
  executeOne();
});
$("run").addEventListener("click", () => {
  if (!program.length) {
    if (!loadProgram(true)) return;
  }
  if (halted) return;
  if (waitingInput) {
    setStatus(
      "A execução parou em LEIA. Acrescente a entrada e clique em Carregar programa para reiniciar.",
      true,
    );
    return;
  }
  runAll();
});
$("pause").addEventListener("click", () => {
  stopRun();
  setStatus("Execução pausada.");
});
$("reset").addEventListener("click", () => {
  loadProgram(true);
});
$("example1").addEventListener("click", () => {
  $("code").value = EXAMPLE1;
  updateLineNumbers();
  loadProgram(true);
});
$("example2").addEventListener("click", () => {
  $("code").value = EXAMPLE2;
  updateLineNumbers();
  loadProgram(true);
});
$("clearTerminal").addEventListener("click", clearTerminal);
$("stdin").addEventListener("input", () => {
  if (!program.length) updateInputValues();
});
window.addEventListener("resize", () => redrawViz());

// Monta o programa de exemplo ao iniciar, preenchendo a listagem de Programa P.
loadProgram(true);
