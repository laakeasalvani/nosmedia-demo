// Builds MP4 box bytes for tests, so no binary fixtures live in the repo.
const enc = new TextEncoder();

export function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

export function concat(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function box(type, ...children) {
  const body = concat(...children);
  return concat(u32(8 + body.length), enc.encode(type), body);
}

// A track whose stsd's first sample entry is `entryType`.
export function trak(entryType) {
  const entry = box(entryType, new Uint8Array(78));
  const stsd = box('stsd', u32(0), u32(1), entry);
  return box('trak', box('mdia', box('minf', box('stbl', stsd))));
}

export function moov(...entryTypes) {
  return box('moov', ...entryTypes.map(trak));
}

export const ftyp = box('ftyp', enc.encode('isom'), u32(512), enc.encode('isomavc1'));

// A Blob-like file: ftyp, then an mdat of `mdatBytes` (never materialised),
// then moov. Records every range read outside the moov box.
export function fakeFile({ mdatBytes, moovBytes, type = 'video/mp4', moovFirst = false }) {
  const mdatHeader = concat(u32(8 + mdatBytes > 0xffffffff ? 1 : 8 + mdatBytes), enc.encode('mdat'));
  const mdatLen = 8 + mdatBytes;
  const layout = moovFirst
    ? [[ftyp, ftyp.length], [moovBytes, moovBytes.length], [mdatHeader, mdatLen]]
    : [[ftyp, ftyp.length], [mdatHeader, mdatLen], [moovBytes, moovBytes.length]];
  const size = layout.reduce((s, [, len]) => s + len, 0);
  const moovStart = moovFirst ? ftyp.length : ftyp.length + mdatLen;
  const reads = [];
  function byteAt(i) {
    let o = 0;
    for (const [bytes, len] of layout) {
      if (i < o + len) return i - o < bytes.length ? bytes[i - o] : 0;
      o += len;
    }
    return 0;
  }
  function make(start, end) {
    return {
      size: end - start,
      async arrayBuffer() {
        const outside = Math.max(0, Math.min(end, moovStart) - start) +
          Math.max(0, end - Math.max(start, moovStart + moovBytes.length));
        reads.push({ start, end, outside });
        const out = new Uint8Array(end - start);
        for (let i = start; i < end; i++) out[i - start] = byteAt(i);
        return out.buffer;
      },
    };
  }
  return {
    size, type, reads, moovStart,
    slice(start = 0, end = size) { return make(Math.max(0, start), Math.min(size, end)); },
  };
}
