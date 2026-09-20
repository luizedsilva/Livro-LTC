-- =========================
-- Filtro: simulacao.lua (ajustado)
-- =========================

local document_meta = {}

local function file_exists(path)
  if path == nil or path == "" then return false end
  local f = io.open(path, "r")
  if f then
    f:close()
    return true
  end
  return false
end

-- Captura metadados
local function get_metadata(meta)
  document_meta = meta
  return meta
end

-- =========================
-- PROCESSAMENTO DAS SIMULAÇÕES
-- =========================
local function process_div(el)
  if not el.classes:includes("simulacao") then
    return nil
  end

  local function get_attr_or_meta(name)
    local val = el.attributes[name]

    if (val == nil or val == "") then
      local meta_key = "app-" .. name
      if document_meta[meta_key] then
        val = pandoc.utils.stringify(document_meta[meta_key])
      end
    end

    return val or ""
  end

  local url    = get_attr_or_meta("url")
  local height = get_attr_or_meta("height")
  if height == "" then height = "400" end
  local imagem = get_attr_or_meta("imagem")
  local qrcode = get_attr_or_meta("qrcode")

  -- =========================
  -- HTML
  -- =========================
  if FORMAT:match("html") then
    if url ~= "" then
      local html = string.format(
        '<div class="simulacao-container"><iframe src="%s" width="100%%" height="%s" style="border:none;"></iframe></div>',
        url, height
      )
      return pandoc.RawBlock("html", html)
    else
      return pandoc.Para({pandoc.Emph(pandoc.Str("Simulação não disponível."))})
    end
  end

  -- =========================
  -- PDF (LaTeX)
  -- =========================
  if FORMAT:match("latex") then
    local latex = ""

    if imagem ~= "" then
      latex = latex .. "\\begin{figure}[H]\n\\centering\n"
      latex = latex .. "\\fbox{\\includegraphics[width=0.6\\textwidth]{" .. imagem .. "}}\n"
      latex = latex .. "\\caption{Visualização da aplicação interativa}\n"
      latex = latex .. "\\end{figure}\n"
    end

    if url ~= "" then
      latex = latex .. "\\begin{tcolorbox}[enhanced jigsaw, title=Acesso Interativo]\n"
      latex = latex .. "Acesse a simulação em: \\url{" .. url .. "}\n"

      if qrcode ~= "" and file_exists(qrcode) then
        latex = latex .. "\\begin{center}\\includegraphics[width=3cm]{" .. qrcode .. "}\\end{center}\n"
      end

      latex = latex .. "\\end{tcolorbox}\n"
    end

    return pandoc.RawBlock("latex", latex)
  end

  -- =========================
  -- EPUB
  -- =========================
  if FORMAT:match("epub") then
    local blocks = {}

    if imagem ~= "" then
      table.insert(blocks,
        pandoc.Para({pandoc.Image({pandoc.Str("Simulação")}, imagem)})
      )
    end

    if url ~= "" then
      table.insert(blocks,
        pandoc.Para({
          pandoc.Str("Acesse: "),
          pandoc.Link(pandoc.Str(url), url)
        })
      )

      if qrcode ~= "" and file_exists(qrcode) then
        table.insert(blocks,
          pandoc.Para({
            pandoc.Image({pandoc.Str("QR")}, qrcode, "", {width="100px"})
          })
        )
      end
    end

    return blocks
  end

  -- =========================
  -- DOCX (AJUSTADO PROFISSIONAL)
  -- =========================
  if FORMAT:match("docx") then
    local blocks = {}

    -- Título estilo "caixa"
    table.insert(blocks,
      pandoc.Para(
        {pandoc.Strong(pandoc.Str("Simulação Interativa"))}
      )
    )

    -- Linha separadora
    table.insert(blocks,
      pandoc.Para({pandoc.Str("------------------------------")})
    )

    -- Imagem
    if imagem ~= "" then
      table.insert(blocks,
        pandoc.Para({
          pandoc.Image({pandoc.Str("Visualização")}, imagem)
        })
      )
    end

    -- Link
    if url ~= "" then
      table.insert(blocks,
        pandoc.Para({
          pandoc.Str("Acesse: "),
          pandoc.Link(pandoc.Str(url), url)
        })
      )
    end

    -- QR Code
    if qrcode ~= "" and file_exists(qrcode) then
      table.insert(blocks,
        pandoc.Para({
          pandoc.Image({pandoc.Str("QR Code")}, qrcode, "", {width="120px"})
        })
      )
    end

    -- Linha inferior
    table.insert(blocks,
      pandoc.Para({pandoc.Str("------------------------------")})
    )

    return blocks
  end

  return nil
end

-- =========================
-- CORREÇÃO DE CÓDIGO (ANTI-CENTRALIZAÇÃO DOCX)
-- =========================
function CodeBlock(el)
  return pandoc.CodeBlock(
    el.text,
    pandoc.Attr(el.identifier or "", el.classes or {}, el.attributes or {})
  )
end

-- =========================
-- RETORNO DO FILTRO
-- =========================
return {
  { Meta = get_metadata },
  { Div = process_div },
  { CodeBlock = CodeBlock }
}