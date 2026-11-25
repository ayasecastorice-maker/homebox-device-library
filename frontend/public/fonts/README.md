# Local font assets

Downloaded from the official repositories on 2026-10-25. These fonts are served
from Homebox itself; no CDN or font service is contacted at runtime. Keep the
accompanying SIL Open Font License files when copying or redistributing them.

- Source Han Sans CN variable: Adobe `source-han-sans`, `release/Variable/WOFF2/OTF/Subset/SourceHanSansCN-VF.otf.woff2`.
- Source Han Serif CN variable: Adobe `source-han-serif`, `release/Variable/WOFF2/OTF/Subset/SourceHanSerifCN-VF.otf.woff2`.
- Lora variable: Google Fonts, `ofl/lora/Lora[wght].ttf`.

## Selected A Typography (2026-10-25)

- LXGW WenKai Regular v1.530: Chinese headings, navigation, controls and body.
  Source: https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530
- Fraunces variable: Homebox brand, weight 500, SOFT 75, WONK 1.
  Source: https://github.com/google/fonts/tree/main/ofl/fraunces
- Manrope variable: prices, statistics, dates, model names and serial numbers.
  Source: https://github.com/google/fonts/tree/main/ofl/manrope

The new files are unchanged copies of the approved A preview fonts under
`design/font-options/fonts`, including their OFL licenses. CSS aliases are
Homebox WenKai, Homebox Fraunces, and Homebox Manrope. WenKai has only one
bundled weight; synthetic bold/italic is disabled to preserve its strokes.
Source Han Sans remains a missing-glyph fallback. Existing font assets remain
available for rollback and earlier specimens. No Apple or Anthropic proprietary
font files are included, and no system font installation is required.
