import { newId } from '../../uuid.js';
import type { Contexte } from './types.js';

/**
 * L'INDEX DE RECHERCHE des contenus générés. SQL brut, comme `SearchService.upsertDocument` : `tsv` est un
 * `tsvector` calculé par un déclencheur, que le client Prisma ne sait pas écrire. Titre et texte suffisent.
 */
const MAX_TEXTE = 20_000;

export async function indexerRecherche(c: Contexte): Promise<void> {
  const { tx } = c;
  for (const d of c.aIndexer) {
    await tx.$executeRaw`
      INSERT INTO search_documents
        (id, created_at, updated_at, subject_type, subject_id, title, body_text, city_id, country_id, community_id, visibility)
      VALUES (
        ${newId()}::uuid, now(), now(),
        ${d.sujet}::"SearchSubjectType", ${d.id}::uuid,
        ${d.titre}, ${d.texte.slice(0, MAX_TEXTE)},
        ${d.cityId}::uuid, ${null}::uuid, ${d.communityId}::uuid,
        ${d.communityId === null ? 'PUBLIC' : 'COMMUNITY'}::"SearchVisibility"
      )
      ON CONFLICT (subject_type, subject_id) DO UPDATE SET
        title = EXCLUDED.title, body_text = EXCLUDED.body_text, updated_at = now()
    `;
  }
  c.compte['documents de recherche'] = c.aIndexer.length;
  c.log(`  recherche : ${c.aIndexer.length} documents indexés`);
}
