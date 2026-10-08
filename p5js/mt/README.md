# Simulador de Máquina de Turing em p5.js

Simulador didático para definição e execução de uma Máquina de Turing por meio
de uma tabela de transição.

## Arquivos

- `index.html` — interface da aplicação.
- `style.css` — estilos e layout responsivo.
- `sketch.js` — implementação da máquina e visualização da fita.

## Como executar

A forma mais simples é abrir `index.html` em um navegador com acesso à
biblioteca p5.js usada pelo CDN.

Para uso local com um servidor HTTP:

```bash
python3 -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

## Formato da tabela

Cada célula contém:

```text
estado_destino, símbolo_escrito, movimento
```

Exemplo:

```text
q1,X,R
```

Os movimentos possíveis são:

- `L` — esquerda;
- `R` — direita;
- `S` — permanece na célula.

O símbolo `_` representa o branco da fita.

## Configuração instantânea

O simulador representa uma configuração como:

```text
⟨u, q, av⟩
```

onde:

- `u` — conteúdo à esquerda do cabeçote;
- `q` — estado atual;
- `a` — símbolo sob o cabeçote;
- `v` — restante da fita à direita.

A sequência completa é apresentada na área "Sequência de configurações
instantâneas".

## Observação sobre o exemplo

O botão "Carregar exemplo" preenche uma máquina de demonstração e a entrada
`0011`. A tabela pode ser modificada antes da inicialização.
