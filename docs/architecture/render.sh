#!/usr/bin/env bash
# Regenerate the architecture SVGs from their Mermaid sources.
#
#   ./render.sh                  # all diagrams
#   ./render.sh gcp-infrastructure   # one diagram (name without .mmd)
#
# Requires npx; the first run downloads @mermaid-js/mermaid-cli and a Chromium
# build for it (~2 min). The renderer is only used at render time and only by
# this script.
#
# Why the two steps, and why the config:
#
#   - htmlLabels:false (top-level) makes Mermaid emit native <text>/<tspan>
#     labels instead of HTML inside <foreignObject>. Browsers render
#     foreignObject; librsvg, Inkscape and PDF converters do not, and draw the
#     boxes and arrows with every label silently missing. The per-flowchart
#     "flowchart.htmlLabels" key alone is NOT enough — it only converts edge
#     labels.
#   - patch-svg.mjs marks the text elements xml:space="preserve", without which
#     spec-compliant renderers glue multi-word labels together ("GitHubActions").
#     See the comment in that file.
set -euo pipefail

cd "$(dirname "$0")"

CONFIG="mermaid-config.json"
STYLES="diagram.css"
MMDC_VERSION="11"

targets=()
if [ "$#" -gt 0 ]; then
  for name in "$@"; do targets+=("${name%.mmd}.mmd"); done
else
  for f in *.mmd; do targets+=("$f"); done
fi

for src in "${targets[@]}"; do
  out="${src%.mmd}.svg"
  echo "render: $src -> $out"
  npx -y "@mermaid-js/mermaid-cli@${MMDC_VERSION}" \
    -i "$src" -o "$out" -c "$CONFIG" -C "$STYLES" -b transparent
done

echo "patch:"
node patch-svg.mjs "${targets[@]/%.mmd/.svg}"

echo "done. verify with a non-browser renderer, e.g.:"
echo "  magick -background white -density 96 <file>.svg /tmp/check.png"
