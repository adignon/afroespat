/**
 * QUELLE CONVERSATION S'OUVRE — la règle, pure et éprouvée.
 *
 * Le défaut qu'elle ferme : `/messages/:id` lisait 20 conversations seulement, et si
 * l'identifiant n'y figurait pas, le chargeur ouvrait SILENCIEUSEMENT la première de
 * la liste. Le composeur écrivait alors à quelqu'un d'autre que la personne de
 * l'adresse. Désormais :
 *
 *   · l'URL ne nomme rien (`/messages`) → la première conversation qui n'est ni une
 *     demande en attente ni une conversation que j'ai bloquée (repli de la maquette) ;
 *   · l'URL nomme une conversation → CELLE-LÀ, ou « introuvable ». Jamais une autre.
 */
export interface ConversationCandidate {
  readonly id: string;
  readonly blockedByMe: boolean;
  readonly pendingForMe: boolean;
}

export type Ouverture<C> =
  | { readonly etat: 'ouverte'; readonly conversation: C | null }
  | { readonly etat: 'introuvable' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant de conversation est un UUID, et rien d'autre n'entre dans un chemin d'API. */
export function estIdentifiantConversation(valeur: string): boolean {
  return UUID.test(valeur);
}

export function choisirOuverte<C extends ConversationCandidate>(
  items: readonly C[],
  conversationId: string | null,
): Ouverture<C> {
  if (conversationId === null) {
    return {
      etat: 'ouverte',
      conversation: items.find((c) => !c.pendingForMe && !c.blockedByMe) ?? null,
    };
  }
  if (!estIdentifiantConversation(conversationId)) return { etat: 'introuvable' };
  const trouvee = items.find((c) => c.id === conversationId);
  return trouvee === undefined ? { etat: 'introuvable' } : { etat: 'ouverte', conversation: trouvee };
}

interface PageCurseur {
  readonly items: readonly unknown[];
  readonly nextCursor: string | null;
}

/**
 * Lit des pages par curseur, jusqu'à `pages` au plus, en s'arrêtant plus tôt si
 * `assez(items)` est vrai (la conversation cherchée est trouvée) ou si le curseur
 * s'épuise. `plafond` borne la recherche d'une conversation nommée par l'URL.
 * `premiere` est la page la plus récente telle que le serveur l'a rendue (avec son `meta`).
 */
export async function lirePages<P extends PageCurseur>(
  lire: (curseur: string | null) => Promise<P>,
  options: {
    readonly pages: number;
    readonly plafond?: number;
    readonly assez?: (items: readonly P['items'][number][]) => boolean;
  },
): Promise<{ readonly premiere: P; readonly items: P['items'][number][]; readonly nextCursor: string | null }> {
  const items: P['items'][number][] = [];
  let premiere: P | null = null;
  let curseur: string | null = null;
  let lues = 0;
  const plafond = options.plafond ?? options.pages;
  for (;;) {
    const page: P = await lire(curseur);
    premiere ??= page;
    items.push(...page.items);
    lues += 1;
    curseur = page.nextCursor;
    if (curseur === null) break;
    const assez = options.assez?.(items) ?? true;
    if (lues >= options.pages && assez) break;
    if (lues >= plafond) break;
  }
  return { premiere, items, nextCursor: curseur };
}
