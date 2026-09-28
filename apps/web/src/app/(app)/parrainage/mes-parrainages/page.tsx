import { ScreenFrames } from '@/screens/frames';
import { H07Desktop } from '@/screens/h07/desktop.generated';
import { H07Mobile } from '@/screens/h07/mobile.generated';

/**
 * H07 — Mes parrainages (`/parrainage/mes-parrainages`, module 08).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 */
export default function MyMentorshipsPage() {
  return <ScreenFrames screen="H07" desktop={<H07Desktop />} mobile={<H07Mobile />} />;
}
