/** PNG tEXt injector for SillyTavern `chara` and `ccv3` chunks. Pure, no DOM. */

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function readUint32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function writeUint32BE(arr: Uint8Array, offset: number, value: number) {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

export interface TextChunk {
  keyword: string;
  text: string;
}

export function extractTextChunks(pngBuffer: ArrayBuffer): TextChunk[] {
  const bytes = new Uint8Array(pngBuffer);
  const view = new DataView(pngBuffer);
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error("Not a PNG file");
  }
  const chunks: TextChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(view, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    if (type === "tEXt") {
      const data = bytes.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        chunks.push({
          keyword: new TextDecoder().decode(data.subarray(0, nullIdx)),
          text: new TextDecoder().decode(data.subarray(nullIdx + 1)),
        });
      }
    } else if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  return chunks;
}

function parseChunkText(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    /* try base64 */
  }
  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function extractCharacterJson(pngBuffer: ArrayBuffer): unknown | null {
  const chunks = extractTextChunks(pngBuffer);
  for (const keyword of ["ccv3", "chara"]) {
    const chunk = chunks.find((c) => c.keyword.toLowerCase() === keyword);
    if (!chunk) continue;
    const json = parseChunkText(chunk.text);
    if (json) return json;
  }
  return null;
}

export function injectTextChunk(pngBuffer: ArrayBuffer, keyword: string, text: string): ArrayBuffer {
  const bytes = new Uint8Array(pngBuffer);
  const view = new DataView(pngBuffer);
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error("Not a PNG file");

  const kept: { type: string; data: Uint8Array }[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(view, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "tEXt") {
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const kw = new TextDecoder().decode(data.subarray(0, nullIdx));
        if (kw.toLowerCase() === keyword.toLowerCase()) {
          offset = dataEnd + 4;
          continue;
        }
      }
    }
    if (type === "IEND") break;
    kept.push({ type, data: new Uint8Array(data) });
    offset = dataEnd + 4;
  }

  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0;
  chunkData.set(textBytes, keywordBytes.length + 1);

  const typeBytes = new TextEncoder().encode("tEXt");
  const crcBuf = new Uint8Array(4 + chunkData.length);
  crcBuf.set(typeBytes, 0);
  crcBuf.set(chunkData, 4);
  const crc = crc32(crcBuf);

  let total = 8 + 12 + chunkData.length + 12;
  for (const c of kept) total += 12 + c.data.length;
  const out = new Uint8Array(total);
  out.set(bytes.subarray(0, 8), 0);
  let pos = 8;

  const writeChunk = (type: string, data: Uint8Array) => {
    writeUint32BE(out, pos, data.length);
    pos += 4;
    const tb = new TextEncoder().encode(type);
    out.set(tb, pos);
    pos += 4;
    out.set(data, pos);
    pos += data.length;
    const buf = new Uint8Array(4 + data.length);
    buf.set(tb, 0);
    buf.set(data, 4);
    writeUint32BE(out, pos, crc32(buf));
    pos += 4;
  };

  for (const c of kept) writeChunk(c.type, c.data);
  writeUint32BE(out, pos, chunkData.length);
  pos += 4;
  out.set(typeBytes, pos);
  pos += 4;
  out.set(chunkData, pos);
  pos += chunkData.length;
  writeUint32BE(out, pos, crc);
  pos += 4;
  writeChunk("IEND", new Uint8Array(0));
  return out.buffer;
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    const slice = bytes.subarray(i, i + 0x8000);
    let bin = "";
    for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
    parts.push(bin);
  }
  return btoa(parts.join(""));
}
