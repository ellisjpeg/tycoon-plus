package main

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A small bundle in the game's layout: c3main.js and data.json, then the blob.
func writeBundle(t *testing.T, dir string, files map[string][]byte, order []string) string {
	t.Helper()
	var d, blob bytes.Buffer
	for _, n := range order {
		rec := make([]byte, 37)
		binary.BigEndian.PutUint64(rec[8:], uint64(blob.Len()))
		binary.BigEndian.PutUint64(rec[16:], uint64(len(files[n])))
		binary.BigEndian.PutUint64(rec[24:], uint64(len(files[n])))
		rec[36] = byte(len(n))
		d.Write(rec)
		d.WriteString(n)
		blob.Write(files[n])
	}
	hdr := make([]byte, 32)
	copy(hdr, "c3ab")
	copy(hdr[16:], "fdir")
	binary.BigEndian.PutUint32(hdr[24:], uint32(d.Len()+4))
	binary.BigEndian.PutUint32(hdr[28:], uint32(len(order)))
	bh := make([]byte, 12)
	copy(bh, "blob")
	binary.BigEndian.PutUint64(bh[4:], uint64(blob.Len()))
	path := filepath.Join(dir, "assets.dat")
	out := append(append(append(hdr, d.Bytes()...), bh...), blob.Bytes()...)
	if err := os.WriteFile(path, out, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestApplyOps(t *testing.T) {
	orig := []byte("hello world")
	var ops []byte
	ops = append(ops, 'C')
	ops = binary.AppendUvarint(ops, 0)
	ops = binary.AppendUvarint(ops, 6)
	ops = append(ops, 'A')
	ops = binary.AppendUvarint(ops, 5)
	ops = append(ops, "modde"...)
	ops = append(ops, 'C')
	ops = binary.AppendUvarint(ops, 10)
	ops = binary.AppendUvarint(ops, 1)
	got, err := applyOps(orig, ops)
	if err != nil || string(got) != "hello modded" {
		t.Fatalf("got %q, %v", got, err)
	}
	if _, err := applyOps(orig, []byte{'C', 20, 5}); err == nil {
		t.Fatal("a copy past the end must fail")
	}
	if _, err := applyOps(orig, []byte{'X'}); err == nil {
		t.Fatal("an unknown operation must fail")
	}
}

func TestPatchAndRestoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	files := map[string][]byte{c3mainKey: []byte("var a=1;"), dataKey: []byte(`{"x":1}`), "other.png": []byte("PNG")}
	path := writeBundle(t, dir, files, []string{c3mainKey, "other.png", dataKey})
	orig, _ := os.ReadFile(path)
	b, err := openBundle(path)
	if err != nil {
		t.Fatal(err)
	}
	head, _ := b.readHead()
	names := []string{c3mainKey, dataKey}
	newFiles := map[string][]byte{c3mainKey: []byte("var a=1;var mod=2;"), dataKey: []byte(`{"x":2,"y":3}`)}
	sizes := map[string]int64{c3mainKey: int64(len(newFiles[c3mainKey])), dataKey: int64(len(newFiles[dataKey]))}
	newHead, err := b.patchedHead(names, sizes)
	if err != nil {
		t.Fatal(err)
	}
	if err := writePatch(path, b.fileSize, names, newFiles, newHead); err != nil {
		t.Fatal(err)
	}
	p, err := openBundle(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range names {
		if got, _ := p.read(n); !bytes.Equal(got, newFiles[n]) {
			t.Fatalf("%s reads %q", n, got)
		}
	}
	if got, _ := p.read("other.png"); string(got) != "PNG" {
		t.Fatal("untouched file changed")
	}
	if err := restore(path, head, b.fileSize); err != nil {
		t.Fatal(err)
	}
	if now, _ := os.ReadFile(path); !bytes.Equal(now, orig) {
		t.Fatal("restore did not give back the original bytes")
	}
}

func TestRejectsOtherFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "assets.dat")
	os.WriteFile(path, []byte("not a bundle at all, just text padding to 32+ bytes"), 0o644)
	if _, err := openBundle(path); err == nil {
		t.Fatal("must refuse a file that is not a bundle")
	}
}

func TestGameDirAcceptsFolderFileOrExe(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "www"), 0o755)
	os.WriteFile(filepath.Join(dir, "www", "assets.dat"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(dir, gameExe), []byte("x"), 0o644)
	for _, a := range []string{dir, filepath.Join(dir, "www"), filepath.Join(dir, "www", "assets.dat"), filepath.Join(dir, gameExe)} {
		if got, err := gameDir(a); err != nil || got != dir {
			t.Fatalf("%s -> %q, %v", a, got, err)
		}
	}
	if _, err := gameDir(t.TempDir()); err == nil {
		t.Fatal("must refuse a folder without the game")
	}
}

// testPatch makes a patch in the release format for a two-file game: each set copies the
// original and adds its own bytes, like the real one.
func testPatch(t *testing.T, c3, data []byte) []byte {
	t.Helper()
	var body bytes.Buffer
	sets := map[string]any{}
	for _, set := range []struct {
		name    string
		without []string
		add     string
	}{{"default", []string{"names"}, ";var mod=1;"}, {"names", []string{}, ";var mod=1;var names=1;"}} {
		files := map[string]any{}
		for _, f := range []struct {
			key  string
			orig []byte
		}{{c3mainKey, c3}, {dataKey, data}} {
			var ops []byte
			ops = append(ops, 'C')
			ops = binary.AppendUvarint(ops, 0)
			ops = binary.AppendUvarint(ops, uint64(len(f.orig)))
			ops = append(ops, 'A')
			ops = binary.AppendUvarint(ops, uint64(len(set.add)))
			ops = append(ops, set.add...)
			target := append(append([]byte{}, f.orig...), set.add...)
			files[f.key] = map[string]any{"sha256": sum(target), "size": len(target), "at": body.Len(), "len": len(ops)}
			body.Write(ops)
		}
		sets[set.name] = map[string]any{"without": set.without, "files": files}
	}
	head, _ := json.Marshal(map[string]any{"mod_version": "test", "game_version": "test game",
		"c3main_sha256": sum(c3), "data_sha256": sum(data), "sets": sets})
	return append(append([]byte("DTPATCH1\n"), head...), append([]byte("\n"), body.Bytes()...)...)
}

func testGame(t *testing.T) (dir string, c3, data, orig []byte) {
	t.Helper()
	dir = t.TempDir()
	os.MkdirAll(filepath.Join(dir, "www"), 0o755)
	c3, data = []byte("var game=1;"), []byte(`{"project":1}`)
	path := writeBundle(t, filepath.Join(dir, "www"), map[string][]byte{c3mainKey: c3, dataKey: data, "a.png": []byte("PNG")},
		[]string{"a.png", c3mainKey, dataKey})
	orig, _ = os.ReadFile(path)
	return
}

func withPatch(t *testing.T, p []byte) {
	old := patchFile
	patchFile = p
	t.Cleanup(func() { patchFile = old })
}

func readRecord(t *testing.T, dir string) state {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, "www", stateName))
	if err != nil {
		t.Fatal(err)
	}
	var s state
	json.Unmarshal(raw, &s)
	return s
}

func TestNamesAreOffByDefault(t *testing.T) {
	dir, c3, data, orig := testGame(t)
	withPatch(t, testPatch(t, c3, data))
	if err := run([]string{"install", "--game-dir", dir}); err != nil {
		t.Fatal(err)
	}
	if s := readRecord(t, dir); len(s.Without) != 1 || s.Without[0] != "names" {
		t.Fatalf("default install left out %v, want [names]", s.Without)
	}
	b, _ := openBundle(filepath.Join(dir, "www", "assets.dat"))
	if got, _ := b.read(c3mainKey); string(got) != "var game=1;;var mod=1;" {
		t.Fatalf("default install wrote %q", got)
	}
	if err := run([]string{"uninstall", "--game-dir", dir}); err != nil {
		t.Fatal(err)
	}
	if now, _ := os.ReadFile(filepath.Join(dir, "www", "assets.dat")); !bytes.Equal(now, orig) {
		t.Fatal("uninstall did not restore the original bytes")
	}
	if entries, _ := os.ReadDir(filepath.Join(dir, "www")); len(entries) != 1 {
		t.Fatalf("uninstall left files behind: %v", entries)
	}
}

func TestWithNamesOptIn(t *testing.T) {
	dir, c3, data, _ := testGame(t)
	withPatch(t, testPatch(t, c3, data))
	if err := run([]string{"install", "--with-names", "--game-dir", dir}); err != nil {
		t.Fatal(err)
	}
	if s := readRecord(t, dir); len(s.Without) != 0 {
		t.Fatalf("--with-names left out %v", s.Without)
	}
	b, _ := openBundle(filepath.Join(dir, "www", "assets.dat"))
	if got, _ := b.read(dataKey); string(got) != `{"project":1};var mod=1;var names=1;` {
		t.Fatalf("--with-names wrote %q", got)
	}
}

func TestRefusesOtherGameVersion(t *testing.T) {
	dir, _, data, orig := testGame(t)
	withPatch(t, testPatch(t, []byte("some other version"), data))
	if err := run([]string{"install", "--game-dir", dir}); err == nil || !strings.Contains(err.Error(), "not the one") {
		t.Fatalf("got %v", err)
	}
	if now, _ := os.ReadFile(filepath.Join(dir, "www", "assets.dat")); !bytes.Equal(now, orig) {
		t.Fatal("a refused install changed the game file")
	}
}

func TestGzippedPatchStillLoads(t *testing.T) {
	var z bytes.Buffer
	zw := gzip.NewWriter(&z)
	zw.Write([]byte("DTPATCH1\n{\"mod_version\":\"old\",\"sets\":{}}\n"))
	zw.Close()
	withPatch(t, z.Bytes())
	h, _, err := loadPatch()
	if err != nil || h.ModVersion != "old" {
		t.Fatalf("got %v, %v", h, err)
	}
}
