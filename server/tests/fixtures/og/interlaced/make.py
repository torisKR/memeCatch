"""Writes the Adam7 fixtures of tests/og_photo.rs (PLAN.md D3, R10-B2).

    python3 -I server/tests/fixtures/og/interlaced/make.py

Each fixture is a crop of a photo in ../photos written twice: `<name>.png`
interlaced (Adam7, encoded here: Pillow reads Adam7 but does not write it)
and `<name>-plain.png` not interlaced (Pillow). The rows of every pass use
the five filters in turn, so each pass starts from a fresh row above. The
sizes leave some passes empty or one pixel wide. Pillow decodes each
interlaced file back to the crop before it is kept.
"""

import struct
import zlib
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PHOTOS = HERE.parent / "photos"
# (x0, y0, dx, dy) of the seven passes.
PASSES = [(0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def filtered(kind, row, above, channels):
    out = bytearray()
    for i, value in enumerate(row):
        left = row[i - channels] if i >= channels else 0
        up = above[i]
        up_left = above[i - channels] if i >= channels else 0
        guess = [0, left, up, (left + up) // 2, paeth(left, up, up_left)][kind]
        out.append((value - guess) & 255)
    return bytes([kind]) + bytes(out)


def adam7(image):
    channels = len(image.getbands())
    width, height = image.size
    pixels = image.tobytes()
    raw = bytearray()
    for x0, y0, dx, dy in PASSES:
        columns = range(x0, width, dx)
        if not columns:
            continue
        above = bytes(len(columns) * channels)
        for index, y in enumerate(range(y0, height, dy)):
            row = b"".join(pixels[(y * width + x) * channels:(y * width + x + 1) * channels] for x in columns)
            raw += filtered(index % 5, row, above, channels)
            above = row
    color = {3: 2, 4: 6}[channels]
    header = struct.pack(">IIBBBBB", width, height, 8, color, 0, 0, 1)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


FIXTURES = [
    ("rgb-37x29", "png-rgb.png", (300, 200, 337, 229)),
    ("rgba-3x5", "png-tall-rgba.png", (200, 400, 203, 405)),
    ("rgba-61x1", "png-tall-rgba.png", (10, 10, 71, 11)),
]

for name, source, box in FIXTURES:
    crop = Image.open(PHOTOS / source).crop(box)
    interlaced = HERE / f"{name}.png"
    interlaced.write_bytes(adam7(crop))
    with Image.open(interlaced) as check:
        assert check.info.get("interlace") == 1, name
        assert check.tobytes() == crop.tobytes(), name
    crop.save(HERE / f"{name}-plain.png")
    print(name, crop.mode, crop.size)
