import { NouvelleStoryScreen } from './nouvelle-story-screen';

/**
 * A14 — créer une story. `/stories/nouvelle`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 *
 * L'étape se lit dans l'URL parce que la maquette ne dessine AUCUN contrôle de
 * navigation entre l'étape 1 et l'étape 2 sur mobile — voir le long commentaire de
 * `nouvelle-story-screen.tsx`. Une étape hors des trois retombe sur la première.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params['etape'];
  const etape = typeof raw === 'string' ? Number.parseInt(raw, 10) : 1;
  return <NouvelleStoryScreen etape={Number.isFinite(etape) ? etape : 1} />;
}
