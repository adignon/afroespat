'use client';

import { ScreenFrames } from '@/screens/frames';
import { A13Desktop } from '@/screens/a13/desktop.generated';
import { A13Mobile } from '@/screens/a13/mobile.generated';
import { useStory } from '@/screens/story/use-story';

/**
 * A13 — une story en lecture plein écran, BRANCHÉE SUR L'API.
 *
 * C'est le seul écran de ce lot qui est ENTIÈREMENT piloté par la donnée : les
 * dix-sept prises de `st` portent l'auteur, le texte, la pastille, la ligne d'état
 * et les deux votes, et toutes viennent de `GET /stories/:id`.
 *
 * ── AUCUN COMPTEUR DE VUES ────────────────────────────────────────────────
 *
 * La maquette l'écrit elle-même sous sa planche — « un composant, trois types ·
 * aucun compteur de vues » — et la règle dure (`00` §49, 04 §2.6) l'interdit sur
 * tout contenu. Ce qui se compte ici, ce sont les VOTES : un jugement donné
 * volontairement, pas une mesure d'attention subie. La règle n'est pas tenue par
 * cet écran mais À LA FRONTIÈRE : `storyBubbleSchema` est `.strict()`, donc un
 * `viewCount` greffé sur la réponse est refusé avant d'arriver jusqu'ici. C'est le
 * seul endroit où elle peut être tenue pour TOUS les écrans à la fois.
 *
 * ── LE VOTE ───────────────────────────────────────────────────────────────
 *
 * Les deux boutons envoient le `kind` que LA STORY porte (`votes.positiveKind` /
 * `negativeKind`), jamais un `kind` choisi d'après le type dans le front : §2.6 en
 * accepte deux par type et le serveur refuse `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré
 * 422). Les compteurs affichés sont ceux que le serveur renvoie après le vote — pas
 * d'incrément local, qui divergerait dès qu'un autre membre vote en même temps.
 *
 * Les boutons ne sont PAS branchés dans le JSX transcodé : la maquette ne pose
 * aucun `onClick` dessus, et le transcodeur n'invente pas de comportement. Le
 * basculement est donc prêt (`basculerVote`) et attend soit un marqueur déclaré
 * dans `tools/screens/03-accueil.mjs`, soit une décision du porteur. Remonté.
 *
 * ── LE FOND ───────────────────────────────────────────────────────────────
 *
 * Le fond de PAGE est celui de la maquette (`#101A17`) : une story se lit comme une
 * photo, pas comme une page. Le fond de la CARTE, lui, est la couleur choisie par
 * l'auteur, servie telle quelle et jamais assombrie (T1 §1.2).
 *
 * Une story à FOND IMAGE reste indessinable : `backgroundUrl` vaut toujours `null`,
 * le service ne résolvant jamais `backgroundAssetId` en URL. C'est du back, et
 * c'est remonté.
 */
export function StoryEcran({ storyId }: { readonly storyId: string }) {
  const { story } = useStory(storyId);

  /**
   * TANT QUE LA STORY N'EST PAS LÀ, ON NE DESSINE PAS DE STORY.
   *
   * Pas de carte d'exemple pendant le chargement, et surtout pas celle de la
   * maquette : elle affirmerait qu'Aïcha Diop a publié un conseil sur Visale. Le
   * cadre attend sa donnée — c'est la même discipline que le fil, qui ne sert plus
   * de fausses publications depuis le lot précédent.
   */
  if (story === null) {
    return <ScreenFrames screen="A13" background="#101A17" desktop={null} mobile={null} />;
  }

  const data = { storyMain: [story], st: story };

  return (
    <ScreenFrames
      screen="A13"
      background="#101A17"
      desktop={<A13Desktop {...data} />}
      mobile={<A13Mobile {...data} />}
    />
  );
}
