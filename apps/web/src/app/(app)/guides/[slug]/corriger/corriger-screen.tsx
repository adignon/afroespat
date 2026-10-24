'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenFrames } from '@/screens/frames';
import { A06CorrigerDesktop } from '@/screens/a06/corrigerdesktop.generated';
import { A06CorrigerMobile } from '@/screens/a06/corrigermobile.generated';
import {
  correction as correctionMaquette,
  guide as guideMaquette,
  panelGuides,
  signalements,
  rail,
  shortcuts,
  type A06Data,
} from '@/screens/a06/data';
import { useGuide } from '@/screens/guides/use-guides';

/**
 * A06 · planche 1 — proposer une correction. `/guides/:slug/corriger`
 *
 * « PANNEAU LATÉRAL SUR LA PAGE DU GUIDE (WEB) · FEUILLE DU BAS (MOBILE) », dit la
 * maquette, dans son propre libellé de section. Et le porteur, en ouvrant cette
 * page : « Ça affiche une page mais c'est un modal qui s'affiche à droite. Il faut
 * être intelligent et comprendre la page. »
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CETTE ROUTE EST DEVENUE UN RELAIS, ET C'EST ÉCRIT PLUTÔT QUE SUBI         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * LE CHEMIN NORMAL DU GESTE EST AILLEURS : on surligne un passage dans le corps du
 * guide (A04), l'infobulle que la maquette dessine apparaît — « Proposer une
 * correction sur ce passage » — et le panneau s'ouvre PAR-DESSUS la page, le
 * passage visé déjà rempli en lecture seule. Le panneau est la MÊME source que la
 * planche ci-dessous : `regions:` l'extrait du cadre d'A06 dans son propre fichier
 * (`panneaucorrection-corriger{desktop,mobile}.generated.tsx`), et A04 le monte.
 *
 * ── POURQUOI L'ADRESSE N'EST PAS SUPPRIMÉE ────────────────────────────────
 *
 *   · c'est une ADRESSE PARTAGEABLE. « Va corriger ce guide » s'envoie en lien ;
 *     un panneau qui ne vit que dans l'état d'une autre page ne s'envoie pas ;
 *   · elle est déjà dans des historiques, des brouillons de message, des signets.
 *     La casser rendrait un 404 là où hier il y avait un formulaire.
 *
 * ── POURQUOI ELLE REDIRIGE PLUTÔT QUE DE GARDER SON FORMULAIRE ────────────
 *
 * ⚠ UNE ADRESSE NE PORTE PAS UNE SÉLECTION DE TEXTE. `targetExcerpt` exige au
 * moins trois caractères, et le serveur doit RETROUVER le passage dans la version
 * courante (§2.4 : « le passage visé est COPIÉ TEL QUEL […] le proposant ne le
 * retouche pas, sinon le serveur ne pourrait plus le retrouver »). Arrivé ici, il
 * n'y a aucun passage : le bouton d'envoi resterait éteint quoi qu'on écrive dans
 * les trois autres champs.
 *
 * Un formulaire qu'on remplit pour rien est pire qu'une redirection. L'adresse
 * mène donc au GUIDE, là où le geste existe — elle tient sa promesse (« corriger
 * ce guide ») sans promettre un envoi qu'elle ne peut pas tenir.
 *
 * ⚠ REMONTÉ AU PORTEUR, et c'est la vraie question : la maquette ne dessine PAS
 * l'état « aucun passage sélectionné » de ce panneau. Le jour où elle le dessine —
 * une recherche dans le corps, une liste de sections à choisir — cette route cesse
 * d'être un relais et redevient une page, sans rien changer au panneau.
 *
 * ── CE QUI EST QUAND MÊME DESSINÉ, ET POURQUOI ────────────────────────────
 *
 * Les deux cadres transcodés sont rendus le temps de la redirection : c'est la
 * planche de la maquette, titre du guide lié, pas un écran blanc. Le panneau y
 * porte les textes de la PLANCHE (`correctionMaquette`) et ses champs ne partent
 * nulle part — l'envoi vit sur la page du guide.
 */
export function CorrigerScreen({ slug }: { readonly slug: string }) {
  const { detail, enTete } = useGuide(slug);
  const router = useRouter();

  /**
   * LA REDIRECTION ATTEND LA RÉPONSE DU GUIDE, et ne part qu'une fois.
   *
   * On redirige sur le slug QUE LE SERVEUR REND, pas sur celui de l'URL : un guide
   * renommé répond sur son ancien slug, et renvoyer l'ancien ferait tourner le
   * membre entre deux adresses. C'est la même règle que `guideCardFrom`
   * (« Rien n'est déduit du titre : c'est le slug qui les distingue »).
   *
   * `replace` et non `push` : cette adresse est un relais. La laisser dans
   * l'historique ferait revenir ici au bouton « retour », donc reboucler sur le
   * guide — et un membre ne sortirait plus de la page en arrière.
   */
  useEffect(() => {
    if (detail === null) return;
    router.replace(`/guides/${encodeURIComponent(detail.guide.slug)}`);
  }, [detail, router]);

  const data: A06Data = {
    rail,
    panelGuides,
    shortcuts,
    /**
     * Le guide que la feuille vise. Avant la réponse, le DESSIN de la maquette —
     * même choix que `guide-screen.tsx` pour l'en-tête de A04.
     */
    /**
     * ⚠ `href` EST ARRIVÉE AVEC LA PAGE DES SIGNALEMENTS, et ces deux cadres ne la
     * lisent pas : ils ne dessinent ni fil d'Ariane, ni « Voir le guide ». Elle est
     * dans `GuideCorrigeView` parce que les six cadres de la section partagent une
     * signature, et on y met l'adresse du guide visé plutôt qu'une chaîne vide.
     */
    guide:
      detail !== null && enTete !== null
        ? {
            title: enTete.title,
            href: `/guides/${encodeURIComponent(detail.guide.slug)}`,
            misAJour: enTete.updated,
            utiles: enTete.utiles,
          }
        : guideMaquette,
    /** Le dessin de la planche : voir l'en-tête, l'envoi vit sur la page du guide. */
    correction: correctionMaquette,
    /** Non lues par les deux cadres de cette planche : le dessin, tel quel. */
    /**
     * Non lue non plus : la liste des signalements vit sur sa propre page. Le
     * dessin d'attente de `a06/data.ts`, pour la même raison que les trois
     * au-dessus.
     */
    signalements,
  };

  return (
    <ScreenFrames
      screen="A06-corriger"
      desktop={<A06CorrigerDesktop {...data} />}
      mobile={<A06CorrigerMobile {...data} />}
    />
  );
}
