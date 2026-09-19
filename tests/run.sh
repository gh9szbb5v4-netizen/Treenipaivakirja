#!/bin/sh
# Ajaa kaikki tests/test_*.js-tiedostot yhtä paikallista HTTP-palvelinta
# vasten. Käyttö: cd tests && npm install && npx playwright install chromium && npm test
# Yksittäinen testi: node test_history_move.js (palvelimen on oltava käynnissä
# portissa 8765, esim. python3 -m http.server 8765 --directory .. ).
cd "$(dirname "$0")" || exit 1
if ! curl -s -o /dev/null http://127.0.0.1:8765/index.html; then
  python3 -m http.server 8765 --directory .. >/dev/null 2>&1 &
  SERVER_PID=$!
  sleep 1
fi
export NODE_PATH="$(pwd)/node_modules:$(npm root -g)"
FAILS=0
for t in test_*.js; do
  echo "### $t"
  if ! node "$t" > "$t.log" 2>&1; then FAILS=$((FAILS+1)); echo "    EPÄONNISTUI (ks. $t.log)"; else tail -1 "$t.log"; fi
done
[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
echo "Epäonnistuneita testitiedostoja: $FAILS"
[ "$FAILS" -eq 0 ]
