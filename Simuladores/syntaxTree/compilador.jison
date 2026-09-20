/* ============================================================
 * Analisador léxico e sintático em Jison
 * Equivalente às especificações lexico.l e sintatico.y
 *
 * Árvore sintática:
 *   programa
 *      |
 *      +-- declaração de variáveis
 *      +-- lista de comandos
 *
 * Ações semânticas constroem uma árvore N-ária usando a
 * representação pai -> filhos, mantendo a ordem dos filhos.
 * ============================================================ */

%{
/* ------------------------------------------------------------
 * Estrutura da árvore sintática
 * ------------------------------------------------------------ */

function no(tipo, valor) {
    return {
        tipo: tipo,
        valor: valor || "",
        filhos: []
    };
}

function filho(pai, f) {
    if (f) pai.filhos.push(f);
}

const T = {
    PRG: "programa",
    DVR: "declaracao variaveis",
    TIP: "tipo",
    LVR: "lista variaveis",
    LCM: "lista comandos",
    LEI: "leitura",
    ESC: "escrita",
    REP: "repeticao",
    SEL: "selecao",
    ATR: "atribuicao",
    MUL: "multiplicacao",
    DIV: "divisao",
    SOM: "soma",
    SUB: "subtracao",
    MAI: "compara maior",
    MEN: "compara menor",
    IGU: "compara igual",
    CON: "conjuncao",
    DIS: "disjuncao",
    IDN: "identificador",
    VAR: "variavel",
    NUM: "numero",
    VER: "verdadeiro",
    FAL: "falso",
    NAO: "negacao"
};

let raiz = null;
%}

/* ============================================================
 * DEFINIÇÕES LÉXICAS
 * ============================================================ */

%lex

%options flex

%%

\s+                         /* ignora espaços e quebras de linha */
\/\/[^\n\r]*                 /* comentário de uma linha */
\/\*[\s\S]*?\*\/            /* comentário de múltiplas linhas */

'programa'                  return 'T_PROGRAMA';
'inicio'                    return 'T_INICIO';
'fimprograma'               return 'T_FIM';
'leia'                      return 'T_LEIA';
'escreva'                   return 'T_ESCREVA';
'se'                        return 'T_SE';
'entao'                     return 'T_ENTAO';
'senao'                     return 'T_SENAO';
'fimse'                     return 'T_FIMSE';
'enquanto'                  return 'T_ENQTO';
'faca'                      return 'T_FACA';
'fimenquanto'               return 'T_FIMENQTO';
'inteiro'                   return 'T_INTEIRO';
'logico'                    return 'T_LOGICO';
'V'                         return 'T_V';
'F'                         return 'T_F';
'div'                       return 'T_DIV';
'nao'                       return 'T_NAO';
'e'                         return 'T_E';
'ou'                        return 'T_OU';

'<-'                        return 'T_ATRIB';
'>'                         return 'T_MAIOR';
'<'                         return 'T_MENOR';
'='                         return 'T_IGUAL';
'+'                         return 'T_MAIS';
'-'                         return 'T_MENOS';
'*'                         return 'T_VEZES';
'('                         return 'T_ABRE';
')'                         return 'T_FECHA';

[a-zA-Z][a-zA-Z0-9]*        return 'T_IDENTIF';
[0-9]+                      return 'T_NUMERO';

<<EOF>>                     return 'EOF';
.                           throw new Error('Caractere inválido: "' + yytext + '"');

/lex



/* ============================================================
 * GRAMÁTICA
 * ============================================================ */

%start programa

%left T_OU
%left T_E
%left T_IGUAL
%left T_MAIOR T_MENOR
%left T_MAIS T_MENOS
%left T_VEZES T_DIV

%%

programa
    : cabecalho variaveis T_INICIO lista_comandos T_FIM EOF
        {
            $$ = no(T.PRG);
            filho($$, $1);
            if ($2) filho($$, $2);
            if ($4) filho($$, $4);
            raiz = $$;
            yy.raiz = $$;
        }
    ;

cabecalho
    : T_PROGRAMA identificador
        {
            $$ = $2;
        }
    ;

identificador
    : T_IDENTIF
        {
            $$ = no(T.IDN, $1);
        }
    ;

variaveis
    : /* vazio */
        {
            $$ = null;
        }
    | declaracao_variaveis
        {
            $$ = $1;
        }
    ;

declaracao_variaveis
    : tipo lista_variaveis declaracao_variaveis
        {
            $$ = no(T.DVR);
            filho($$, $1);
            filho($$, $2);
            if ($3) filho($$, $3);
        }
    | tipo lista_variaveis
        {
            $$ = no(T.DVR);
            filho($$, $1);
            filho($$, $2);
        }
    ;

tipo
    : T_LOGICO
        {
            $$ = no(T.TIP, "logico");
        }
    | T_INTEIRO
        {
            $$ = no(T.TIP, "inteiro");
        }
    ;

lista_variaveis
    : identificador lista_variaveis
        {
            $$ = no(T.LVR);
            filho($$, $1);
            filho($$, $2);
        }
    | identificador
        {
            $$ = no(T.LVR);
            filho($$, $1);
        }
    ;

lista_comandos
    : /* vazio */
        {
            $$ = null;
        }
    | comando lista_comandos
        {
            $$ = no(T.LCM);
            filho($$, $1);
            if ($2) filho($$, $2);
        }
    ;

comando
    : entrada_saida
        {
            $$ = $1;
        }
    | repeticao
        {
            $$ = $1;
        }
    | selecao
        {
            $$ = $1;
        }
    | atribuicao
        {
            $$ = $1;
        }
    ;

entrada_saida
    : leitura
        {
            $$ = $1;
        }
    | escrita
        {
            $$ = $1;
        }
    ;

leitura
    : T_LEIA identificador
        {
            $$ = no(T.LEI);
            filho($$, $2);
        }
    ;

escrita
    : T_ESCREVA expressao
        {
            $$ = no(T.ESC);
            filho($$, $2);
        }
    ;

repeticao
    : T_ENQTO expressao T_FACA lista_comandos T_FIMENQTO
        {
            $$ = no(T.REP);
            filho($$, $2);
            if ($4) filho($$, $4);
        }
    ;

selecao
    : T_SE expressao T_ENTAO lista_comandos T_SENAO lista_comandos T_FIMSE
        {
            $$ = no(T.SEL);
            filho($$, $2);
            if ($4) filho($$, $4);
            if ($6) filho($$, $6);
        }
    ;

atribuicao
    : identificador T_ATRIB expressao
        {
            $$ = no(T.ATR);
            filho($$, $1);
            filho($$, $3);
        }
    ;

expressao
    : expressao T_VEZES expressao
        {
            $$ = no(T.MUL);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_DIV expressao
        {
            $$ = no(T.DIV);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_MAIS expressao
        {
            $$ = no(T.SOM);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_MENOS expressao
        {
            $$ = no(T.SUB);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_MAIOR expressao
        {
            $$ = no(T.MAI);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_MENOR expressao
        {
            $$ = no(T.MEN);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_IGUAL expressao
        {
            $$ = no(T.IGU);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_E expressao
        {
            $$ = no(T.CON);
            filho($$, $1);
            filho($$, $3);
        }
    | expressao T_OU expressao
        {
            $$ = no(T.DIS);
            filho($$, $1);
            filho($$, $3);
        }
    | termo
        {
            $$ = $1;
        }
    ;

termo
    : identificador
        {
            $$ = no(T.VAR, $1.valor);
        }
    | T_NUMERO
        {
            $$ = no(T.NUM, $1);
        }
    | T_V
        {
            $$ = no(T.VER, "verdade");
        }
    | T_F
        {
            $$ = no(T.FAL, "falso");
        }
    | T_NAO termo
        {
            $$ = no(T.NAO);
            filho($$, $2);
        }
    | T_ABRE expressao T_FECHA
        {
            $$ = $2;
        }
    ;

%%

/* ============================================================
 * API para o simulador
 * ============================================================ */

function parse(source) {
    // Limpa a árvore anterior
    raiz = null;

    // Mantém o objeto yy necessário ao Jison
    parser.yy = {
        atomo: "",
        raiz: null,
        parseError: parser.parseError
    };

    // Executa a análise sintática
    parser.parse(source);

    // A ação da regra "programa" grava a árvore
    // diretamente na variável global raiz.
    if (!raiz) {
        throw new Error(
            "A análise sintática terminou, mas a regra programa " +
            "não produziu a árvore."
        );
    }

    return raiz;
}

function dot(root) {
    let id = 0;
    const linhas = [];

    linhas.push("digraph G {");
    linhas.push('  graph [rankdir=TB, bgcolor="transparent"];');
    linhas.push(
        '  node [shape=box, style="rounded,filled", ' +
        'fontname="Arial", fontcolor="black"];'
    );
    linhas.push('  edge [arrowsize=0.7];');

    function escape(s) {
        return String(s)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n");
    }

    function temValor(n) {
        return (
            n.valor !== undefined &&
            n.valor !== null &&
            String(n.valor).trim() !== ""
        );
    }

    function label(n) {
        if (temValor(n)) {
            return n.tipo + "\n[" + n.valor + "]";
        }

        return n.tipo;
    }

    function visit(n) {
        const atual = "n" + (++id);

        const ehFolha =
            !n.filhos ||
            n.filhos.length === 0;

        const temVal = temValor(n);

        let atributos =
            'label="' + escape(label(n)) + '"' +
            ', fontcolor="black"';

        /*
         * SOMENTE folhas que possuem valor
         * recebem preenchimento verde.
         */
        if (ehFolha && temVal) {
            atributos +=
                ', fillcolor="#90EE90"' +
                ', color="#228B22"';
        } else {
            atributos +=
                ', fillcolor="white"' +
                ', color="#555555"';
        }

        linhas.push(
            '  ' + atual +
            ' [' + atributos + '];'
        );

        if (n.filhos) {
            n.filhos.forEach(function (f) {
                const filhoId = visit(f);

                linhas.push(
                    '  ' + atual +
                    ' -> ' + filhoId + ';'
                );
            });
        }

        return atual;
    }

    visit(root);

    linhas.push("}");

    return linhas.join("\n");
}

function contarNos(root) {
    if (!root) return 0;

    let total = 1;

    root.filhos.forEach(function (f) {
        total += contarNos(f);
    });

    return total;
}

parser.parseSource = parse;
parser.treeToDot = dot;
parser.countNodes = contarNos;
