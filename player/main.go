// Devices Tycoon Mods installer for players: one program, no Python or Node.js.
//
// Double-click it (or drag the game folder onto it) to install or remove the
// mods; from a terminal: "DevicesTycoonMods status|install|uninstall|about
// [--game-dir DIR] [--with-names] [--yes]". It changes only www/assets.dat,
// in the same way as install.py and with the same backup files, so either tool
// can remove what the other installed. The mods arrive as a patch (mods.dtpatch,
// built into this program) that is replayed on the player's own game code, and
// only on the game version it was made for. Real company and brand names (the
// names mod) are only added when the player asks for them.
package main

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

//go:embed mods.dtpatch
var patchFile []byte

// Set by the release workflow (-ldflags "-X main.builtBy=..."): where this copy was built.
var builtBy = "a local build from the source code"

const (
	appID     = "2085660"
	c3mainKey = "scripts/c3main.js"
	dataKey   = "data.json"
	stateName = "assets.dat.mods.json"
	headName  = "assets.dat.mods-head"
	gameExe   = "Devices Tycoon.exe"
)

// ── The patch ──

type patchSet struct {
	Without []string `json:"without"`
	Files   map[string]struct {
		Sha256 string `json:"sha256"`
		Size   int    `json:"size"`
		At     int    `json:"at"`
		Len    int    `json:"len"`
	} `json:"files"`
}

type patchHeader struct {
	ModVersion  string              `json:"mod_version"`
	GameVersion string              `json:"game_version"`
	C3mainSha   string              `json:"c3main_sha256"`
	DataSha     string              `json:"data_sha256"`
	Sets        map[string]patchSet `json:"sets"`
}

func loadPatch() (*patchHeader, []byte, error) {
	raw := patchFile
	if bytes.HasPrefix(raw, []byte{0x1f, 0x8b}) { // patches before 1.0.0 were gzipped
		zr, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			return nil, nil, err
		}
		if raw, err = io.ReadAll(zr); err != nil {
			return nil, nil, err
		}
	}
	const magic = "DTPATCH1\n"
	if !bytes.HasPrefix(raw, []byte(magic)) {
		return nil, nil, errors.New("the built-in patch is damaged")
	}
	raw = raw[len(magic):]
	nl := bytes.IndexByte(raw, '\n')
	if nl < 0 {
		return nil, nil, errors.New("the built-in patch is damaged")
	}
	var h patchHeader
	if err := json.Unmarshal(raw[:nl], &h); err != nil {
		return nil, nil, err
	}
	return &h, raw[nl+1:], nil
}

// applyOps replays copy/add operations on the original file.
func applyOps(orig, ops []byte) ([]byte, error) {
	var out bytes.Buffer
	for i := 0; i < len(ops); {
		kind := ops[i]
		i++
		switch kind {
		case 'C':
			off, n := binary.Uvarint(ops[i:])
			if n <= 0 {
				return nil, errors.New("bad patch")
			}
			i += n
			ln, m := binary.Uvarint(ops[i:])
			if m <= 0 || off+ln > uint64(len(orig)) {
				return nil, errors.New("bad patch")
			}
			i += m
			out.Write(orig[off : off+ln])
		case 'A':
			ln, n := binary.Uvarint(ops[i:])
			if n <= 0 || uint64(i+n)+ln > uint64(len(ops)) {
				return nil, errors.New("bad patch")
			}
			i += n
			out.Write(ops[i : i+int(ln)])
			i += int(ln)
		default:
			return nil, errors.New("bad patch")
		}
	}
	return out.Bytes(), nil
}

func sum(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func sumFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// ── The game's asset bundle (www/assets.dat, format "c3ab"; see patcher/c3ab.py) ──

type entry struct {
	pos, offset, size, stored int64
	flags                     uint32
}

type bundle struct {
	path     string
	entries  map[string]entry
	headSize int64
	blobSize int64
	fileSize int64
}

func openBundle(path string) (*bundle, error) {
	st, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	hdr := make([]byte, 32)
	if _, err := io.ReadFull(f, hdr); err != nil || string(hdr[:4]) != "c3ab" || string(hdr[16:20]) != "fdir" {
		return nil, fmt.Errorf("%s is not a Construct asset bundle", path)
	}
	dirSize := int64(binary.BigEndian.Uint32(hdr[24:]))
	count := int(binary.BigEndian.Uint32(hdr[28:]))
	dir := make([]byte, dirSize-4)
	if _, err := io.ReadFull(f, dir); err != nil {
		return nil, fmt.Errorf("%s: directory is cut short", path)
	}
	b := &bundle{path: path, entries: map[string]entry{}, fileSize: st.Size()}
	pos := int64(0)
	for k := 0; k < count; k++ {
		if pos+37 > int64(len(dir)) {
			return nil, fmt.Errorf("%s: directory is cut short", path)
		}
		d := dir[pos:]
		e := entry{pos: 32 + pos, offset: int64(binary.BigEndian.Uint64(d[8:])), size: int64(binary.BigEndian.Uint64(d[16:])),
			stored: int64(binary.BigEndian.Uint64(d[24:])), flags: binary.BigEndian.Uint32(d[32:])}
		nl := int64(d[36])
		if pos+37+nl > int64(len(dir)) {
			return nil, fmt.Errorf("%s: directory is cut short", path)
		}
		b.entries[string(d[37:37+nl])] = e
		pos += 37 + nl
	}
	if pos+4 != dirSize {
		return nil, fmt.Errorf("%s: directory size and entry count disagree", path)
	}
	blob := make([]byte, 12)
	if _, err := f.ReadAt(blob, 32+pos); err != nil || string(blob[:4]) != "blob" {
		return nil, fmt.Errorf("%s: blob header missing", path)
	}
	b.blobSize = int64(binary.BigEndian.Uint64(blob[4:]))
	b.headSize = 32 + pos + 12
	if b.headSize+b.blobSize != b.fileSize {
		return nil, fmt.Errorf("%s: blob size does not match the file", path)
	}
	for name, e := range b.entries {
		if e.offset+e.stored > b.blobSize {
			return nil, fmt.Errorf("%s: %s points past the end of the blob", path, name)
		}
	}
	return b, nil
}

func (b *bundle) read(name string) ([]byte, error) {
	e, ok := b.entries[name]
	if !ok {
		return nil, fmt.Errorf("%s is not in %s", name, b.path)
	}
	if e.flags != 0 || e.size != e.stored {
		return nil, fmt.Errorf("%s is stored in a way this tool does not know", name)
	}
	f, err := os.Open(b.path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	out := make([]byte, e.size)
	if _, err := f.ReadAt(out, b.headSize+e.offset); err != nil {
		return nil, fmt.Errorf("%s is cut short in %s", name, b.path)
	}
	return out, nil
}

func (b *bundle) readHead() ([]byte, error) {
	f, err := os.Open(b.path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	out := make([]byte, b.headSize)
	_, err = io.ReadFull(f, out)
	return out, err
}

// patchedHead: the head when the files are appended in this order.
func (b *bundle) patchedHead(names []string, sizes map[string]int64) ([]byte, error) {
	head, err := b.readHead()
	if err != nil {
		return nil, err
	}
	off := b.blobSize
	for _, n := range names {
		e := b.entries[n]
		binary.BigEndian.PutUint64(head[e.pos+8:], uint64(off))
		binary.BigEndian.PutUint64(head[e.pos+16:], uint64(sizes[n]))
		binary.BigEndian.PutUint64(head[e.pos+24:], uint64(sizes[n]))
		off += sizes[n]
	}
	binary.BigEndian.PutUint64(head[b.headSize-8:], uint64(off))
	return head, nil
}

func restore(path string, head []byte, size int64) error {
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.WriteAt(head, 0); err != nil {
		return err
	}
	if err := f.Truncate(size); err != nil {
		return err
	}
	return f.Sync()
}

// ── Finding the game ──

func steamRoots() []string {
	var roots []string
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		if out, err := exec.Command("reg", "query", `HKCU\Software\Valve\Steam`, "/v", "SteamPath").Output(); err == nil {
			if m := regexp.MustCompile(`SteamPath\s+REG_SZ\s+(.+)`).FindSubmatch(out); m != nil {
				roots = append(roots, filepath.FromSlash(strings.TrimSpace(string(m[1]))))
			}
		}
		for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles"} {
			if v := os.Getenv(env); v != "" {
				roots = append(roots, filepath.Join(v, "Steam"))
			}
		}
	case "darwin":
		roots = append(roots, filepath.Join(home, "Library/Application Support/Steam"))
	default:
		roots = append(roots, filepath.Join(home, ".steam/steam"), filepath.Join(home, ".local/share/Steam"),
			filepath.Join(home, ".var/app/com.valvesoftware.Steam/.local/share/Steam"))
	}
	return roots
}

func findGame() string {
	pathRe := regexp.MustCompile(`"path"\s+"([^"]+)"`)
	dirRe := regexp.MustCompile(`"installdir"\s+"([^"]+)"`)
	for _, root := range steamRoots() {
		libs := []string{root}
		if vdf, err := os.ReadFile(filepath.Join(root, "steamapps", "libraryfolders.vdf")); err == nil {
			for _, m := range pathRe.FindAllSubmatch(vdf, -1) {
				libs = append(libs, strings.ReplaceAll(string(m[1]), `\\`, `\`))
			}
		}
		for _, lib := range libs {
			acf, err := os.ReadFile(filepath.Join(lib, "steamapps", "appmanifest_"+appID+".acf"))
			if err != nil {
				continue
			}
			if m := dirRe.FindSubmatch(acf); m != nil {
				dir := filepath.Join(lib, "steamapps", "common", string(m[1]))
				if isFile(filepath.Join(dir, "www", "assets.dat")) {
					return dir
				}
			}
		}
	}
	return ""
}

func isFile(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.Mode().IsRegular()
}

// gameDir accepts the game folder, its www folder, assets.dat or the game's exe.
func gameDir(arg string) (string, error) {
	if arg == "" {
		if d := findGame(); d != "" {
			return d, nil
		}
		return "", errors.New("could not find Devices Tycoon in your Steam libraries.\n" +
			"Drag the game's folder onto this program, or use --game-dir \"C:\\path\\to\\Devices Tycoon\"")
	}
	p, _ := filepath.Abs(arg)
	for _, c := range []string{p, filepath.Dir(p), filepath.Dir(filepath.Dir(p))} {
		if isFile(filepath.Join(c, "www", "assets.dat")) {
			return c, nil
		}
	}
	return "", fmt.Errorf("%s is not the game's folder (it has no www\\assets.dat)", arg)
}

func gameRunning() bool {
	if runtime.GOOS != "windows" {
		return false
	}
	out, err := exec.Command("tasklist", "/FI", "IMAGENAME eq "+gameExe, "/NH").Output()
	return err == nil && bytes.Contains(bytes.ToLower(out), bytes.ToLower([]byte(gameExe)))
}

// ── Install record (same files and fields as install.py) ──

type state struct {
	ModVersion         string   `json:"mod_version"`
	Installed          string   `json:"installed"`
	GameVersion        string   `json:"game_version"`
	Without            []string `json:"without"`
	OriginalSize       int64    `json:"original_size"`
	OriginalSha256     string   `json:"original_sha256"`
	OriginalHeadSha256 string   `json:"original_head_sha256"`
	PatchedSize        int64    `json:"patched_size"`
	PatchedHeadSha256  string   `json:"patched_head_sha256"`
}

type paths struct{ bundle, state, head string }

func pathsFor(dir string) paths {
	www := filepath.Join(dir, "www")
	return paths{filepath.Join(www, "assets.dat"), filepath.Join(www, stateName), filepath.Join(www, headName)}
}

// readState returns the record if the mods are in the current file; a record left behind
// by a Steam update or file check is removed.
func readState(p paths) (*state, error) {
	raw, err := os.ReadFile(p.state)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var s state
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, fmt.Errorf("%s is damaged: %v", p.state, err)
	}
	b, err := openBundle(p.bundle)
	if err != nil {
		return nil, err
	}
	head, err := b.readHead()
	if err != nil {
		return nil, err
	}
	if b.fileSize == s.PatchedSize && sum(head) == s.PatchedHeadSha256 {
		return &s, nil
	}
	os.Remove(p.state)
	os.Remove(p.head)
	fmt.Println("Steam has replaced the game files since the mods were installed; removed the old install record.")
	return nil, nil
}

// ── Commands ──

func status(p paths, h *patchHeader) error {
	s, err := readState(p)
	if err != nil {
		return err
	}
	if s != nil {
		fmt.Printf("Mods %s are installed (%s) on: %s\n", s.ModVersion, s.Installed, s.GameVersion)
		if len(s.Without) > 0 {
			fmt.Println("Left out: " + strings.Join(s.Without, ", "))
		}
		return nil
	}
	b, err := openBundle(p.bundle)
	if err != nil {
		return err
	}
	if err := identify(b, h); err != nil {
		return err
	}
	fmt.Println("Mods not installed. Game version: " + h.GameVersion)
	return nil
}

func identify(b *bundle, h *patchHeader) error {
	c3, err := b.read(c3mainKey)
	if err != nil {
		return err
	}
	data, err := b.read(dataKey)
	if err != nil {
		return err
	}
	if sum(c3) != h.C3mainSha || sum(data) != h.DataSha {
		return errors.New("this game version is not the one these mods were made for, so nothing was changed.\n" +
			"If the game was just updated, wait for a mod update. This installer is for: " + h.GameVersion)
	}
	return nil
}

func install(p paths, h *patchHeader, ops []byte, set string) error {
	if s, err := readState(p); err != nil {
		return err
	} else if s != nil {
		return errors.New("the mods are already installed. Remove them first to change them")
	}
	if gameRunning() {
		return errors.New("the game is running. Close it, then try again")
	}
	b, err := openBundle(p.bundle)
	if err != nil {
		return err
	}
	if err := identify(b, h); err != nil {
		return err
	}
	ps, ok := h.Sets[set]
	if !ok {
		return errors.New("this copy of the installer has no mods in it (a test build). Download it from the project's Releases page")
	}
	names := []string{c3mainKey, dataKey}
	files := map[string][]byte{}
	sizes := map[string]int64{}
	for _, n := range names {
		orig, err := b.read(n)
		if err != nil {
			return err
		}
		f := ps.Files[n]
		out, err := applyOps(orig, ops[f.At:f.At+f.Len])
		if err != nil || sum(out) != f.Sha256 {
			return errors.New("the mods could not be applied to this copy of the game, so nothing was changed")
		}
		files[n], sizes[n] = out, int64(len(out))
	}
	fmt.Println("Checking the original file...")
	origSha, err := sumFile(p.bundle)
	if err != nil {
		return err
	}
	head, err := b.readHead()
	if err != nil {
		return err
	}
	newHead, err := b.patchedHead(names, sizes)
	if err != nil {
		return err
	}
	s := state{ModVersion: h.ModVersion, Installed: time.Now().Format("2006-01-02 15:04"), GameVersion: h.GameVersion,
		Without: append([]string{}, ps.Without...), OriginalSize: b.fileSize, OriginalSha256: origSha,
		OriginalHeadSha256: sum(head), PatchedSize: b.fileSize + sizes[c3mainKey] + sizes[dataKey], PatchedHeadSha256: sum(newHead)}
	if err := os.WriteFile(p.head, head, 0o644); err != nil {
		return fmt.Errorf("could not save the backup next to the game: %v", err)
	}
	rec, _ := json.MarshalIndent(s, "", "  ")
	if err := os.WriteFile(p.state, append(rec, '\n'), 0o644); err != nil {
		os.Remove(p.head)
		return fmt.Errorf("could not save the install record next to the game: %v", err)
	}
	undo := func(why error) error {
		if cur, err := openBundle(p.bundle); err != nil || cur.fileSize != b.fileSize || !headIs(cur, head) {
			if err := restore(p.bundle, head, b.fileSize); err != nil {
				return errors.New("could not restore the game file. In Steam, right-click Devices Tycoon > " +
					"Properties > Installed Files > Verify integrity of game files")
			}
		}
		os.Remove(p.state)
		os.Remove(p.head)
		return why
	}
	if err := writePatch(p.bundle, b.fileSize, names, files, newHead); err != nil {
		return undo(fmt.Errorf("could not write to the game file, so it was left as it was. Is the game still running? (%v)", err))
	}
	after, err := openBundle(p.bundle)
	if err == nil {
		for _, n := range names {
			got, e := after.read(n)
			if e != nil || !bytes.Equal(got, files[n]) {
				err = errors.New("read-back mismatch")
			}
		}
	}
	if err != nil {
		return undo(errors.New("the patched file did not read back correctly; the original was put back"))
	}
	fmt.Println("Installed. Start the game from Steam as usual.")
	return nil
}

func headIs(b *bundle, head []byte) bool {
	h, err := b.readHead()
	return err == nil && bytes.Equal(h, head)
}

// writePatch appends the new bodies, then switches the directory over to them.
func writePatch(path string, size int64, names []string, files map[string][]byte, head []byte) error {
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	defer f.Close()
	at := size
	for _, n := range names {
		if _, err := f.WriteAt(files[n], at); err != nil {
			return err
		}
		at += int64(len(files[n]))
	}
	if err := f.Sync(); err != nil {
		return err
	}
	// Until here the game still reads its original files.
	if _, err := f.WriteAt(head, 0); err != nil {
		return err
	}
	return f.Sync()
}

func uninstall(p paths) error {
	s, err := readState(p)
	if err != nil {
		return err
	}
	if s == nil {
		fmt.Println("The mods are not installed.")
		return nil
	}
	if gameRunning() {
		return errors.New("the game is running. Close it, then try again")
	}
	head, err := os.ReadFile(p.head)
	if err != nil || sum(head) != s.OriginalHeadSha256 {
		return fmt.Errorf("the backup %s is missing or damaged; nothing was changed. Use Steam's "+
			"\"Verify integrity of game files\" to get the original back", p.head)
	}
	fmt.Println("Restoring the original file...")
	if err := restore(p.bundle, head, s.OriginalSize); err != nil {
		return fmt.Errorf("could not write to the game file. Is the game still running? (%v)", err)
	}
	if got, err := sumFile(p.bundle); err != nil || got != s.OriginalSha256 {
		return errors.New("could not restore the game file. In Steam, right-click Devices Tycoon > " +
			"Properties > Installed Files > Verify integrity of game files")
	}
	os.Remove(p.state)
	os.Remove(p.head)
	fmt.Println("Removed. The game file is exactly the original again.")
	return nil
}

// ── Talking to the player ──

var in = bufio.NewReader(os.Stdin)

func ask(q string, yes bool) bool {
	hint := " [Y/n] "
	if !yes {
		hint = " [y/N] "
	}
	fmt.Print(q + hint)
	line, err := in.ReadString('\n')
	if err != nil {
		return false
	}
	line = strings.ToLower(strings.TrimSpace(line))
	if line == "" {
		return yes
	}
	return strings.HasPrefix(line, "y")
}

func run(args []string) error {
	h, ops, err := loadPatch()
	if err != nil {
		return err
	}
	cmd, dir, assume, set := "", "", false, "default"
	for i := 0; i < len(args); i++ {
		switch a := args[i]; a {
		case "status", "install", "uninstall", "about":
			cmd = a
		case "--version":
			cmd = "about"
		case "--game-dir":
			if i+1 >= len(args) {
				return errors.New("--game-dir needs a folder")
			}
			i++
			dir = args[i]
		case "--with-names":
			set = "names"
		case "--without-names": // the default; still accepted
			set = "default"
		case "--yes", "-y":
			assume = true
		case "--help", "-h", "/?":
			fmt.Println(usage)
			return nil
		default:
			if strings.HasPrefix(a, "-") {
				return fmt.Errorf("unknown option %s", a)
			}
			dir = a // a folder dragged onto the program
		}
	}
	fmt.Printf("Devices Tycoon Mods %s (unofficial)\n\n", h.ModVersion)
	if cmd == "about" {
		about(h)
		return nil
	}
	gd, err := gameDir(dir)
	if err != nil {
		return err
	}
	p := pathsFor(gd)
	fmt.Println("Game: " + gd)
	switch cmd {
	case "status":
		return status(p, h)
	case "install":
		return install(p, h, ops, set)
	case "uninstall":
		return uninstall(p)
	}
	// No command: ask.
	s, err := readState(p)
	if err != nil {
		return err
	}
	if s != nil {
		fmt.Printf("Mods %s are installed (%s).\n", s.ModVersion, s.Installed)
		if assume || ask("Remove them and put the original game back?", false) {
			return uninstall(p)
		}
		return nil
	}
	if err := status(p, h); err != nil {
		return err
	}
	fmt.Println("\nClose the game before going on. Your saves are not touched.")
	if !assume && !ask("Install the mods?", true) {
		return nil
	}
	if set == "default" && !assume {
		fmt.Println("\nOptional extra: the game uses made-up company names on purpose (Nokya, not Nokia).")
		if ask("Swap them for the real names? Most players leave this off.", false) {
			set = "names"
		}
	}
	return install(p, h, ops, set)
}

const usage = `Usage: DevicesTycoonMods [command] [options]

Commands (with none, the program asks what to do):
  status      say whether the mods are installed
  install     install the mods
  uninstall   remove them and put the original game file back exactly
  about       show this program's version and the fingerprint of the mods inside it

Options:
  --game-dir DIR   the game's folder, if it is not found through Steam
  --with-names     also use real company and brand names (off unless you add this)
  --yes            don't ask questions`

// about prints what a player needs to check this copy against the release page.
func about(h *patchHeader) {
	fmt.Println("Mods version:   " + h.ModVersion)
	fmt.Println("For the game:   " + h.GameVersion)
	fmt.Println("Mods patch:     SHA-256 " + sum(patchFile))
	fmt.Println("This program:   " + builtBy)
	if exe, err := os.Executable(); err == nil {
		if s, err := sumFile(exe); err == nil {
			fmt.Println("Program file:   SHA-256 " + s)
		}
	}
	fmt.Println("\nCompare these with SHA256SUMS.txt on the project's Releases page.")
}

func main() {
	err := run(os.Args[1:])
	interactive := len(os.Args) == 1 || (len(os.Args) == 2 && !strings.HasPrefix(os.Args[1], "-") &&
		os.Args[1] != "status" && os.Args[1] != "install" && os.Args[1] != "uninstall" && os.Args[1] != "about")
	if err != nil {
		fmt.Println("\nError: " + strings.ToUpper(err.Error()[:1]) + err.Error()[1:])
	}
	if interactive && runtime.GOOS == "windows" {
		fmt.Print("\nPress Enter to close.")
		in.ReadString('\n')
	}
	if err != nil {
		os.Exit(1)
	}
}
