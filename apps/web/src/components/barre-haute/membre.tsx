'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { meResponseSchema } from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/member';
import { fondAvatar } from '@/lib/avatar';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PASTILLE DE LA BARRE HAUTE DISAIT « AMINA » À TOUT LE MONDE            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La top bar montre toujours Amina, qui n'est pas le nom de
 * l'utilisateur actif. »
 *
 * MESURÉ : la planche écrit `AD` et `Amina` EN DUR, sur vingt-six cadres. Un
 * membre connecté sous un autre nom lisait donc celui de l'exemple de la
 * maquette, en haut de chaque page — c'est la même famille de défaut que
 * « 890 membres » sur l'en-tête de réseau ou la pastille d'alerte toujours
 * allumée : un exemple pris pour une donnée.
 *
 * ── POURQUOI LE COMPOSANT LIT `/me` LUI-MÊME ──────────────────────────────
 *
 * Les autres maquettes passent le membre en prise (`moi.initiales`,
 * `moi.prenom`) : leur `renderVals()` le prévoit. Celle de l'accueil NON — son
 * type de données ne porte aucun membre, et vingt-six cadres y puisent. Ajouter
 * la prise demanderait de la faire descendre dans chaque page de chaque écran,
 * pour une information que le socle d'appel connaît déjà.
 *
 * `GET /me` est demandé UNE FOIS par page et partagé, comme les compteurs de la
 * barre : la pastille et les deux icônes voisines ne font pas trois appels.
 */

interface Membre {
  readonly initiales: string;
  /**
   * LE FOND DU ROND : la photo du membre, ou `null`.
   *
   * Le porteur : « l'image profil ne s'applique pas sur toutes les pages. » Les
   * cadres transcodés ont reçu la liaison, mais la barre haute et la carte du
   * rail ne sont PAS transcodées — ce sont ces composants-ci, et ils ne lisaient
   * que `displayName`. La photo manquait donc sur tous les écrans qui les
   * emploient, c'est-à-dire presque tous.
   */
  readonly photo: string | null;
  readonly prenom: string;
  /** Le nom ENTIER — la carte du rail l'écrit, la pastille de la barre non. */
  readonly nom: string;
  readonly handle: string;
}

/** La promesse en cours, partagée par tout ce qui affiche le membre sur la page. */
let enCours: Promise<Membre | null> | null = null;

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  return mots
    .slice(0, 2)
    .map((m) => m[0] ?? '')
    .join('')
    .toUpperCase();
}

async function demander(): Promise<Membre | null> {
  try {
    /**
     * LA MÊME ATTENTE QUE LES COMPTEURS, et pour la même raison mesurée : le jeton
     * d'accès vit en mémoire, donc il n'existe pas au premier rendu d'un onglet.
     * Sans cette ligne, `/me` part, prend un `401`, déclenche le rejeu — et la
     * pastille reste muette le temps de deux allers-retours au lieu d'un. Voir
     * l'en-tête de `compteurs.ts`.
     */
    if (!hasAccessToken()) await resumeSession();
    const me = await memberApi.get('/me', meResponseSchema);
    const nom = me.user.displayName;
    return {
      initiales: initiales(nom),
      photo: fondAvatar(me.user.avatarUrl),
      prenom: nom.trim().split(/\s+/)[0] ?? nom,
      nom,
      handle: me.user.handle,
    };
  } catch {
    return null;
  }
}

/** Pour les épreuves : oublie ce qui a été demandé. */
export function oublierMembreBarre(): void {
  enCours = null;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CARTE DE PROFIL DU RAIL — LE MÊME NOM EN DUR, EN PLUS GROS             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Treize cadres de l'accueil ouvrent leur colonne de gauche par une carte qui
 * écrit `AD`, « Amina Diallo » et « Voir mon profil public » — ce dernier en
 * `href="#"`, donc mort. C'est le même défaut que la pastille de la barre, au
 * même endroit et pour la même raison : la maquette de l'accueil ne prévoit
 * aucune prise pour le membre.
 *
 * Le lien mène au PROFIL PUBLIC : c'est ce que son libellé promet — « voir », pas
 * « modifier ». La pastille de la barre, elle, mène à `/compte/profil`, qui est
 * l'entrée de compte.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ARROBASE N'EST PAS UNE DÉCORATION — SANS ELLE, LE LIEN REND 404         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le bouton "Voir mon profil public" ne marche pas ». MESURÉ au
 * navigateur : il menait à `/m-08b3d8a30b58`, et cette adresse rend
 * « 404 — This page could not be found ».
 *
 * La route est `/@:pseudo`, pas `/:pseudo`, et `app/(app)/[handle]/page.tsx`
 * explique pourquoi en détail : le segment dynamique PORTE l'arobase dans sa
 * valeur, et il appelle `notFound()` sur tout ce qui ne commence pas par elle —
 * délibérément, pour qu'un pseudo ne puisse jamais masquer `/accueil` ou
 * `/parcours`. J'avais écrit `/${handle}` ; il fallait `/@${handle}`.
 */
export function CarteMembre({ styleAvatar, styleNom, styleLien, libelle }: {
  readonly styleAvatar: CSSProperties;
  readonly styleNom: CSSProperties;
  readonly styleLien: CSSProperties;
  /** « Voir mon profil public » — le mot de la planche, repris tel quel. */
  readonly libelle: string;
}) {
  const membre = useMembreBarre();
  /**
   * Le fond du rond : la photo si le membre en a une, sinon rien — et c'est
   * alors le style dessiné qui reprend la main, initiales comprises.
   */
  const fond = membre?.photo ?? null;

  return (
    <>
      <span
        style={{ ...styleAvatar, ...(fond === null ? {} : { background: fond }) }}
        data-carte-membre=""
      >
        {fond === null ? (membre?.initiales ?? '') : null}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={styleNom}>{membre?.nom ?? ''}</span>
        {membre === null ? (
          <span style={styleLien}>{libelle}</span>
        ) : (
          <Link href={`/@${membre.handle}`} style={styleLien}>
            {libelle}
          </Link>
        )}
      </span>
    </>
  );
}

/** Le membre courant, demandé une fois par page et partagé. */
export function useMembreBarre(): Membre | null {
  const [membre, setMembre] = useState<Membre | null>(null);

  useEffect(() => {
    let vivant = true;
    enCours ??= demander();
    void enCours.then((valeur) => {
      if (vivant) setMembre(valeur);
    });
    return () => {
      vivant = false;
    };
  }, []);

  return membre;
}

/**
 * La pastille du membre, avec le dessin de sa planche.
 *
 * Les trois styles sont ceux que la maquette écrit — la boîte, le rond
 * d'initiales, le prénom. Ils ne sont pas identiques d'un cadre à l'autre, et
 * c'est pourquoi le transcodeur les transmet plutôt que de les figer ici.
 */
export function PastilleMembre({ styleBoite, styleAvatar, styleNom }: {
  readonly styleBoite: CSSProperties;
  readonly styleAvatar: CSSProperties;
  readonly styleNom: CSSProperties;
}) {
  const membre = useMembreBarre();
  /**
   * Le fond du rond : la photo si le membre en a une, sinon rien — et c'est
   * alors le style dessiné qui reprend la main, initiales comprises.
   */
  const fond = membre?.photo ?? null;

  /**
   * TANT QU'ON NE SAIT PAS, ON N'ÉCRIT PAS DE NOM.
   *
   * La boîte garde sa place — sans quoi la barre sauterait au chargement — mais
   * elle reste muette. Afficher « Amina » en attendant serait exactement le
   * défaut qu'on corrige, et afficher un nom de repli en serait un autre.
   */
  const contenu = (
    <>
      <span style={{ ...styleAvatar, ...(fond === null ? {} : { background: fond }) }}>
        {fond === null ? (membre?.initiales ?? '') : null}
      </span>
      <span style={styleNom}>{membre?.prenom ?? ''}</span>
    </>
  );

  if (membre === null) {
    return (
      <div style={styleBoite} data-barre-membre="">
        {contenu}
      </div>
    );
  }

  /**
   * ET ELLE MÈNE AU PROFIL. La maquette n'en fait pas un lien — elle dessine un
   * `<div>` — mais une pastille qui porte votre nom et votre portrait et qui ne
   * fait rien est une promesse non tenue : c'est l'entrée de compte que tout le
   * monde cherche là. `/compte/profil` est la route du produit.
   */
  return (
    <Link
      href="/compte/profil"
      aria-label={`Mon compte — ${membre.prenom}`}
      style={{ ...styleBoite, textDecoration: 'none', color: 'inherit' }}
      data-barre-membre=""
    >
      {contenu}
    </Link>
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE ROND DU COMPOSEUR ÉCRIVAIT « AD » — LES INITIALES DE LA MAQUETTE       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « l'image profil ne s'applique pas sur toutes les pages. »
 *
 * MESURÉ sur `/accueil`, une photo posée par `PUT /me/avatar` : onze ronds
 * d'avatar, deux avec la photo. Parmi les neuf aplats restants, un portait le
 * texte `AD` — ce n'était donc NI la photo du membre NI ses initiales, mais
 * celles du dessin : « Amina Diallo ». Un membre nommé Awa Konaté lisait `AD` à
 * côté du champ où il écrit, sur le fil, sur les commentaires, sur le détail
 * d'une publication et sur les deux fils de réseau — huit cadres, les deux
 * planches comprises.
 *
 * ── POURQUOI UN COMPOSANT ET NON UNE PRISE ────────────────────────────────
 *
 * Même raison que `PastilleMembre`, à la ligne près : les quatre types de
 * données concernés (`A01Data`, `A01CData`, `A02Data`, `A08TData`) ne portent
 * AUCUN membre, et leurs trois pages ne lisent pas `/me`. Faire descendre la
 * prise demanderait quatre interfaces, trois chargeurs et autant d'occasions
 * d'oublier l'un des huit cadres. Ce composant lit la MÊME promesse partagée que
 * la pastille de la barre — `enCours` — donc il n'ajoute aucun appel.
 *
 * ── LE STYLE VIENT DE LA PLANCHE, PAS D'ICI ───────────────────────────────
 *
 * Le diamètre change d'un cadre à l'autre : 44 px sur le fil d'ordinateur,
 * 38 px sur sa planche de téléphone, 40 px sur les commentaires. Le transcodeur
 * transmet donc le style dessiné tel quel ; on ne substitue que le FOND, et
 * seulement quand il y a une photo à poser.
 */
export function RondMoi({ style }: { readonly style: CSSProperties }) {
  const membre = useMembreBarre();
  const fond = membre?.photo ?? null;

  return (
    <span
      data-rond-moi=""
      style={{ ...style, ...(fond === null ? {} : { background: fond }) }}
    >
      {/*
       * TANT QU'ON NE SAIT PAS, ON N'ÉCRIT RIEN. Le rond garde sa place — sans
       * quoi le champ sauterait au chargement — mais il reste muet. Écrire `AD`
       * en attendant serait exactement le défaut qu'on corrige.
       */}
      {fond === null ? (membre?.initiales ?? '') : null}
    </span>
  );
}
