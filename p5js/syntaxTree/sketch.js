let currentDot = "";
let currentTree = null;
let currentViz = null;

function setup() {
  createCanvas(1, 1).parent("p5-status");
  noLoop();

  document.getElementById("runBtn").addEventListener("click", runParser);
  document.getElementById("exampleBtn").addEventListener("click", loadExample);
  document.getElementById("clearBtn").addEventListener("click", clearAll);
  document.getElementById("dotBtn").addEventListener("click", showDot);
  document.getElementById("fitBtn").addEventListener("click", fitTree);
  document.getElementById("zoomInBtn").addEventListener("click", function () {
    treeZoom *= 1.2;
    treeZoom = Math.min(treeZoom, 5);
    aplicarZoom();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", function () {
    treeZoom /= 1.2;
    treeZoom = Math.max(treeZoom, 0.2);
    aplicarZoom();
  });

  const source = document.getElementById("source");

  source.addEventListener("input", atualizarLinhas);

  source.addEventListener("scroll", function () {
    document.getElementById("lineNumbers").scrollTop = source.scrollTop;
  });

  atualizarLinhas();

  setTimeout(runParser, 100);
}

function atualizarLinhas() {
  const source = document.getElementById("source");
  const lineNumbers = document.getElementById("lineNumbers");

  const quantidade = source.value.split("\n").length;

  let linhas = "";

  for (let i = 1; i <= quantidade; i++) {
    linhas += i + "\n";
  }

  lineNumbers.textContent = linhas;

  // Sincroniza o deslocamento vertical
  lineNumbers.scrollTop = source.scrollTop;
}

function draw() {}

function getJisonParser() {
  if (
    typeof window.jisonParser === "undefined" ||
    window.jisonParser === null
  ) {
    throw new Error(
      "O parser Jison não foi inicializado. " +
        "Verifique se parser.js foi gerado e carregado antes de sketch.js.",
    );
  }

  if (typeof window.jisonParser.parseSource !== "function") {
    throw new Error(
      "O parser Jison foi carregado, mas a função parseSource não está disponível.",
    );
  }

  if (typeof window.jisonParser.treeToDot !== "function") {
    throw new Error(
      "O parser Jison foi carregado, mas a função treeToDot não está disponível.",
    );
  }

  return window.jisonParser;
}

function setStatus(text, type = "") {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status " + type;
}

function traduzirErroParser(err, source) {
  const mensagem = err && err.message ? err.message : String(err);

  // ------------------------------------------------------------
  // LINHA
  // ------------------------------------------------------------

  const linhaMatch = mensagem.match(/line\s+(\d+)/i);

  const linha = linhaMatch ? parseInt(linhaMatch[1], 10) : null;

  // ------------------------------------------------------------
  // TOKEN ENCONTRADO
  // ------------------------------------------------------------

  const encontradoMatch = mensagem.match(/got\s+'([^']+)'/i);

  const encontrado = encontradoMatch ? encontradoMatch[1] : null;

  // ------------------------------------------------------------
  // TOKENS ESPERADOS
  // ------------------------------------------------------------

  const esperandoMatch = mensagem.match(/Expecting\s+(.+?),\s+got\s+'/i);

  let esperados = [];

  if (esperandoMatch) {
    const matches = esperandoMatch[1].match(/'([^']+)'/g);

    if (matches) {
      esperados = matches.map((token) => token.substring(1, token.length - 1));
    }
  }

  // ------------------------------------------------------------
  // TRADUÇÃO DOS TOKENS
  // ------------------------------------------------------------

  const nomes = {
    // Identificadores e constantes
    T_IDENTIF: "identificador",
    T_NUMERO: "número",

    // Valores lógicos
    T_V: "V",
    T_F: "F",
    T_NAO: "não",

    // Operadores
    T_MAIS: "+",
    T_MENOS: "-",
    T_VEZES: "*",
    T_DIV: "/",

    T_MAIOR: ">",
    T_MENOR: "<",
    T_IGUAL: "=",

    T_E: "e",
    T_OU: "ou",

    // Delimitadores
    T_ABRE: "(",
    T_FECHA: ")",

    // Comandos
    T_SE: "se",
    T_ENTAO: "então",
    T_SENAO: "senão",

    T_ENQUANTO: "enquanto",
    T_FACA: "faça",

    T_PARA: "para",
    T_REPITA: "repita",

    // Finais de comandos
    T_FIMSE: "fimse",
    T_FIMENQTO: "fimenquanto",
    T_FIMPARA: "fimpara",

    // Programa
    T_PROGRAMA: "programa",
    T_INICIO: "início",
    T_FIM: "fimprograma",

    // Tipos
    T_INTEIRO: "inteiro",
    T_LOGICO: "lógico",

    // Entrada e saída
    T_LEIA: "leia",
    T_ESCREVA: "escreva",
  };

  function traduzirToken(token) {
    return nomes[token] || token;
  }

  // ------------------------------------------------------------
  // CONSTRUÇÃO DA MENSAGEM
  // ------------------------------------------------------------

  let resultado = "";

  // Erro
  if (linha !== null) {
    resultado += `Erro de sintaxe na linha ${linha}.\n\n`;
  } else {
    resultado += "Erro de sintaxe.\n\n";
  }

  // Encontrado
  if (encontrado) {
    const nomeEncontrado = traduzirToken(encontrado);

    resultado += `Encontrado:\n    ${nomeEncontrado}\n\n`;
  }

  // Esperado
  if (esperados.length > 0) {
    const listaEsperada = esperados
      .map((token) => traduzirToken(token))
      .join(", ");

    resultado += `Esperado:\n    ${listaEsperada}`;
  }

  return resultado;
}

async function runParser() {
  const source = document.getElementById("source").value;
  const target = document.getElementById("tree");

  if (!source.trim()) {
    clearAll();
    setStatus("Digite um programa fonte.", "error");
    return;
  }

  target.innerHTML = '<div class="tree-loading">Construindo árvore...</div>';

  try {
    const jisonParser = getJisonParser();

    if (typeof Viz === "undefined") {
      throw new Error(
        "Viz.js não foi carregado. Verifique a conexão com a Internet.",
      );
    }

    // ------------------------------------------------------------
    // ATUALIZA A SEQUÊNCIA DE TOKENS
    // ANTES DA ANÁLISE SINTÁTICA
    // ------------------------------------------------------------

    const tokenList = tokenizeForDisplay(source);

    document.getElementById("tokenCount").textContent = tokenList.length;

    document.getElementById("tokens").textContent = tokenList
      .map(
        (t, i) => `${String(i + 1).padStart(3, " ")}  ${t.token}\t${t.lexema}`,
      )
      .join("\n");

    // ------------------------------------------------------------
    // ANALISA O PROGRAMA
    // ------------------------------------------------------------

    const tree = jisonParser.parseSource(source);
    const dot = jisonParser.treeToDot(tree);

    currentTree = tree;
    currentDot = dot;

    const count =
      typeof jisonParser.countNodes === "function"
        ? jisonParser.countNodes(tree)
        : countTreeNodes(tree);

    document.getElementById("nodeCount").textContent = count;
    document.getElementById("rootName").textContent = tree.tipo || "—";

    currentViz = new Viz();
    const svg = await currentViz.renderSVGElement(dot);

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    // svg.style.width = "100%";
    // svg.style.height = "auto";
    svg.style.display = "block";

    target.innerHTML = "";
    target.appendChild(svg);
    fitTree();

    setStatus(
      `Árvore construída com sucesso: ${count} nós e ${tokenList.length} tokens.`,
      "ok",
    );
  } catch (err) {
    console.error(err);

    currentTree = null;
    currentDot = "";

    const mensagem = traduzirErroParser(err, source);

    target.innerHTML = `<div class="tree-error">
      <strong>A árvore não foi construída.</strong>
      <br><br>
      ${escapeHtml(mensagem).replace(/\n/g, "<br>")}
    </div>`;

    setStatus("Erro de sintaxe", "error");
  }
}

function countTreeNodes(node) {
  if (!node) return 0;

  let total = 1;

  if (Array.isArray(node.filhos)) {
    for (const child of node.filhos) {
      total += countTreeNodes(child);
    }
  }

  return total;
}

function tokenizeForDisplay(source) {
  const patterns = [
    ["T_PROGRAMA", /^programa\b/],
    ["T_INICIO", /^inicio\b/],
    ["T_FIM", /^fimprograma\b/],
    ["T_LEIA", /^leia\b/],
    ["T_ESCREVA", /^escreva\b/],
    ["T_SE", /^se\b/],
    ["T_ENTAO", /^entao\b/],
    ["T_SENAO", /^senao\b/],
    ["T_FIMSE", /^fimse\b/],
    ["T_ENQTO", /^enquanto\b/],
    ["T_FACA", /^faca\b/],
    ["T_FIMENQTO", /^fimenquanto\b/],
    ["T_INTEIRO", /^inteiro\b/],
    ["T_LOGICO", /^logico\b/],
    ["T_V", /^V\b/],
    ["T_F", /^F\b/],
    ["T_DIV", /^div\b/],
    ["T_NAO", /^nao\b/],
    ["T_E", /^e\b/],
    ["T_OU", /^ou\b/],
    ["T_ATRIB", /^<-/],
    ["T_MAIOR", /^>/],
    ["T_MENOR", /^</],
    ["T_IGUAL", /^=/],
    ["T_MAIS", /^\+/],
    ["T_MENOS", /^-/],
    ["T_VEZES", /^\*/],
    ["T_ABRE", /^\(/],
    ["T_FECHA", /^\)/],
    ["T_NUMERO", /^\d+/],
    ["T_IDENTIF", /^[a-zA-Z][a-zA-Z0-9]*/],
  ];

  const result = [];
  let rest = source;

  while (rest.length) {
    const ws = rest.match(/^\s+/);
    if (ws) {
      rest = rest.slice(ws[0].length);
      continue;
    }

    const comment = rest.match(/^(?:\/\/[^\n\r]*|\/\*[\s\S]*?\*\/)/);
    if (comment) {
      rest = rest.slice(comment[0].length);
      continue;
    }

    let matched = false;

    for (const [token, regex] of patterns) {
      const m = rest.match(regex);

      if (m) {
        result.push({
          token,
          lexema: m[0],
        });

        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.push({
        token: "ERRO",
        lexema: rest[0],
      });

      rest = rest.slice(1);
    }
  }

  return result;
}

let treeZoom = 1;

function fitTree() {
  const container = document.getElementById("tree");
  const svg = container.querySelector("svg");

  if (!svg) return;

  // Tamanho original informado pelo SVG
  const viewBox = svg.getAttribute("viewBox");

  if (!viewBox) {
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    return;
  }

  const partes = viewBox.split(/[\s,]+/).map(Number);

  if (partes.length !== 4) return;

  const larguraSVG = partes[2];
  const alturaSVG = partes[3];

  const larguraDisponivel = container.clientWidth - 24;
  const alturaDisponivel = container.clientHeight - 24;

  // Calcula o zoom para a árvore caber na área
  const zoomX = larguraDisponivel / larguraSVG;
  const zoomY = alturaDisponivel / alturaSVG;

  treeZoom = Math.min(zoomX, zoomY);

  // Impede que fique excessivamente pequeno
  treeZoom = Math.max(treeZoom, 0.2);

  aplicarZoom();
}

function aplicarZoom() {
  const container = document.getElementById("tree");
  const svg = container.querySelector("svg");

  if (!svg) return;

  const viewBox = svg.getAttribute("viewBox");

  if (!viewBox) return;

  const partes = viewBox.split(/[\s,]+/).map(Number);

  if (partes.length !== 4) return;

  const larguraSVG = partes[2];
  const alturaSVG = partes[3];

  svg.removeAttribute("width");
  svg.removeAttribute("height");

  svg.style.width = larguraSVG * treeZoom + "px";
  svg.style.height = alturaSVG * treeZoom + "px";
  svg.style.display = "block";
}

function showDot() {
  if (!currentDot) {
    setStatus("Construa a árvore antes de visualizar o DOT.", "error");
    return;
  }

  document.getElementById("dotOutput").textContent = currentDot;
  document.getElementById("dotDialog").showModal();
}

function loadExample() {
  document.getElementById("source").value = `programa exemplo
  inteiro a b c
  logico x
  inicio
     a <- b + c * 2
     leia a
     se a > b
        entao escreva a
        senao escreva b
     fimse
     enquanto x faca 
        x <- nao x
     fimenquanto
fimprograma`;
  atualizarLinhas();
  runParser();
}

function clearAll() {
  currentTree = null;
  currentDot = "";

  document.getElementById("tree").innerHTML = "";
  document.getElementById("tokens").textContent = "";
  document.getElementById("tokenCount").textContent = "0";
  document.getElementById("nodeCount").textContent = "0";
  document.getElementById("rootName").textContent = "—";

  setStatus("Área limpa.");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
