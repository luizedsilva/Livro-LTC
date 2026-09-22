#!/bin/bash

BASE_URL="${PDI_BOOK_URL:-https://luizedsilva.github.io/Livro-LTC}"

qrencode -o syntaxTree.png "${BASE_URL}/p5js/syntaxTree/"
qrencode -o er-af.png "${BASE_URL}/p5js/er-af/"
qrencode -o lr.png "${BASE_URL}/p5js/lr/"
qrencode -o cyk.png "${BASE_URL}/p5js/cyk/"

