const fs = require("fs");

const file = "parser.js";
let source = fs.readFileSync(file, "utf8");

const exportLine = `
/* Exportação explícita para o navegador. */
if (typeof parser !== "undefined") {
  window.jisonParser = parser;
}
`;

if (!source.includes("window.jisonParser = parser")) {
  source += exportLine;
  fs.writeFileSync(file, source, "utf8");
}

console.log("parser.js preparado para o navegador.");
console.log("API disponível: window.jisonParser");
