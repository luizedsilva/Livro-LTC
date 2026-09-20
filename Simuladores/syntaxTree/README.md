# Simulador de Árvore Sintática — Jison

Projeto completo para construir e visualizar a árvore sintática de um programa
usando Jison no processo de compilação e Viz.js/Graphviz no navegador.

## Estrutura

- `compilador.jison` — especificação léxica + sintática em Jison.
- `build-browser.js` — exporta o parser Jison como `window.jisonParser`.
- `parser.js` — arquivo gerado pelo `npm run build`.
- `index.html` — interface.
- `sketch.js` — execução da análise e visualização.
- `style.css` — estilos.

## Instalação

Na pasta do projeto:

```bash
npm install
npm run build
```

O comando `npm run build` faz duas coisas:

1. gera `parser.js` com Jison 0.4.18;
2. acrescenta ao arquivo gerado a exportação:

```javascript
window.jisonParser = parser;
```

## Execução

Não abra `index.html` diretamente com `file://`.

Execute:

```bash
python3 -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000/
```

## Verificação

No console do navegador (F12), os comandos:

```javascript
typeof window.jisonParser
typeof window.jisonParser.parseSource
typeof window.jisonParser.treeToDot
```

devem produzir:

```text
"object"
"function"
"function"
```

## Importante

O Jison NÃO é carregado no navegador. Ele é usado somente para gerar
`parser.js`. O navegador carrega `parser.js`, `p5.js`, `Viz.js` e `sketch.js`.

O nome `SyntaxTree` não é utilizado nesta versão, pois o Jison 0.4.18
gera o objeto principal como `parser`.


## Correção adicional — Jison 0.4.18

A função `parseSource()` preserva explicitamente `parser.parseError` em
`parser.yy.parseError`. Isso é necessário porque o Jison 0.4.18 consulta
`yy.parseError` durante a análise. Sem essa referência, entradas com erro
léxico/sintático podem produzir:

```text
this.parseError is not a function
```

A correção já está incorporada ao `compilador.jison`.
