/**
 * LE DÉTECTEUR DE COQUILLE VIDE — un seul, pour tout le dépôt.
 *
 * Il vivait en fonction locale dans `shell.spec.ts`, et il y est né d'une erreur
 * qu'il faut garder écrite : un `wc -w` sur le HTML brut compte LA CHARGE RSC, ce
 * qui donne des comptes vingt fois trop grands. Un seuil calibré sur ces
 * comptes-là aurait fait échouer `/admin/referentiels`, qui sert cinquante-six
 * mots en parfaite santé.
 *
 * Il est ici parce que DEUX suites s'en servent désormais — `shell.spec.ts` sur
 * ses vingt-et-une routes repères, et `coquille-vide.spec.ts` sur toutes celles
 * du produit. Deux copies d'un détecteur, c'est deux calibrages qui divergent, et
 * la divergence se lirait comme un changement du produit.
 *
 * ── CE QU'IL MESURE, ET CE QU'IL NE MESURE PAS ─────────────────────────────
 *
 * Les MOTS VISIBLES de la réponse : scripts et styles ôtés, balises ôtées,
 * entités réduites, et ne comptent que les suites de deux lettres ou plus. Il ne
 * dit rien de la richesse d'une page — un nombre bas peut être parfaitement sain
 * sur un formulaire. Il dit seulement si le serveur a servi QUELQUE CHOSE.
 */
export function motsVisibles(html: string): { readonly texte: string; readonly nombre: number } {
  const sansScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const texte = sansScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '’')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { texte, nombre: texte.split(' ').filter((m) => /[A-Za-zÀ-ÿ]{2,}/.test(m)).length };
}
