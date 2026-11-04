#!/bin/bash
# Build the player installer: the Windows program with the mods patch inside.
#   ./tools/build-exe.sh                    make the patch from your game-files/ (Python 3.10+,
#                                           Node.js 18+), then build. Maintainers, before a release.
#   ./tools/build-exe.sh --use-patch FILE   build with a patch that was already made, after checking
#                                           it against player/mods.dtpatch.sha256 (the release
#                                           workflow does this; no game files needed).
# Writes dist/DevicesTycoonMods.exe, dist/mods.dtpatch and dist/SHA256SUMS.txt.
#
# The build is reproducible: the same source, patch, Go version (the toolchain line in
# player/go.mod) and BUILT_BY text give a byte-identical program on any computer, so anyone
# can rebuild a release and compare its SHA-256. BUILT_BY is the text "about" shows.
set -euo pipefail
cd "$(dirname "$0")/.."
BUILT_BY=${BUILT_BY:-a local build from the source code}
sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
if [ "${1:-}" = "--use-patch" ]; then
  [ -f "${2:-}" ] || { echo "usage: $0 --use-patch FILE" >&2; exit 2; }
  want=$(cut -d' ' -f1 player/mods.dtpatch.sha256)
  got=$(sha "$2" | cut -d' ' -f1)
  if [ "$got" != "$want" ]; then
    echo "$2 has SHA-256 $got, but player/mods.dtpatch.sha256 says $want: not building." >&2
    exit 1
  fi
  [ "$2" -ef player/mods.dtpatch ] || cp "$2" player/mods.dtpatch
else
  python3 -X utf8 tools/make_patch.py player/mods.dtpatch
fi
mkdir -p dist
cd player
go version
go vet .
go test .
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false \
  -ldflags "-s -w -buildid= -X 'main.builtBy=$BUILT_BY'" -o ../dist/DevicesTycoonMods.exe .
cd ..
cp player/mods.dtpatch dist/mods.dtpatch
(cd dist && sha DevicesTycoonMods.exe mods.dtpatch > SHA256SUMS.txt && cat SHA256SUMS.txt)
