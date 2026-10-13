#!/usr/bin/env bash
# Analisa uma página com o REA (morluto/rea) via Chrome DevTools Protocol e
# salva a evidência em JSON + screenshot para estudo de layout.
#
# Uso: scripts/analisar-site.sh [URL] [PASTA_SAIDA]
set -euo pipefail

URL="${1:-https://monday.com/lang/pt}"
OUT="${2:-analise}"
PORT="${CDP_PORT:-9222}"
REA="npx -y rea-agents@6.4.0"
ENDPOINT="http://127.0.0.1:${PORT}"

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
  for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
fi
[[ -n "$CHROME" ]] || { echo "Chromium/Chrome não encontrado; defina CHROME=/caminho/do/chrome" >&2; exit 1; }

mkdir -p "$OUT"
PROFILE="$(mktemp -d)"
"$CHROME" --headless=new --no-sandbox --password-store=basic \
  --remote-debugging-port="$PORT" --user-data-dir="$PROFILE" \
  --window-size=1440,900 "$URL" >"$OUT/chrome.log" 2>&1 &
CHROME_PID=$!
trap 'kill "$CHROME_PID" 2>/dev/null || true; wait "$CHROME_PID" 2>/dev/null || true; rm -rf "$PROFILE"' EXIT

# Espera a página carregar (URL http(s) diferente de about:blank).
TARGET=""
for _ in $(seq 1 60); do
  TARGET="$(curl -fsS "$ENDPOINT/json/list" 2>/dev/null | python3 -c '
import json, sys
for t in json.load(sys.stdin):
    if t.get("type") == "page" and t.get("url", "").startswith("http"):
        print(t["id"]); break
' 2>/dev/null || true)"
  [[ -n "$TARGET" ]] && break
  sleep 1
done
[[ -n "$TARGET" ]] || { echo "A página não carregou; veja $OUT/chrome.log" >&2; exit 1; }
sleep 5

$REA list-browser-targets "$ENDPOINT" --format json >"$OUT/alvos.json"
$REA inspect-web-page "$ENDPOINT" "$TARGET" --observation-ms 3000 \
  --include-accessibility-text --format json >"$OUT/pagina.json"
$REA analyze-web-bundle "$ENDPOINT" "$TARGET" --format json >"$OUT/bundle.json"
$REA capture-web-screenshot "$ENDPOINT" "$TARGET" --format json >"$OUT/screenshot.json"

python3 - "$OUT/screenshot.json" "$OUT/screenshot.png" <<'PY'
import base64, json, sys
artifact = json.load(open(sys.argv[1]))["normalized_result"]["artifact"]
open(sys.argv[2], "wb").write(base64.b64decode(artifact["data_base64"]))
PY

echo "Evidência salva em $OUT/ (pagina.json, bundle.json, screenshot.png)"
