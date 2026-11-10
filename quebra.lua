function RawInline(el)
  if el.format == "html" and el.text == "<br>" then
    if FORMAT:match("latex") then
      return pandoc.RawInline("latex", "\\newline")
    end
  end
end