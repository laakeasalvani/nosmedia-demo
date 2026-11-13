// H.264-only gate for every video Carson uploads. Nothing here changes the
// file: it reads the container's headers, decides, and the original bytes go
// up untouched (see the spec: no transcoding, ever).
//
// Why H.264 only: iPhones and Macs save HEVC by default. Safari plays it, so
// "it played when I tried it" proves nothing — Firefox and many Android and
// Windows browsers show a frozen poster instead. Laakea chose to refuse HEVC
// and have Carson re-export, rather than ship a video some visitors can't see.
//
// Pure module: no Firebase, no DOM, so Node can test it (tests/video-check.test.js).

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
export const WARN_UPLOAD_BYTES = 1024 ** 3;

// moov holds the track tables. Long films can have a big one, but past this
// something is wrong and we would rather refuse than read gigabytes.
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const HEVC = ['hvc1', 'hev1'];
const PRORES = ['apcn', 'apch', 'apcs', 'apco', 'ap4h', 'ap4x'];
const H264 = ['avc1', 'avc3'];

function fourcc(bytes, i) {
  return String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
}

function u32(bytes, i) {
  return ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
}

// The first sample entry of every stsd inside moov, in file order. stsd is
// size(4) 'stsd'(4) version+flags(4) entry_count(4), then the first entry's
// size(4) and type(4) — so the type sits 16 bytes after the 'stsd' marker.
export function sampleEntryTypes(moovBytes) {
  const types = [];
  for (let i = 4; i + 20 <= moovBytes.length; i++) {
    if (moovBytes[i] === 0x73 && fourcc(moovBytes, i) === 'stsd') {
      types.push(fourcc(moovBytes, i + 16));
      i += 19;
    }
  }
  return types;
}

export function codecVerdict(types) {
  if (types.some((t) => HEVC.includes(t))) return 'hevc';
  if (types.some((t) => PRORES.includes(t))) return 'prores';
  if (types.some((t) => H264.includes(t))) return 'h264';
  return 'other';
}

// Walks top-level box headers only — 16 bytes per box — so finding a moov
// that sits after a 1.5GB mdat (a non-"faststart" export) costs a few reads,
// not a full download of the file into memory.
export async function findTopLevelBox(readRange, fileSize, type) {
  let pos = 0;
  while (pos + 8 <= fileSize) {
    const head = await readRange(pos, Math.min(pos + 16, fileSize));
    let size = u32(head, 0);
    const boxType = fourcc(head, 4);
    if (size === 1) {
      if (head.length < 16) return null;
      size = u32(head, 8) * 2 ** 32 + u32(head, 12);
    } else if (size === 0) {
      size = fileSize - pos;
    }
    if (size < 8) return null;   // corrupt: would loop forever
    if (boxType === type) return { start: pos, size };
    pos += size;
  }
  return null;
}

export async function checkVideoFile(file) {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too-big' };
  if (file.type && !/^video\//i.test(file.type)) return { ok: false, reason: 'not-video' };

  const readRange = async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
  let found;
  try {
    found = await findTopLevelBox(readRange, file.size, 'moov');
  } catch (e) {
    return { ok: false, reason: 'codec-unknown' };
  }
  if (!found || found.size > MAX_MOOV_BYTES) return { ok: false, reason: 'codec-unknown' };

  const verdict = codecVerdict(sampleEntryTypes(await readRange(found.start, found.start + found.size)));
  if (verdict === 'hevc') return { ok: false, reason: 'codec-hevc' };
  if (verdict === 'prores') return { ok: false, reason: 'codec-prores' };
  if (verdict !== 'h264') return { ok: false, reason: 'codec-unknown' };
  return { ok: true, codec: 'h264', warnLarge: file.size > WARN_UPLOAD_BYTES };
}

const MESSAGES = {
  'too-big': "That file is over 2GB. Export a shorter or lighter version, or put the full film on YouTube or Vimeo and paste the link.",
  'codec-hevc': "This video is saved as HEVC, which some visitors can't play. Export it again as H.264 MP4 at a high bitrate, then upload that.",
  'codec-prores': "This is a ProRes file, which browsers can't play. Export it as H.264 MP4 at a high bitrate, then upload that.",
  'codec-unknown': "I couldn't read this video's format. Export it as H.264 MP4 and try again.",
  'not-video': "That isn't a video file. Pick an .mp4 or .mov.",
};

export function messageFor(reason) {
  return MESSAGES[reason] || MESSAGES['codec-unknown'];
}
