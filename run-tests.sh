#!/bin/bash
# Run every test. tests/ needs no game files; the mod tests need game-files/
# (python3 install.py extract). Results go to test-results/, one file per test
# file, plus SUMMARY.txt. JOBS=3 by default.
set -u
cd "$(dirname "$0")" || exit 1
OUT=$PWD/test-results
rm -rf "$OUT"; mkdir -p "$OUT"
export PYTHONDONTWRITEBYTECODE=1 OUT

one() {
  local o="$OUT/$(echo "$1" | tr / -).txt" out
  if out=$(timeout 1200 python3 "$1" 2>&1); then printf 'PASS %s\n%s\n' "$1" "$out" > "$o"
  else printf 'FAIL %s\n%s\n' "$1" "$out" > "$o"; fi
}
export -f one

files=(tests/test_*.py)
if [ -f game-files/scripts/c3main.js ] && [ -f game-files/data.json ]; then
  files+=(mods/*/test_*.py)
else
  echo "game-files/ is empty: running only tests/ (python3 install.py extract adds the mod tests)"
fi
printf '%s\n' "${files[@]}" | xargs -P "${JOBS:-3}" -I{} bash -c 'one {}'

{
  echo "test files: $(ls "$OUT"/*.txt | grep -vc SUMMARY)"
  echo "passed: $(head -qn1 "$OUT"/*.txt | grep -c '^PASS')"
  echo "failed: $(head -qn1 "$OUT"/*.txt | grep -c '^FAIL')"
  echo "test cases: $(grep -h '^Ran [0-9]* test' "$OUT"/*.txt | awk '{s+=$2} END {print s+0}')"
  echo "skipped: $(grep -ho 'skipped=[0-9]*' "$OUT"/*.txt | awk -F= '{s+=$2} END {print s+0}')"
  head -qn1 "$OUT"/*.txt | grep '^FAIL'
} > "$OUT/SUMMARY.txt"
cat "$OUT/SUMMARY.txt"
! grep -q '^FAIL' "$OUT/SUMMARY.txt"
