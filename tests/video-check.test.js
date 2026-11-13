import test from 'node:test';
import assert from 'node:assert/strict';
import { openAsBlob } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MAX_UPLOAD_BYTES, WARN_UPLOAD_BYTES, sampleEntryTypes, codecVerdict,
  findTopLevelBox, checkVideoFile, messageFor,
} from '../cms/video-check.js';
import { moov, ftyp, box, u32, concat, fakeFile } from './mp4-fixtures.js';

const GB = 1024 ** 3;

test('limits are 2GB and 1GB', () => {
  assert.equal(MAX_UPLOAD_BYTES, 2147483648);
  assert.equal(WARN_UPLOAD_BYTES, 1073741824);
});

test('sampleEntryTypes finds avc1 and mp4a across two tracks', () => {
  assert.deepEqual(sampleEntryTypes(moov('avc1', 'mp4a')), ['avc1', 'mp4a']);
});

test('codecVerdict precedence', () => {
  assert.equal(codecVerdict(['avc1', 'mp4a']), 'h264');
  assert.equal(codecVerdict(['avc3']), 'h264');
  assert.equal(codecVerdict(['hvc1']), 'hevc');
  assert.equal(codecVerdict(['hev1']), 'hevc');
  assert.equal(codecVerdict(['apch']), 'prores');
  assert.equal(codecVerdict(['avc1', 'hvc1']), 'hevc');
  assert.equal(codecVerdict(['mp4a']), 'other');
});

test('findTopLevelBox locates moov after a large mdat', async () => {
  const m = moov('avc1', 'mp4a');
  const f = fakeFile({ mdatBytes: 1.5 * GB, moovBytes: m });
  const read = (s, e) => f.slice(s, e).arrayBuffer().then((b) => new Uint8Array(b));
  const found = await findTopLevelBox(read, f.size, 'moov');
  assert.deepEqual(found, { start: ftyp.length + 8 + 1.5 * GB, size: m.length });
  const outside = f.reads.reduce((s, r) => s + r.outside, 0);
  assert.ok(outside <= 64 * 1024, `read ${outside} bytes outside moov`);
});

test('findTopLevelBox handles 64-bit largesize', async () => {
  const big = 5 * GB;
  const header = concat(u32(1), new TextEncoder().encode('mdat'), u32(Math.floor((big) / 2 ** 32)), u32((big) % 2 ** 32));
  const m = moov('avc1');
  const total = ftyp.length + big + m.length;
  const read = async (s, e) => {
    const out = new Uint8Array(e - s);
    for (let i = s; i < e; i++) {
      if (i < ftyp.length) out[i - s] = ftyp[i];
      else if (i < ftyp.length + header.length) out[i - s] = header[i - ftyp.length];
      else if (i >= ftyp.length + big) out[i - s] = m[i - ftyp.length - big];
    }
    return out;
  };
  assert.deepEqual(await findTopLevelBox(read, total, 'moov'), { start: ftyp.length + big, size: m.length });
});

test('findTopLevelBox returns null when the box is missing', async () => {
  const bytes = concat(ftyp, box('free', new Uint8Array(4)));
  const read = async (s, e) => bytes.slice(s, e);
  assert.equal(await findTopLevelBox(read, bytes.length, 'moov'), null);
});

test('checkVideoFile rejects a 2GB+1 byte blob with too-big', async () => {
  const f = { size: MAX_UPLOAD_BYTES + 1, type: 'video/mp4', slice() { throw new Error('should not read'); } };
  assert.deepEqual(await checkVideoFile(f), { ok: false, reason: 'too-big' });
});

test('checkVideoFile rejects a non-video type', async () => {
  const f = fakeFile({ mdatBytes: 10, moovBytes: moov('avc1'), type: 'image/jpeg' });
  assert.deepEqual(await checkVideoFile(f), { ok: false, reason: 'not-video' });
});

test('checkVideoFile rejects HEVC and ProRes', async () => {
  assert.deepEqual(await checkVideoFile(fakeFile({ mdatBytes: 100, moovBytes: moov('hvc1', 'mp4a') })), { ok: false, reason: 'codec-hevc' });
  assert.deepEqual(await checkVideoFile(fakeFile({ mdatBytes: 100, moovBytes: moov('apch'), type: 'video/quicktime' })), { ok: false, reason: 'codec-prores' });
});

test('checkVideoFile says codec-unknown when there is no moov', async () => {
  const bytes = concat(ftyp, box('free', new Uint8Array(4)));
  const f = { size: bytes.length, type: 'video/mp4', slice: (s, e) => ({ arrayBuffer: async () => bytes.slice(s, e).buffer }) };
  assert.deepEqual(await checkVideoFile(f), { ok: false, reason: 'codec-unknown' });
});

test('checkVideoFile accepts moov-first (faststart) files', async () => {
  const r = await checkVideoFile(fakeFile({ mdatBytes: 1000, moovBytes: moov('avc1'), moovFirst: true }));
  assert.deepEqual(r, { ok: true, codec: 'h264', warnLarge: false });
});

test('checkVideoFile flags warnLarge above 1GB', async () => {
  const r = await checkVideoFile(fakeFile({ mdatBytes: Math.round(1.2 * GB), moovBytes: moov('avc1', 'mp4a') }));
  assert.deepEqual(r, { ok: true, codec: 'h264', warnLarge: true });
});

test('checkVideoFile accepts the bundled media/surf.mp4 as h264', async () => {
  const blob = await openAsBlob(fileURLToPath(new URL('../media/surf.mp4', import.meta.url)), { type: 'video/mp4' });
  const r = await checkVideoFile(blob);
  assert.deepEqual(r, { ok: true, codec: 'h264', warnLarge: false });
});

test('messageFor gives plain words for each reason', () => {
  assert.match(messageFor('codec-hevc'), /H\.264/);
  assert.match(messageFor('too-big'), /2GB/);
  for (const r of ['too-big', 'codec-hevc', 'codec-prores', 'codec-unknown', 'not-video']) {
    assert.ok(messageFor(r).length > 20, r);
  }
});
