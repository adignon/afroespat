import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MediaThumbnailService, THUMB_MAX_PX, THUMB_SUFFIX } from '../media.consumer';

/** Vignettes : sharp réel, stockage et base simulés. */
function setup(asset: Record<string, unknown> | null, original: Buffer | null) {
  const puts = new Map<string, { body: Buffer; mime: string }>();
  const prisma = { mediaAsset: { findUnique: () => Promise.resolve(asset) } };
  const storage = {
    get: () => Promise.resolve(original === null ? null : { body: original, mime: 'image/png' }),
    put: (k: string, body: Buffer, mime: string) => { puts.set(k, { body, mime }); return Promise.resolve(); },
  };
  return { puts, service: new MediaThumbnailService(prisma as never, storage as never) };
}
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#2a7' } }).png().toBuffer();

describe('vignette (file media)', () => {
  const ready = { storageKey: 'post/a.png', mime: 'image/png', status: 'READY', deletedAt: null };

  it('réduit à 480 px max en WebP, sous <clé>.thumb.webp', async () => {
    const { puts, service } = setup(ready, await png(2000, 1000));
    expect(await service.thumbnail({ assetId: 'x' })).toBe(true);
    const out = puts.get(`post/a.png${THUMB_SUFFIX}`);
    expect(out?.mime).toBe('image/webp');
    const meta = await sharp(out?.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(THUMB_MAX_PX);
    expect(meta.height).toBe(240);
  });
  it('n’agrandit jamais une petite image', async () => {
    const { puts, service } = setup(ready, await png(100, 80));
    await service.thumbnail({ assetId: 'x' });
    expect((await sharp(puts.get(`post/a.png${THUMB_SUFFIX}`)?.body).metadata()).width).toBe(100);
  });
  it('ignore un média non prêt, supprimé, non image ou sans octets', async () => {
    const buf = await png(10, 10);
    for (const a of [
      { ...ready, status: 'PENDING' }, { ...ready, deletedAt: new Date() },
      { ...ready, mime: 'application/pdf' }, { ...ready, mime: 'image/svg+xml' }, null,
    ]) expect(await setup(a, buf).service.thumbnail({ assetId: 'x' })).toBe(false);
    expect(await setup(ready, null).service.thumbnail({ assetId: 'x' })).toBe(false);
  });
});
