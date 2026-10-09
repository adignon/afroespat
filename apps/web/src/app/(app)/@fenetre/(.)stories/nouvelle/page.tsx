import { NouvelleStoryScreen } from '../../../stories/nouvelle/nouvelle-story-screen';
import { FenetrePleine } from '../../fenetre-pleine';

/**
 * A14 EN FENÊTRE — `/stories/nouvelle` ouvert DEPUIS une page du groupe.
 *
 * Le même écran, au caractère près : il est importé, pas recopié. Seule la coque
 * change. Tapée directement, la même adresse sert `app/(app)/stories/nouvelle`,
 * c'est-à-dire la page entière.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params['etape'];
  const etape = typeof raw === 'string' ? Number.parseInt(raw, 10) : 1;
  return (
    <FenetrePleine>
      <NouvelleStoryScreen etape={Number.isFinite(etape) ? etape : 1} enFenetre />
    </FenetrePleine>
  );
}
