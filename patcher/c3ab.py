"""Read and patch a Construct 3 asset bundle (the game's www/assets.dat, format "c3ab").

Layout, all numbers big-endian, as found in the Windows build of Devices Tycoon:

    0   "c3ab", 12 header bytes
    16  "fdir", u32 0, u32 directory size, u32 entry count
    32  entries: u64 0, u64 offset, u64 size, u64 stored size, u32 flags, u8 name length, name
        "blob", u64 blob size, then the blob (entry offsets count from the blob's first byte)

Patching never moves or rewrites existing file data. The new bodies are appended
to the end of the blob and only their directory entries and the blob size change,
so every byte that changes before the old end of the file sits in the "head"
(header, directory and blob header, under 1 MB). Saving that head first is a
complete backup: writing it back and cutting the file to its old length restores
the original exactly.
"""
from __future__ import annotations

import hashlib
import os
import struct
from dataclasses import dataclass
from pathlib import Path

HEADER = 32
ENTRY = struct.Struct(">QQQQIB")
BLOB = struct.Struct(">4sQ")


class BundleError(ValueError):
    pass


@dataclass
class Entry:
    name: str
    pos: int       # where this entry's fields start in the file
    offset: int    # from the blob's first byte
    size: int
    stored_size: int
    flags: int


@dataclass
class Bundle:
    path: Path
    entries: dict[str, Entry]
    head_size: int   # header + directory + blob header
    blob_size: int
    file_size: int

    @property
    def blob_start(self) -> int:
        return self.head_size

    def read(self, name: str) -> bytes:
        e = self.entries.get(name)
        if e is None:
            raise BundleError(f"{name} is not in {self.path}")
        if e.flags != 0 or e.size != e.stored_size:
            raise BundleError(f"{name} is stored in a way this tool does not know (flags {e.flags})")
        with self.path.open("rb") as f:
            f.seek(self.blob_start + e.offset)
            data = f.read(e.size)
        if len(data) != e.size:
            raise BundleError(f"{name} is cut short in {self.path}")
        return data

    def read_head(self) -> bytes:
        with self.path.open("rb") as f:
            return f.read(self.head_size)


def open_bundle(path: Path) -> Bundle:
    path = Path(path)
    file_size = path.stat().st_size
    with path.open("rb") as f:
        header = f.read(HEADER)
        if len(header) < HEADER or header[:4] != b"c3ab" or header[16:20] != b"fdir":
            raise BundleError(f"{path} is not a Construct asset bundle")
        directory_size, count = struct.unpack_from(">II", header, 24)
        directory = f.read(directory_size - 4)
        entries: dict[str, Entry] = {}
        pos = 0
        for _ in range(count):
            if pos + ENTRY.size > len(directory):
                raise BundleError(f"{path}: directory is cut short")
            _, offset, size, stored_size, flags, name_len = ENTRY.unpack_from(directory, pos)
            name = directory[pos + ENTRY.size:pos + ENTRY.size + name_len].decode("utf-8")
            entries[name] = Entry(name, HEADER + pos, offset, size, stored_size, flags)
            pos += ENTRY.size + name_len
        if pos + 4 != directory_size:
            raise BundleError(f"{path}: directory size and entry count disagree")
        f.seek(HEADER + pos)
        tag, blob_size = BLOB.unpack(f.read(BLOB.size))
    head_size = HEADER + pos + BLOB.size
    if tag != b"blob" or head_size + blob_size != file_size:
        raise BundleError(f"{path}: blob size does not match the file")
    for e in entries.values():
        if e.offset + e.stored_size > blob_size:
            raise BundleError(f"{path}: {e.name} points past the end of the blob")
    return Bundle(path, entries, head_size, blob_size, file_size)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def patched_head(bundle: Bundle, new_files: dict[str, int]) -> tuple[bytes, list[tuple[str, int]]]:
    """The new head when each named file (name -> new size) is appended in order.

    Returns the head bytes and the (name, offset) placement used.
    """
    head = bytearray(bundle.read_head())
    placement = []
    offset = bundle.blob_size
    for name, size in new_files.items():
        e = bundle.entries[name]
        struct.pack_into(">QQQ", head, e.pos + 8, offset, size, size)
        placement.append((name, offset))
        offset += size
    struct.pack_into(">Q", head, bundle.head_size - 8, offset)
    return bytes(head), placement


def write_patch(bundle: Bundle, files: dict[str, bytes]) -> None:
    """Append the new bodies, then switch the directory over to them."""
    head, placement = patched_head(bundle, {n: len(b) for n, b in files.items()})
    with bundle.path.open("r+b") as f:
        f.seek(bundle.file_size)
        for name, _ in placement:
            f.write(files[name])
        f.flush()
        os.fsync(f.fileno())
        # Until this point the game still reads its original files.
        f.seek(0)
        f.write(head)
        f.flush()
        os.fsync(f.fileno())


def restore(path: Path, head: bytes, size: int) -> None:
    """Undo write_patch: put the saved head back and drop the appended bodies."""
    with Path(path).open("r+b") as f:
        f.seek(0)
        f.write(head)
        f.truncate(size)
        f.flush()
        os.fsync(f.fileno())
