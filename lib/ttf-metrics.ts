export type FontAdvances = {
  unitsPerEm: number;
  /** Code point → horizontal advance in font units. Missing glyphs are absent. */
  advances: Map<number, number>;
};

function readTables(data: Buffer): Map<string, number> {
  const numTables = data.readUInt16BE(4);
  const tables = new Map<string, number>();
  let cursor = 12;
  for (let index = 0; index < numTables; index += 1) {
    const tag = data.toString("latin1", cursor, cursor + 4);
    tables.set(tag, data.readUInt32BE(cursor + 8));
    cursor += 16;
  }
  return tables;
}

function glyphAdvance(data: Buffer, hmtx: number, numberOfHMetrics: number, glyphId: number): number {
  const index = glyphId < numberOfHMetrics ? glyphId : numberOfHMetrics - 1;
  return data.readUInt16BE(hmtx + index * 4);
}

function readFormat4(
  data: Buffer,
  offset: number,
  advanceOf: (glyphId: number) => number,
  into: Map<number, number>,
) {
  const segCount = data.readUInt16BE(offset + 6) / 2;
  const endCodeAt = offset + 14;
  const startCodeAt = endCodeAt + segCount * 2 + 2;
  const idDeltaAt = startCodeAt + segCount * 2;
  const idRangeOffsetAt = idDeltaAt + segCount * 2;
  for (let index = 0; index < segCount; index += 1) {
    const end = data.readUInt16BE(endCodeAt + index * 2);
    const start = data.readUInt16BE(startCodeAt + index * 2);
    if (start === 0xffff && end === 0xffff) continue;
    const idDelta = data.readInt16BE(idDeltaAt + index * 2);
    const idRangeOffset = data.readUInt16BE(idRangeOffsetAt + index * 2);
    for (let code = start; code <= end; code += 1) {
      let glyphId: number;
      if (idRangeOffset === 0) {
        glyphId = (code + idDelta) & 0xffff;
      } else {
        const glyphAt = idRangeOffsetAt + index * 2 + idRangeOffset + (code - start) * 2;
        glyphId = data.readUInt16BE(glyphAt);
        if (glyphId !== 0) glyphId = (glyphId + idDelta) & 0xffff;
      }
      if (glyphId !== 0) into.set(code, advanceOf(glyphId));
    }
  }
}

function readFormat12(
  data: Buffer,
  offset: number,
  advanceOf: (glyphId: number) => number,
  into: Map<number, number>,
) {
  const groups = data.readUInt32BE(offset + 12);
  let cursor = offset + 16;
  for (let index = 0; index < groups; index += 1) {
    const start = data.readUInt32BE(cursor);
    const end = data.readUInt32BE(cursor + 4);
    const glyphStart = data.readUInt32BE(cursor + 8);
    cursor += 12;
    for (let code = start; code <= end; code += 1) {
      const glyphId = glyphStart + (code - start);
      if (glyphId !== 0) into.set(code, advanceOf(glyphId));
    }
  }
}

/** Horizontal advances from a TTF or CFF OpenType font. */
export function readFontAdvances(data: Buffer): FontAdvances {
  const tables = readTables(data);
  const head = tables.get("head");
  const hhea = tables.get("hhea");
  const hmtx = tables.get("hmtx");
  const cmap = tables.get("cmap");
  if (head === undefined || hhea === undefined || hmtx === undefined || cmap === undefined) {
    throw new Error("OpenType font is missing head, hhea, hmtx, or cmap");
  }
  const unitsPerEm = data.readUInt16BE(head + 18);
  const numberOfHMetrics = data.readUInt16BE(hhea + 34);
  const advanceOf = (glyphId: number) => glyphAdvance(data, hmtx, numberOfHMetrics, glyphId);
  const advances = new Map<number, number>();
  const subtables = data.readUInt16BE(cmap + 2);
  const formats: { format: number; offset: number }[] = [];
  for (let index = 0; index < subtables; index += 1) {
    const record = cmap + 4 + index * 8;
    const format = data.readUInt16BE(cmap + data.readUInt32BE(record + 4));
    formats.push({ format, offset: cmap + data.readUInt32BE(record + 4) });
  }
  for (const subtable of formats) {
    if (subtable.format === 4) readFormat4(data, subtable.offset, advanceOf, advances);
  }
  for (const subtable of formats) {
    if (subtable.format === 12) readFormat12(data, subtable.offset, advanceOf, advances);
  }
  return { unitsPerEm, advances };
}
