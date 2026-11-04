# Making a release (maintainers)

The Windows installer is two things joined together:

- **the program** (`player/`, Go): reads the game's bundle, applies the patch, keeps the backup,
  puts the original back. Built from this repository alone.
- **the mods patch** (`mods.dtpatch`): the mods' own code plus "copy this part of your game"
  steps. It can only be made from the game's files, so GitHub can't make it; a maintainer who
  owns the game does, and anyone else who owns the game can make it again and compare.

So the patch is made at home and its fingerprint is committed; GitHub builds the program in
public, checks the patch against that fingerprint, and puts both into the release.

## Steps

1. On a computer with the game (Python 3.10+, Node.js 18+, Go; Linux, macOS or Git Bash):

   ```
   python3 install.py extract        # your game's code into game-files/ (never committed)
   ./run-tests.sh                    # every test, with the mod tests
   ./tools/build-exe.sh              # player/mods.dtpatch, player/mods.dtpatch.sha256, dist/
   ```

   Test `dist/DevicesTycoonMods.exe` on Windows (install, play, uninstall).

2. Commit `player/mods.dtpatch.sha256` (not the patch, not `dist/`). Bump `MOD_VERSION` in
   `install.py` first if this is a new version. Push, then tag: `git tag v1.0.0 && git push origin v1.0.0`.
3. On GitHub: Releases > Draft a new release > choose the tag > attach `player/mods.dtpatch` >
   paste the notes > **Save draft** (don't publish yet).
4. Actions > release > Run workflow > tag `v1.0.0`. It refuses a patch that doesn't match the
   committed fingerprint, runs the tests, builds the program, signs a build attestation and
   attaches `DevicesTycoonMods.exe` and `SHA256SUMS.txt` to the draft.
5. Download the exe from the draft, check `DevicesTycoonMods.exe about` and the checksums, then
   publish the release.

## How a player (or anyone) can check a release

| Check | Command | What it proves |
|---|---|---|
| The download isn't damaged | PowerShell: `Get-FileHash DevicesTycoonMods.exe` and compare with `SHA256SUMS.txt` | It's the file the release lists |
| GitHub built it from this source | `gh attestation verify DevicesTycoonMods.exe --repo ellisjpeg/tycoon-plus` | Signed record of the workflow run, commit and tag that made it |
| The program is what the source makes | `BUILT_BY="the v1.0.0 release, built by GitHub Actions from the public source" ./tools/build-exe.sh --use-patch mods.dtpatch` with Go 1.23.4 | Same SHA-256 as the release: nothing else was added |
| The patch is what the source makes from the game | `python3 install.py extract` then `python3 tools/make_patch.py --check mods.dtpatch` | Same bytes, from your own copy of the game |
| What the patch adds | `python3 tools/make_patch.py --show mods.dtpatch out/` | Every added byte as text, copies from the game marked `[[copy ...]]` |
| Which patch a program carries | `DevicesTycoonMods.exe about` | Patch fingerprint and where the program was built |

## Code signing (later): SignPath Foundation

Unsigned programs get Windows' "Windows protected your PC" screen. SignPath Foundation signs
open-source programs for free. From signpath.org/terms (read 4 Nov 2026), the parts that matter
here:

- OSI licence for everything (MIT: fine), no proprietary parts, actively maintained.
- "Must already be released in the form that should be signed": apply after v1.0.0 is out.
- "Binary artifacts must be built from source code in a verifiable way" on CI, with each release
  approved by hand. **Open question for the application:** the patch is built from game files,
  not from this repository. Either explain the check above (`--check`) and ask whether that's
  enough, or commit `mods.dtpatch` itself to the repository so the program is built from the
  repository alone (it holds only the mods' code and copy steps, which the release publishes
  anyway, but the CI check against committed `.dtpatch` files would have to change).
- No "hacking tools"; must not change the system without warning; installers need an uninstall.
  The program changes one game file after asking, and puts it back exactly.
- Everyone on the project uses two-factor login on GitHub and SignPath; roles named (author,
  reviewer, approver).
- The project page needs a "Code signing policy" section with "Free code signing provided by
  SignPath.io, certificate by SignPath Foundation", the roles and a privacy line (the program
  collects nothing and connects to nothing).
- Signing then runs as an extra step in `release.yml` (SignPath's GitHub action submits the
  built exe and waits for the approved, signed file). Their setup docs are on about.signpath.io.

Signing changes the program's bytes, so the reproducible-build check would compare the
unsigned build; publish both hashes then.
