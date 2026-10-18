'use client';

import {
  HELP_SAFETY_BANNER,
  helpCanHelpResponseSchema,
  helpDetailResponseSchema,
  helpListResponseSchema,
  helpMineResponseSchema,
  helpMyResponsesResponseSchema,
  journeyTemplatesResponseSchema,
  mentorCardResponseSchema,
  myMentorshipsResponseSchema,
  publicProfileResponseSchema,
  type HelpCard,
  type HelpMember,
  type MeResponse,
  type Phase,
  type PublicProfileResponse,
  HELP_TYPE_LABELS,
} from '@app/shared';
import { fetchMe, memberApi } from '@/lib/api/index';
import type { BandeauEntraide, CompteursEntraide, MembreDessine } from './data';
import type { EtatVide, FiltreTypeDemande, LigneDemande, PorteeFil } from '../h01/data';
import type { H01Data } from '../h01/data';
import type { H02Data, ReponsePublique } from '../h02/data';
import type { H03Data } from '../h03/data';
import type { H04Data, LigneSuggestion } from '../h04/data';
import type { H05Data } from '../h05/data';
import type { H06Data } from '../h06/data';
import type { H07Data } from '../h07/data';
import type { H08Data } from '../h08/data';
import type { H09Data } from '../h09/data';
import type { H10Data } from '../h10/data';
import { fondAvatar } from '@/lib/avatar';

/**
 * LES APPELS DES ÉCRANS H01 À H10 — un chargeur par écran, et rien d'autre.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * Aucun `fetch`, aucun en-tête, aucun jeton, aucun rejeu. Le socle (`lib/api/`)
 * porte tout cela. Quatre de ses règles se voient ici :
 *
 *   1. `memberApi` SEULEMENT. `staffApi` n'est pas importé et ne peut pas l'être
 *      utilement : il n'a aucun moyen d'exprimer `/me`.
 *   2. TOUT APPEL PORTE UN SCHÉMA, et les schémas viennent de `@app/shared` — ils
 *      ont été écrits LÀ, à côté des schémas de requête de leur module, parce
 *      qu'un schéma de réponse recopié dans le front est une deuxième source qui
 *      divergera.
 *   3. AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : `z.infer` partout.
 *   4. LE NIVEAU NE SERT JAMAIS À AUTORISER. Aucun `if (niveau >= 1)` n'existe
 *      ici et il n'en faut pas : on tente l'action, le serveur répond
 *      `403 LEVEL_REQUIRED`, et l'invitation du §7.3 s'affiche. C'est vrai en
 *      particulier de « Proposer son aide » (§2.1, L1) et de « Devenir parrain »
 *      (§2.1, L2) — deux encarts que la maquette dessine en clair et que ce
 *      fichier ne pilote pas.
 *
 * ── AUCUN REJEU, ET LA RAISON EST CHIFFRÉE ──────────────────────────────────
 *
 * Le socle rejoue ce qui doit l'être (un `401` après rafraîchissement) et ne
 * rejoue JAMAIS un `429`. Un chargeur qui réessaierait transformerait une attente
 * d'une heure en boucle — `POST /auth/otp/request` est à 10 par heure et par IP, et
 * chaque appel coûte un SMS.
 *
 * ── AUCUN `404` N'EST AVALÉ ICI, ET C'EST UNE DÉCISION ──────────────────────
 *
 * `08 Compte` a un `absent()` qui transforme le `404` en `null`, et il a raison
 * chez lui : une archive jamais demandée, un membre sans sanction, un profil privé
 * sont des écrans parfaitement normaux. Ce module n'en a PAS, et ce n'est pas un
 * oubli — c'est la règle dure du périmètre.
 *
 * `GET /help/:id` et `GET /mentors/:handle` répondent `404` dans deux cas qui se
 * ressemblent : la ressource n'existe pas, OU un BLOCAGE sépare les deux membres
 * (§4 : « 404 et jamais 403 », parce que « révéler qu'un contenu existe mais est
 * inaccessible en dit déjà trop »). Dans les DEUX cas, la bonne réponse à l'écran
 * est la même : « cette page n'existe pas pour vous ». Un `null` silencieux
 * afficherait à la place une demande sans titre et sans réponses, c'est-à-dire
 * ferait croire à une demande vide là où il y a une séparation.
 *
 * Le `404` remonte donc, et `EcranDonnees` affiche le message de
 * `displayMessageFor`. Les compteurs DÉCORATIFS du rail, eux, se pardonnent — voir
 * `decoratif()`.
 */

// ─── Libellés ────────────────────────────────────────────────────────────────

/**
 * LES TROIS PHASES (01 §2.2), dans les mots des maquettes.
 *
 * ÉCART SIGNALÉ AU PORTEUR : `05 Entraide` GENRE ses phases — « Installée » pour
 * Fatou, « Arrivé » pour Kofi, « Arrivée » pour Yasmine — et aucun champ de l'API
 * ne porte le genre. Les formes inclusives de `01 Accès et Onboarding` sont donc
 * employées partout. Décider autrement reviendrait à deviner le genre d'un membre
 * à partir de son prénom.
 */
/**
 * Les libellés viennent de `@app/shared` : UNE seule table pour les huit
 * types, depuis que les deux énumérations n'en font plus qu'une. Deux tables
 * disant le même vocabulaire finiraient par se contredire.
 */
const CATEGORIES_FR = HELP_TYPE_LABELS;


const PHASES_FR: Record<Phase, string> = {
  PRE_DEPARTURE: 'En préparation',
  RECENT_ARRIVAL: 'Arrivé·e',
  SETTLED: 'Installé·e',
};

/**
 * Les trois fonds d'avatar de la maquette, dans son ordre.
 *
 * `05 Entraide` dessine `#0F5C48`, `#2FA37D` et `#E0733A` sur ses cartes et ses
 * réponses. Ils sont CYCLÉS par rang, comme `08 Compte` le fait pour K05 : la
 * maquette ne dit pas quelle couleur va à quel membre, elle dit qu'il y en a
 * trois.
 */
const FONDS_AVATAR = ['#0F5C48', '#2FA37D', '#E0733A'] as const;

/** Les deux pastilles de disponibilité de H06, avec LES COULEURS DE LA MAQUETTE. */
const DISPO_LIBRE = { libelle: 'Disponible', fond: '#E3F0EB', texte: '#0F5C48' } as const;
const DISPO_COMPLET = { libelle: 'Complet', fond: '#F2F5F4', texte: '#5D6B66' } as const;

// ─── Mise en forme ───────────────────────────────────────────────────────────

/**
 * Les initiales d'un nom affiché : « Amina Diallo » → « AD ».
 *
 * Deux lettres au plus, et JAMAIS une chaîne vide : un rond de couleur sans lettre
 * se lit comme un défaut de chargement.
 */
function initialesDe(nom: string): string {
  const mots = nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== '');
  if (mots.length === 0) return '?';
  return mots
    .slice(0, 2)
    .map((m) => [...m][0] ?? '')
    .join('')
    .toUpperCase();
}

const prenomDe = (nom: string): string => nom.trim().split(/\s+/)[0] ?? nom;

/**
 * « · il y a 1 h », avec le point médian que la maquette écrit devant.
 *
 * Les paliers sont ceux des textes de la maquette — « 35 min », « 2 h », « hier »,
 * « 12 sept. » — et `maintenant` est un paramètre pour que ce soit éprouvable sans
 * attendre une heure.
 */
export function ageCourt(iso: string, maintenant: number = Date.now()): string {
  const ecart = Math.max(0, maintenant - new Date(iso).getTime());
  const minutes = Math.floor(ecart / 60_000);
  if (minutes < 2) return 'maintenant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} j`;
  const semaines = Math.floor(jours / 7);
  if (semaines < 5) return `il y a ${semaines} semaine${semaines > 1 ? 's' : ''}`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

/**
 * Une note moyenne dans la virgule française : `4.8` → « 4,8 ».
 *
 * `null` rend un tiret cadratin et NON « 0 » : un parrain sans évaluation n'a pas
 * zéro, il n'a pas de note, et afficher « 0 » le ferait passer pour mauvais.
 */
const noteFr = (note: number | null): string =>
  note === null ? '—' : note.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/**
 * Un compteur DÉCORATIF : s'il échoue, il vaut zéro.
 *
 * Les trois pastilles du rail sont des ornements. Faire échouer la page entière
 * parce qu'un compteur n'a pas répondu serait une panne créée par une décoration —
 * et c'est la décision que `08 Compte` a déjà prise pour sa pastille « Contacts ».
 *
 * Un `ApiShapeError` est traité comme les autres ICI, et c'est délibéré : la
 * pastille ne vaut pas la page. Les chargeurs qui lisent la MÊME route pour autre
 * chose que la pastille, eux, la laissent remonter.
 */
async function decoratif(appel: Promise<number>): Promise<number> {
  try {
    return await appel;
  } catch {
    return 0;
  }
}

// ─── Le bandeau, commun aux dix écrans ──────────────────────────────────────

/**
 * LE BANDEAU DE SECTION — quatre appels, dont trois se pardonnent.
 *
 * `fetchMe()` sans `force` : la copie en mémoire suffit pour AFFICHER un nom. La
 * règle du socle dit `force: true` « dès qu'une décision irréversible en dépend »,
 * et afficher un prénom n'en est pas une.
 *
 * LA RÉPUTATION PASSE PAR LE PROFIL PUBLIC, et c'est un écart de l'API : `GET /me`
 * ne porte AUCUN compteur de réputation. `GET /users/{mon pseudo}` les porte tous,
 * dans `stats`. Le profil public de son propre pseudo est donc le seul chemin vers
 * les quatre nombres du rail. Signalé.
 *
 * `stats` est NULLABLE sur cette route — un membre sans statistiques calculées le
 * reçoit à `null` — et c'est traité comme des zéros, pas comme une panne.
 */
async function chargerBandeau(): Promise<BandeauEntraide & { readonly profil: PublicProfileResponse }> {
  const me = await fetchMe();
  const [profil, { compteurs, avertissement }] = await Promise.all([
    memberApi.get(`/users/${encodeURIComponent(me.user.handle)}`, publicProfileResponseSchema),
    chargerCompteurs(me),
  ]);

  const stats = profil.stats;
  return {
    moi: {
      initiales: initialesDe(me.user.displayName),
      prenom: prenomDe(me.user.displayName),
      photo: fondAvatar(me.user.avatarUrl),
    },
    reputation: {
      entraides: stats?.helpValidatedCount ?? 0,
      guides: stats?.guideHelpfulVotes ?? 0,
      parrainages: stats?.mentorshipsCompleted ?? 0,
      evenements: stats?.eventsOrganized ?? 0,
    },
    compteurs,
    avertissement,
    profil,
  };
}

/**
 * Les quatre nombres des pastilles du rail et du sous-titre de H01.
 *
 * `meta.open` et `meta.resolvedThisMonth` sont comptés PAR LE SERVEUR sur la ville
 * entière. Les compter sur la page rendue afficherait « 20 » là où la ville en a
 * deux cents — c'est la même règle que `meta.count` de K05, et elle vaut ici pour
 * la même raison.
 */
async function chargerCompteurs(
  me: MeResponse,
): Promise<{ readonly compteurs: CompteursEntraide; readonly avertissement: string }> {
  const ville = me.user.cityId;
  const fil = ville === null ? '/help?limit=1' : `/help?limit=1&cityId=${encodeURIComponent(ville)}`;

  /**
   * UN SEUL APPEL AU FIL POUR SES DEUX COMPTEURS. La version precedente appelait
   * `/help?limit=1` DEUX FOIS — une pour `open`, une pour `resolvedThisMonth` —
   * alors que le `meta` porte les deux dans la meme reponse. Deux appels pour une
   * seule reponse, c'est deux fois le debit depense pour rien, sur une route que
   * les dix ecrans de ce module appellent au chargement.
   */
  const [metaFil, pouvezAider, parrainages] = await Promise.all([
    memberApi
      .get(fil, helpListResponseSchema)
      .then((r) => ({
        ouvertes: r.meta.open ?? 0,
        resoluesCeMois: r.meta.resolvedThisMonth ?? 0,
        /**
         * LA RÈGLE DURE §2.7 TELLE QUE LE SERVEUR L'ÉCRIT, et non telle qu'un
         * composant la recopierait. `helpMetaSchema` l'exige en `min(1)` : une
         * réponse sans bandeau est REFUSÉE à la frontière, donc ce champ n'est
         * jamais vide quand l'appel aboutit.
         */
        avertissement: r.meta.safetyBanner,
      }))
      /**
       * LE REPLI N'EST PAS UNE SECONDE DÉFINITION, et c'est la distinction qui
       * compte : `HELP_SAFETY_BANNER` est LA constante de `@app/shared` dont le
       * serveur remplit son propre `meta`. Un fil injoignable ne doit pas faire
       * disparaître un avertissement de sécurité de l'écran — mais il ne doit pas
       * non plus en faire apparaître une variante écrite ici.
       */
      .catch(() => ({
        ouvertes: 0,
        resoluesCeMois: 0,
        avertissement: HELP_SAFETY_BANNER,
      })),
    decoratif(
      memberApi.get('/help/can-help?limit=20', helpCanHelpResponseSchema).then((r) => r.items.length),
    ),
    decoratif(
      memberApi
        .get('/me/mentorships', myMentorshipsResponseSchema)
        .then((r) => r.items.filter((m) => m.status === 'ACTIVE' || m.status === 'REQUESTED').length),
    ),
  ]);

  const { avertissement, ...villeEtMois } = metaFil;
  return { compteurs: { ...villeEtMois, pouvezAider, parrainages }, avertissement };
}

/** Le bandeau seul, pour les six écrans qui ne lisent que lui. */
const bandeauSeul = async (): Promise<BandeauEntraide> => {
  const { moi, reputation, compteurs, avertissement } = await chargerBandeau();
  return { moi, reputation, compteurs, avertissement };
};

// ─── Un membre, tel que la maquette le dessine ──────────────────────────────

/**
 * Un auteur ou un répondant, prêt à poser.
 *
 * `rang` cycle les trois fonds de la maquette. `cityName` est NULLABLE côté API —
 * un membre sans ville existe — et rend alors un tiret cadratin plutôt qu'une
 * chaîne vide, pour la raison déjà écrite plus haut.
 */
function membreDessine(membre: HelpMember, rang: number): MembreDessine {
  return {
    initiales: initialesDe(membre.displayName),
    nom: membre.displayName,
    fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
    phase: PHASES_FR[membre.phase],
    ville: membre.cityName ?? '—',
  };
}

// ─── H01 · /entraide ────────────────────────────────────────────────────────

/**
 * Le fil, et le nom de SA VILLE.
 *
 * ÉCART SIGNALÉ, le même que K01 a déjà remonté : `GET /me` rend `cityId`, un
 * UUID, là où le sous-titre écrit « Lyon ». Les référentiels qui le résoudraient
 * sont des routes d'ÉQUIPE. On lit donc le nom sur le profil public de son propre
 * pseudo — que le bandeau charge de toute façon pour la réputation, donc sans
 * aller-retour de plus.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SIX FILTRES DE TYPE, DANS LES MOTS DE LA MAQUETTE                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Elle écrit « Tout · Démarches · Service · Trajet · Matériel · Autre » ; le
 * serveur connaît `PAPERWORK · SERVICE · RIDE · MATERIAL · OTHER`. La table fait
 * la correspondance, et l'ordre est celui de la planche.
 */
const TYPES_FIL: readonly { readonly cle: string; readonly libelle: string }[] = [
  { cle: '*', libelle: 'Tout' },
  { cle: 'PAPERWORK', libelle: 'Démarches' },
  { cle: 'SERVICE', libelle: 'Service' },
  { cle: 'RIDE', libelle: 'Trajet' },
  { cle: 'MATERIAL', libelle: 'Matériel' },
  { cle: 'OTHER', libelle: 'Autre' },
];

/**
 * LES DEUX ÉTATS D'UNE PASTILLE, DANS LES COULEURS DE LA MAQUETTE, UNE SEULE FOIS.
 *
 * Les filtres de type et les pastilles de portée les écrivaient séparément — les
 * mêmes six valeurs, recopiées deux fois. Une pastille dessinée par la maquette en
 * `#16785E`/`#fff` et une autre en `#16785e` seraient deux verts pour l'œil du
 * garde-fou de contraste, et personne ne saurait lequel est le bon.
 */
const teinte = (actif: boolean) =>
  actif
    ? { fond: '#16785E', texte: '#fff', bord: '#16785E' }
    : { fond: '#fff', texte: '#16211D', bord: '#E6EBE9' };

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA RANGÉE DE TYPES S'ÉTEINT QUAND ELLE NE PEUT RIEN FILTRER                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ AU SCHÉMA, et c'est le fait qui décide de tout : `helpCanHelpQuerySchema`
 * n'accepte que `limit` et `radiusKm`. `GET /help/can-help` N'A PAS de paramètre
 * `type` — sa liste est CALCULÉE depuis les types d'aide déclarés au profil et les
 * définitions d'étapes franchies, triée échéance proche d'abord. On ne l'interroge
 * pas par type.
 *
 * Dès que la portée « Vous pouvez aider » est choisie, cette rangée ne peut donc
 * plus rien filtrer. Trois sorties étaient possibles ; voici celle qui a été prise
 * et pourquoi les deux autres ont été écartées.
 *
 *   · ÉTEINTE — retenue. `desactive: true` sur les six pastilles, `disabled` sur
 *     le `<button>` produit, et AUCUNE pastille allumée : « Tout » perd son vert.
 *     Le dessin ne bouge pas d'un pixel de hauteur, la rangée reste à sa place —
 *     donc le pouce du membre ne retombe pas sur une autre pastille — et le
 *     contrôle sort du parcours au clavier, ce qui est la vérité : il n'y a rien
 *     à y faire. Les couleurs employées sont les DEUX que la maquette dessine ;
 *     aucune n'est assombrie, aucune n'est inventée.
 *   · APPLIQUÉE SUR LA PAGE REÇUE — écartée, et c'est MESURABLE. `can-help` rend
 *     au plus `limit` éléments (20 ici) et son `nextCursor` est TOUJOURS nul : il
 *     n'y a pas de page deux, par conception du service. Un membre avec vingt-cinq
 *     suggestions qui filtrerait sur « Trajet » verrait donc zéro résultat alors
 *     que des demandes « Trajet » lui correspondent — simplement parce qu'elles
 *     sont au-delà du vingtième rang par échéance, et qu'aucun geste ne peut les
 *     atteindre. Un filtre qui dit « rien » là où il y a quelque chose est pire
 *     qu'un filtre éteint.
 *   · MASQUÉE — écartée pour une raison de dessin : la rangée disparaîtrait, le
 *     fil remonterait de sa hauteur, et les cartes bougeraient sous le doigt à
 *     chaque changement de portée. C'est la même règle que la bande d'attente de
 *     `EcranDonnees` applique déjà en se posant en `position: fixed`.
 */
function filtresType(
  choisi: string,
  onChoisir: (cle: string) => void,
  desactive = false,
): readonly FiltreTypeDemande[] {
  return TYPES_FIL.map((t) => {
    /** Éteinte, AUCUNE n'est allumée : un filtre allumé qui ne filtre rien mentirait. */
    const actif = !desactive && t.cle === choisi;
    return {
      cle: t.cle,
      libelle: t.libelle,
      ...teinte(actif),
      actif,
      desactive,
      onChoisir: () => {
        onChoisir(t.cle);
      },
    };
  });
}

/** Les deux portées que le fil sait charger SANS QUITTER LA PAGE. */
export type PorteeChoisie = 'toutes' | 'aider';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CINQ PASTILLES DE PORTÉE, ET LEURS ADRESSES RECOPIÉES DU PANNEAU       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Intègre donc. »
 *
 * `adresse` N'EST PAS CHOISIE, ELLE EST RECOPIÉE : ce sont les cinq premières
 * entrées de `ENTREES_PANNEAU_ENTRAIDE` dans `tools/screens/05-entraide.mjs`,
 * c'est-à-dire les routes que le panneau de gauche du cadre de 1440 px porte DÉJÀ
 * en liens qui marchent. Le cadre de 390 px dessine les mêmes entrées sous forme de
 * pastilles ; leur donner d'autres destinations créerait deux navigations pour une
 * seule maquette.
 *
 * `bascule` dit laquelle des deux natures. « Toutes » et « Vous pouvez aider » sont
 * DEUX ROUTES D'API — `GET /help` et `GET /help/can-help` — et changer de portée
 * recharge la liste SUR PLACE : le membre qui cherche à aider n'a aucune raison de
 * perdre sa position de défilement et son filtre pour voir une autre sélection du
 * même fil. Les trois autres sont des ÉCRANS, avec leur propre bandeau, leur propre
 * sous-titre et leurs propres compteurs : elles naviguent.
 *
 * LE COMPTEUR EST DANS LE LIBELLÉ, et c'est la maquette qui l'écrit ainsi :
 * « Toutes · 41 », « Vous pouvez aider · 4 ». Les deux nombres sont ceux que le rail
 * d'ordinateur porte dans ses pastilles — `meta.open` de `GET /help` et la longueur
 * de `GET /help/can-help` — donc UNE donnée à deux largeurs, pas deux comptes.
 */
const PORTEES_FIL: readonly {
  readonly cle: string;
  readonly libelle: (c: CompteursEntraide) => string;
  readonly adresse: string;
  readonly bascule: boolean;
}[] = [
  {
    cle: 'toutes',
    libelle: (c) => `Toutes · ${String(c.ouvertes)}`,
    adresse: '/entraide',
    bascule: true,
  },
  {
    cle: 'aider',
    libelle: (c) => `Vous pouvez aider · ${String(c.pouvezAider)}`,
    adresse: '/entraide/aider',
    bascule: true,
  },
  {
    cle: 'mes-demandes',
    libelle: () => 'Mes demandes',
    adresse: '/entraide/mes-demandes',
    bascule: false,
  },
  {
    cle: 'mes-reponses',
    libelle: () => 'Mes réponses',
    adresse: '/entraide/mes-reponses',
    bascule: false,
  },
  { cle: 'parrainage', libelle: () => 'Parrainage', adresse: '/parrainage', bascule: false },
];

/** Les cinq pastilles du fil : deux bascules, trois liens. */
/**
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE, et c'est la seule raison.
 *
 * Le nombre des deux premières pastilles — « Toutes · 9 », « Vous pouvez aider ·
 * 5 » — était interpolé dans le JSX du cadre, donc `queues-donnees.test.ts` le
 * voyait. Depuis que la rangée est une boucle, il entre dans le LIBELLÉ et le
 * cadre ne nomme plus `compteurs` : ce test-là ne peut plus l'atteindre. La
 * fonction devient donc le point de mesure, faute de quoi rien ne vérifierait
 * qu'un compteur réel arrive à l'écran.
 */
export function porteesDuFil(
  choisie: PorteeChoisie,
  compteurs: CompteursEntraide,
  onPortee: (cle: PorteeChoisie) => void,
): readonly PorteeFil[] {
  return PORTEES_FIL.map((p): PorteeFil => {
    const actif = p.cle === choisie;
    const commun = { cle: p.cle, libelle: p.libelle(compteurs), ...teinte(actif), actif };
    return p.bascule
      ? {
          ...commun,
          href: null,
          onChoisir: () => {
            onPortee(p.cle as PorteeChoisie);
          },
        }
      : { ...commun, href: p.adresse, onChoisir: null };
  });
}

/**
 * LES TROIS PASTILLES DE H04 — TOUTES DES LIENS, et c'est une décision.
 *
 * H04 EST la portée « Vous pouvez aider », servie à son adresse propre. Une bascule
 * y serait un contrôle qui ne change rien : celui qui est déjà choisi, et les deux
 * autres mènent ailleurs. La pastille courante reste un lien vers sa propre page —
 * c'est ce que fait une barre d'onglets, et c'est ce que le panneau d'ordinateur
 * fait déjà pour l'entrée de la page affichée.
 */
function porteesDeH04(compteurs: CompteursEntraide): readonly PorteeFil[] {
  return PORTEES_FIL.slice(0, 3).map((p): PorteeFil => {
    const actif = p.cle === 'aider';
    return {
      cle: p.cle,
      libelle: p.libelle(compteurs),
      ...teinte(actif),
      actif,
      href: p.adresse,
      onChoisir: null,
    };
  });
}

/** Les deux teintes de pastille de catégorie que la maquette dessine. */
const CATEGORIE_OUVERTE = { fond: '#E3F0EB', encre: '#0F5C48' };
const CATEGORIE_CLOSE = { fond: '#EDF1EF', encre: '#8A958F' };

/**
 * UNE DEMANDE, DANS L'UNE DES TROIS VARIANTES DESSINÉES.
 *
 * LA LIGNE D'ÉTAPE (§2.5) : « Étape 7 · Logement · parcours Études ». Elle était
 * remplacée par « Demande issue d'un parcours » faute de donnée : `helpCardSchema`
 * ne portait que `fromJourney`. La carte porte maintenant `journeyStep` (rang, nom
 * de l'étape, TYPE de parcours — jamais le titre personnel), et la ligne est
 * composée par `ligneParcours`.
 */
/** « Étape 7 · Logement · parcours Études », ou le repli sûr quand la carte n'a pas d'étape. */
export function ligneParcours(d: Pick<HelpCard, 'journeyStep'>): string {
  const e = d.journeyStep;
  if (e === null) return 'Demande issue d’un parcours';
  return `Étape ${String(e.stepNumber)} · ${e.stepName} · parcours ${e.journeyTypeName}`;
}

function ligneDemande(d: HelpCard, rang: number): LigneDemande {
  const close = d.status !== 'OPEN';
  const parcours = d.fromJourney;
  const categorie = close ? CATEGORIE_CLOSE : CATEGORIE_OUVERTE;
  const nom = d.author.displayName;
  return {
    fond: close ? '#F6F8F7' : parcours ? '#FFFBF8' : '#fff',
    trait: parcours && !close ? '1.5px solid #E0733A' : '1px solid #E6EBE9',
    deParcours: parcours && !close,
    categorie: CATEGORIES_FR[d.type] ?? d.type,
    categorieFond: categorie.fond,
    categorieEncre: categorie.encre,
    etat: close ? 'Résolue' : '',
    delai: ageCourt(d.createdAt),
    etape: parcours && !close ? ligneParcours(d) : '',
    titre: d.title,
    titreCouleur: close ? '#5D6B66' : '#16211D',
    extrait: d.excerpt,
    href: `/entraide/${d.id}`,
    ouverte: !close,
    auteur: nom,
    auteurInitiales: initialesDe(nom),
    auteurFond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
    auteurPhase: PHASES_FR[d.author.phase],
    reponses: `${String(d.responseCount)} réponse${d.responseCount > 1 ? 's' : ''}`,
    boutonFond: parcours ? '#E0733A' : '#16785E',
    resolution: close ? `${nom} a marqué cette demande comme résolue` : '',
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FIL D'ENTRAIDE LIT ENFIN SES DEMANDES                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Corrige l'entraide » puis « rends aussi la page, les filtres
 * etc. dynamique ».
 *
 * Ce chargeur ne lisait que le bandeau : les trois cartes de la planche étaient
 * servies à tout le monde. `GET /help` répondait pourtant depuis le début, et
 * `helpListQuerySchema` accepte `type` — le filtre part donc dans la requête, et
 * non sur la page déjà chargée : une liste paginée filtrée localement donnerait
 * un onglet vide alors que la demande existe, simplement parce qu'elle est page
 * deux.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT VIDE — ET SURTOUT CELUI QUI NE VEUT PAS DIRE « IL N'Y A RIEN »      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Quatre cas, et ils ne disent PAS la même chose au membre :
 *
 *   1. PORTÉE « VOUS POUVEZ AIDER », SANS AUCUN CRITÈRE. `GET /help/can-help`
 *      répond une liste vide avec `meta.reason = 'NO_CRITERIA'` au membre qui n'a
 *      déclaré aucun type d'aide à son profil et franchi aucune étape. Le
 *      commentaire du service dit pourquoi il ne replie pas sur « toutes les
 *      demandes » : « Renvoyer "toutes les demandes" serait la pire réponse —
 *      l'encadré perdrait son sens et son taux de réponse. » Il a raison, et la
 *      conséquence est un fil vide pour une raison qui n'est pas « il n'y a rien à
 *      faire » mais « nous ne savons pas encore ce que vous savez faire ».
 *      LAISSER CE FIL MUET LUI APPREND L'INVERSE DE CE QU'IL FAUT FAIRE : il
 *      conclurait que la ville est calme, et n'irait jamais remplir son profil. La
 *      pastille verte est donc le chemin vers `/compte/profil` — le seul geste qui
 *      fasse cesser ce vide.
 *   2. LA MÊME PORTÉE, AVEC DES CRITÈRES MAIS SANS CORRESPONDANCE. Là, il n'y a
 *      vraiment rien pour lui aujourd'hui, et le dire ainsi est juste. La pastille
 *      mène quand même au profil : élargir ses types d'aide est la seule action qui
 *      change ce résultat, et §2.6 ne propose rien d'autre.
 *   3. LE FIL FILTRÉ SUR UN TYPE, SANS RÉSULTAT. La catégorie est NOMMÉE : un
 *      « Aucune demande ouverte à Lyon » affiché alors que la ville en a quarante,
 *      dont aucune en « Trajet », ferait croire à un fil vide au lieu d'un filtre
 *      étroit.
 *   4. LE FIL ENTIER, VIDE. C'est le seul des quatre que la maquette ÉCRIT, mot
 *      pour mot : « Aucune demande ouverte à Lyon · Vous avez besoin d'un coup de
 *      main ? · Publier une demande ». Il est repris tel quel.
 *
 * LE DESSIN DES QUATRE EST CELUI DE LA MAQUETTE, pris dans la colonne « ÉTATS »
 * que H01 range à côté de ses deux cadres — titre de 14 px, phrase en `#5D6B66`,
 * pastille `#16785E`. Voir `ETAT_VIDE` dans `tools/screens/05-entraide.mjs` : trois
 * champs, et pas un de plus, parce que la planche n'en dessine pas plus.
 *
 * `null` DÈS QU'UNE CARTE S'AFFICHE : un état vide posé sous une liste pleine
 * serait un deuxième mensonge, à l'envers.
 */
function videDuFil(
  combien: number,
  portee: PorteeChoisie,
  sansCritere: boolean,
  type: string,
  ville: string,
): EtatVide | null {
  if (combien > 0) return null;

  if (portee === 'aider') {
    return sansCritere
      ? {
          titre: 'Nous ne savons pas encore ce que vous savez faire',
          phrase:
            'Déclarez vos types d’aide sur votre profil : les demandes qui vous correspondent apparaîtront ici.',
          lien: 'Compléter mon profil',
          href: '/compte/profil',
        }
      : {
          titre: 'Aucune demande ne correspond à votre expérience',
          phrase:
            'Cette liste suit vos types d’aide et les étapes que vous avez franchies. En déclarer d’autres l’élargit.',
          lien: 'Compléter mon profil',
          href: '/compte/profil',
        };
  }

  const categorie = TYPES_FIL.find((t) => t.cle === type);
  return {
    titre:
      type === '*' || categorie === undefined
        ? `Aucune demande ouverte à ${ville}`
        : `Aucune demande « ${categorie.libelle} » ouverte à ${ville}`,
    phrase: 'Vous avez besoin d’un coup de main ?',
    lien: 'Publier une demande',
    href: '/entraide/nouveau',
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX PORTÉES SONT DEUX ROUTES, PAS DEUX TRIS                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `GET /help` rend le fil de la ville, filtrable par `type`. `GET /help/can-help`
 * rend une liste CALCULÉE : les types d'aide déclarés au profil, plus les
 * définitions d'étapes que le membre a franchies, dans son rayon de ville,
 * demandes seulement, jamais les siennes, triées échéance proche d'abord (§2.6).
 * Aucune des deux n'est un tri de l'autre, et c'est pourquoi la portée change
 * d'APPEL et pas d'ordre de tableau.
 *
 * ── LE `catch` A ÉTÉ RETIRÉ, ET C'EST UNE CORRECTION ────────────────────────
 *
 * La version précédente avalait l'échec en liste vide, avec cette raison : « le fil
 * doit s'afficher même si cette route faiblit, avec son bandeau et sa règle de
 * sécurité ». Elle était juste AVANT que cet écran ait un état vide dessiné. Elle
 * ne l'est plus : une panne réseau afficherait maintenant « Aucune demande ouverte
 * à Lyon », c'est-à-dire une affirmation FAUSSE sur la ville, là où la vérité est
 * « nous n'avons pas pu charger ».
 *
 * Et le motif de l'époque n'a plus besoin de ce `catch` : `EcranDonnees` reçoit un
 * `squelette`, donc l'échec rend le CADRE ENTIER — rail, panneau, barre basse,
 * bandeau de sécurité — plus une bande « Réessayer » en `position: fixed`. Le fil
 * s'affiche, la règle §2.7 reste à l'écran, et l'erreur se dit comme une erreur.
 */
async function listeDuFil(
  portee: PorteeChoisie,
  type: string,
): Promise<{ readonly items: readonly HelpCard[]; readonly sansCritere: boolean }> {
  if (portee === 'aider') {
    const suggestions = await memberApi.get('/help/can-help?limit=20', helpCanHelpResponseSchema);
    return { items: suggestions.items, sansCritere: suggestions.meta.reason === 'NO_CRITERIA' };
  }
  const requete = type === '*' ? '?limit=20' : `?type=${encodeURIComponent(type)}&limit=20`;
  const fil = await memberApi.get(`/help${requete}`, helpListResponseSchema);
  return { items: fil.items, sansCritere: false };
}

/**
 * ── CE QUE LE CHARGEUR REÇOIT, ET POURQUOI C'EST UN OBJET ───────────────────
 *
 * Quatre arguments positionnels — portée, type, et leurs deux prises — se lisent
 * `chargerH01('aider', '*', setPortee, setType)` sur l'appel, et plus personne ne
 * sait lequel est lequel six mois plus tard. L'objet nomme chaque pièce à l'endroit
 * où elle est écrite.
 */
export async function chargerH01({
  portee = 'toutes',
  type = '*',
  onPortee = () => undefined,
  onType = () => undefined,
}: {
  readonly portee?: PorteeChoisie;
  readonly type?: string;
  readonly onPortee?: (cle: PorteeChoisie) => void;
  readonly onType?: (cle: string) => void;
} = {}): Promise<H01Data> {
  const [{ moi, reputation, compteurs, avertissement, profil }, liste] = await Promise.all([
    chargerBandeau(),
    listeDuFil(portee, type),
  ]);

  const ville = profil.city?.name ?? '—';
  return {
    moi,
    reputation,
    compteurs,
    avertissement,
    ville,
    demandes: liste.items.map((d, rang) => ligneDemande(d, rang)),
    /**
     * LA RANGÉE DE TYPES S'ÉTEINT SOUS LA PORTÉE « VOUS POUVEZ AIDER », et le
     * raisonnement entier est dans l'en-tête de `filtresType` : `can-help` n'a pas
     * de paramètre `type`, donc une pastille allumée y mentirait.
     */
    typesDemande: filtresType(type, onType, portee === 'aider'),
    portees: porteesDuFil(portee, compteurs, onPortee),
    vide: videDuFil(liste.items.length, portee, liste.sansCritere, type, ville),
  };
}

// ─── H02 · /entraide/:id ────────────────────────────────────────────────────

/**
 * Une demande en détail.
 *
 * `nbReponses` EST LA LONGUEUR DE LA LISTE RENDUE, et non `responseCount`. Les
 * deux diffèrent exactement quand la règle dure du module s'applique : le serveur
 * retire de `responses` les réponses d'un membre séparé du lecteur, mais
 * `responseCount` est dénormalisé et les compte encore. Afficher « 3 RÉPONSES »
 * au-dessus de deux lignes serait dire au membre qu'une réponse lui est cachée —
 * c'est-à-dire lui apprendre l'existence de quelqu'un qu'un blocage doit lui faire
 * oublier.
 *
 * LE `404` NE DEVIENT PAS UN ÉCRAN VIDE ICI. Cette route répond `404` quand la
 * demande n'existe pas ET quand un blocage sépare les deux membres (§4 : « 404 et
 * jamais 403 »). Les deux cas veulent dire la même chose à l'écran — « cette page
 * n'existe pas pour vous » — et `displayMessageFor` le dit. Le masquer en liste
 * vide ferait croire à une demande sans réponses.
 */
export async function chargerH02(id: string): Promise<H02Data> {
  const [bandeau, detail] = await Promise.all([
    bandeauSeul(),
    memberApi.get(`/help/${encodeURIComponent(id)}`, helpDetailResponseSchema),
  ]);

  const parcours = detail.journeyContext;
  const requete = detail.request;
  const marqueeId = requete.resolvedByResponseId;
  const aidant =
    marqueeId === null
      ? null
      : (detail.responses.find((r) => r.id === marqueeId)?.author.displayName ?? null);
  return {
    ...bandeau,
    action: {
      id: requete.id,
      kind: requete.kind,
      statut: requete.status,
      estAuteur: requete.isAuthor,
      peutModifier: requete.canEdit,
      peutRouvrir: requete.canReopen,
      titre: requete.title,
      corps: requete.body,
      type: requete.type,
      categorie: CATEGORIES_FR[requete.type],
      // `dueDate` est un horodatage complet : le champ de date veut AAAA-MM-JJ.
      echeance: requete.dueDate === null ? '' : requete.dueDate.slice(0, 10),
      deParcours: requete.fromJourney,
      parcours:
        detail.journeyContext?.own == null
          ? null
          : {
              journeyId: detail.journeyContext.own.journeyId,
              stepId: detail.journeyContext.own.stepId,
              fait: detail.journeyContext.own.stepDone,
              etape: detail.journeyContext.stepName,
            },
      signalement: { type: 'HELP_REQUEST', id: requete.id },
      aidant,
    },
    demande: {
      titre: detail.request.title,
      corps: detail.request.body,
      extrait: detail.request.excerpt,
      auteur: membreDessine(detail.request.author, 0),
      nbReponses: detail.responses.length,
      /**
       * L'AIDANT DONT LA RÉPONSE A ÉTÉ MARQUÉE, retrouvé par
       * `resolvedByResponseId` dans la liste des réponses VISIBLES.
       *
       * `null` si la demande est ouverte, ET AUSSI si la réponse marquée n'est pas
       * dans la liste — ce qui arrive exactement quand son auteur est séparé du
       * lecteur par un blocage. Le bandeau disparaît alors au lieu de nommer
       * quelqu'un que le lecteur ne doit pas retrouver : c'est la règle dure du
       * module, et elle vaut aussi pour un nom dans une phrase.
       */
      resolue: (() => {
        const marquee = detail.request.resolvedByResponseId;
        if (marquee === null) return null;
        const reponse = detail.responses.find((r) => r.id === marquee);
        return reponse === undefined ? null : { aidant: reponse.author.displayName };
      })(),
      /**
       * ÉCART SIGNALÉ : la maquette écrit « Étape 7 », donc le RANG de l'étape dans
       * son parcours. `journeyContext` ne porte que son NOM. Le rang n'est donc ni
       * composé ni rempli d'un zéro : il a disparu de la liaison, et la ligne se lit
       * « Étape Logement · parcours Études ». Un « Étape 1 » faux serait pire qu'un
       * numéro absent — il se lirait comme une information.
       */
      parcours:
        parcours === null
          ? null
          : {
              // « Étape 7 · Logement » : le rang vient de la carte (`journeyStep`).
              etape:
                detail.request.journeyStep === null
                  ? parcours.stepName
                  : `${String(detail.request.journeyStep.stepNumber)} · ${parcours.stepName}`,
              type: parcours.journeyTypeName,
              jours: parcours.dueInDays ?? 0,
            },
    },
    reponses: detail.responses.map(
      (r, rang): ReponsePublique => ({
        fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
        initiales: initialesDe(r.author.displayName),
        nom: r.author.displayName,
        age: `· ${ageCourt(r.createdAt)}`,
        corps: r.body,
        marquee: r.markedHelpful,
        peutMarquer: r.canMarkHelpful,
        action: {
          id: r.id,
          demandeId: requete.id,
          corps: r.body,
          marquee: r.markedHelpful,
          peutMarquer: r.canMarkHelpful,
          estMienne: r.isMine,
          peutModifier: r.canEdit,
          signalement: { type: 'HELP_RESPONSE', id: r.id },
        },
      }),
    ),
  };
}

// ─── H03, H05, H07, H08 · le bandeau seul ───────────────────────────────────

/**
 * Quatre écrans ne lisent que leur bandeau, et ce n'est pas un renoncement : ce
 * sont les quatre dont la maquette ne dessine PAS de donnée liable au-delà.
 *
 *   · H03 « Publier une demande » — ses champs sont des exemples devenus
 *     `placeholder`, ses cinq types sont l'énumération `HelpType2`, et la phrase
 *     « Pour un logement ou un emploi, utilisez Services. » est
 *     `HELP_USE_SERVICES_HINT`, déjà source unique dans `@app/shared`.
 *   · H05 « Parrainage » — sa liste de parrains porte une liste de pastilles DANS
 *     chaque carte : une boucle dans une boucle, remontée plutôt que montée à
 *     moitié (voir `entraide/data.ts`).
 *   · H07 « Mes parrainages » — ses trois blocs sont trois cartes de formes
 *     différentes (actif, terminé, en attente), et le troisième dessine DEUX
 *     variantes selon le sens de la demande (« Accepter / Refuser » contre
 *     « En attente »). Même nature de travail que les listes d'entraide.
 *   · H08 « Devenir parrain » — ses trois conditions sont du texte de RÈGLE, et
 *     aucune route ne dit LESQUELLES manquent au membre : l'API répond
 *     `MENTOR_NOT_ELIGIBLE` sans détail. Écart signalé.
 */
export const chargerH03 = (): Promise<H03Data> => bandeauSeul();
/**
 * H05 porte la ville de son filtre, et par le même chemin que H01 : le bandeau
 * charge déjà le profil public pour la réputation, donc le nom est là.
 */
export async function chargerH05(): Promise<H05Data> {
  const { moi, reputation, compteurs, avertissement, profil } = await chargerBandeau();
  return { moi, reputation, compteurs, avertissement, ville: profil.city?.name ?? '—' };
}
export const chargerH07 = (): Promise<H07Data> => bandeauSeul();
export const chargerH08 = (): Promise<H08Data> => bandeauSeul();

// ─── H04 · /entraide/aider ──────────────────────────────────────────────────

/**
 * H04 — « Vous pouvez aider », à son adresse propre.
 *
 * Son bandeau, et SA RANGÉE DE PORTÉE, qui était restée un dessin : la laisser
 * ainsi aurait créé à deux routes de distance le défaut exact que ce lot répare —
 * le membre qui tape « Vous pouvez aider » sur le fil arriverait sur une page où la
 * rangée redevient une image, et où « Toutes » ne le ramène pas.
 *
 * ⚠ SA LISTE DE CARTES N'EST TOUJOURS PAS LIÉE, et l'écart s'est ÉLARGI avec ce
 * lot : la portée « Vous pouvez aider » du fil affiche désormais la vraie liste de
 * `GET /help/can-help`, et cette page-ci affiche encore les deux cartes dessinées
 * par la maquette. La raison du blocage est écrite dans
 * `app/(app)/entraide/aider/page.tsx` — la pastille de MOTIF de chaque carte
 * (« Vous avez franchi l'étape Logement » contre « Correspond à vos types
 * d'aide ») dit POURQUOI la demande correspond, et `helpCardSchema` ne porte que
 * `fromJourney`. REMONTÉ, avec le chemin pour refermer : `fromJourney: false`
 * PROUVE la correspondance par types déclarés (le `where` du service n'a pas
 * d'autre critère disponible dans ce cas) ; `fromJourney: true` reste ambigu entre
 * les deux critères, et c'est là que la décision du porteur manque.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉCHÉANCE, OU L'ÂGE — LA PLANCHE N'ÉCRIT QUE LA PREMIÈRE                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « échéance dans 2 j » est ce que la planche de H04 écrit, et `helpCardSchema`
 * porte bien `dueDate`. Mais il le porte NULLABLE : une demande sans échéance
 * existe, et le service la range après celles qui en ont (« nulls last »). La
 * planche ne dessine pas ce cas.
 *
 * On ne compose donc pas une fausse échéance : à `null`, le même emplacement
 * reçoit l'ÂGE de la demande, par `ageCourt` — le seul formateur du module, celui
 * que H02 et le fil emploient déjà. Deux échelles de temps dans un module
 * divergeraient au premier changement.
 *
 * Les deux bords sont nommés plutôt qu'arrondis à zéro : « échéance dans 0 j » se
 * lirait comme un défaut d'affichage, et une échéance passée n'est pas une
 * échéance proche. Ces deux phrases ne sont dans aucune planche — ce sont des
 * DONNÉES composées ici, comme « Demande issue d'un parcours ».
 */
function echeanceCourte(dueDate: string | null, createdAt: string, maintenant = Date.now()): string {
  if (dueDate === null) return ageCourt(createdAt, maintenant);
  const jours = Math.ceil((new Date(dueDate).getTime() - maintenant) / 86_400_000);
  if (jours < 0) return 'échéance dépassée';
  if (jours === 0) return 'échéance aujourd’hui';
  return `échéance dans ${String(jours)} j`;
}

/**
 * UNE SUGGESTION, ET LA MOITIÉ DE MOTIF QUE L'API PERMET DE DÉMONTRER.
 *
 * La planche dit POURQUOI chaque demande est suggérée — « Vous avez franchi
 * l'étape Logement » contre « Correspond à vos types d'aide ». `helpCardSchema`
 * ne porte que `fromJourney`, et le `where` du service en dit juste assez :
 *
 *   · `fromJourney === false` ⇒ `originJourneyStep` est nul ⇒ le critère « étape
 *     franchie » N'A PAS PU jouer, donc c'est le type d'aide déclaré. La phrase de
 *     la planche est alors DÉMONTRÉE ;
 *   · `fromJourney === true` reste ambigu entre les deux critères, qui sont en
 *     `OR`. On écrit donc « Demande issue d'un parcours » — la phrase que
 *     `ligneDemande` emploie déjà pour le même manque — et SURTOUT pas le nom
 *     d'une étape que la réponse ne contient pas.
 *
 * ⚠ ÉCART REMONTÉ : la planche perd son « Vous avez franchi l'étape Logement ». Le
 * combler demande que la route dise ce qui a matché — un `matchedBy` dans la carte.
 */
function ligneSuggestion(d: HelpCard, rang: number): LigneSuggestion {
  const nom = d.author.displayName;
  return {
    categorie: CATEGORIES_FR[d.type] ?? d.type,
    motif: d.fromJourney ? ligneParcours(d) : 'Correspond à vos types d’aide',
    delai: echeanceCourte(d.dueDate, d.createdAt),
    titre: d.title,
    extrait: d.excerpt,
    href: `/entraide/${d.id}`,
    auteur: nom,
    auteurInitiales: initialesDe(nom),
    auteurFond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
    auteurPhase: PHASES_FR[d.author.phase],
    reponses: `${String(d.responseCount)} réponse${d.responseCount > 1 ? 's' : ''}`,
  };
}

/**
 * H04 — « Vous pouvez aider », à son adresse propre, et SUR LA MÊME DONNÉE QUE LA
 * PASTILLE DU FIL.
 *
 * MESURÉ avant correction, aux deux largeurs : `GET /help/can-help` rendait sept
 * suggestions, la portée « Vous pouvez aider » du fil en affichait sept à 390 px,
 * et cette page affichait les deux cartes de la planche. Le lot qui a rendu la
 * pastille vivante avait donc ÉLARGI l'écart avant de le refermer ; c'est pour cela
 * que les deux sont dans le même lot.
 *
 * `/help/can-help?limit=20` — le MÊME appel, la même limite, et le `meta.reason`
 * lu de la même façon : une seule lecture de la route pour les deux chemins, donc
 * aucun moyen qu'ils se contredisent.
 */
export const chargerH04 = async (): Promise<H04Data> => {
  const [bandeau, suggestions] = await Promise.all([
    bandeauSeul(),
    memberApi.get('/help/can-help?limit=20', helpCanHelpResponseSchema),
  ]);

  return {
    ...bandeau,
    portees: porteesDeH04(bandeau.compteurs),
    suggestions: suggestions.items.map((d, rang) => ligneSuggestion(d, rang)),
    vide: videDuFil(
      suggestions.items.length,
      'aider',
      suggestions.meta.reason === 'NO_CRITERIA',
      '*',
      '',
    ),
  };
};

// ─── H06 · /parrainage/:handle ──────────────────────────────────────────────

/**
 * La fiche d'un parrain.
 *
 * `situation` NE PORTE QUE LA VILLE, et l'écart est écrit dans `h06/data.ts` :
 * `card()` ne rend ni l'année d'arrivée, ni le pays d'origine, ni la phase, alors
 * que `MENTOR_SELECT` les sélectionne. Composer « Installée depuis 2019 » à partir
 * de rien serait inventer.
 *
 * `appellation` est au masculin par défaut : « parrain ». La maquette écrit
 * « parraine » parce qu'elle montre Aïcha ; l'API ne porte pas le genre, et le
 * déduire d'un prénom est précisément ce qu'on refuse de faire.
 */
export async function chargerH06(handle: string): Promise<H06Data> {
  const [bandeau, fiche, modeles] = await Promise.all([
    bandeauSeul(),
    memberApi.get(`/mentors/${encodeURIComponent(handle)}`, mentorCardResponseSchema),
    // Les identifiants de types de parcours de la fiche, nommés. Un échec ne fait pas
    // tomber la fiche : les pastilles disparaissent, c'est tout.
    memberApi.get('/journey-templates', journeyTemplatesResponseSchema).catch(() => null),
  ]);
  const nomsTypes = (modeles?.items ?? [])
    .filter((t) => fiche.journeyTemplateIds.includes(t.id))
    .map((t) => t.nameFr);

  return {
    ...bandeau,
    parrain: {
      handle: fiche.handle,
      signalement: { type: 'USER', id: fiche.userId },
      complet: fiche.availability !== 'AVAILABLE',
      types: nomsTypes,
      nom: fiche.displayName,
      initiales: initialesDe(fiche.displayName),
      dispo: fiche.availability === 'AVAILABLE' ? DISPO_LIBRE : DISPO_COMPLET,
      situation: fiche.city === null ? '—' : fiche.city.name,
      bio: fiche.bio ?? '—',
      menes: fiche.completedCount,
      note: noteFr(fiche.avgRating),
      appellation: 'parrain',
    },
    evaluations: fiche.reviews.map((r) => ({
      commentaire: r.comment ?? '—',
      /** §11 : l'évaluation d'un membre supprimé est conservée, ANONYMISÉE. */
      auteur: r.reviewer === null ? 'Membre supprimé' : r.reviewer.displayName,
    })),
  };
}

// ─── H09 · /entraide/mes-demandes ───────────────────────────────────────────

/**
 * Mes demandes.
 *
 * ÉCART SIGNALÉ : « 1 avec de nouvelles réponses » demande de savoir ce qui est
 * NEUF depuis ma dernière visite. Aucun champ de `GET /help/mine` ne le dit. Le
 * nombre affiché est donc celui des demandes QUI ONT des réponses — une donnée
 * réelle de la route — et non une heuristique de fraîcheur inventée ici.
 */
export async function chargerH09(): Promise<H09Data> {
  const [bandeau, mine] = await Promise.all([
    bandeauSeul(),
    memberApi.get('/help/mine?limit=50', helpMineResponseSchema),
  ]);

  return {
    ...bandeau,
    mesDemandes: {
      total: mine.items.length,
      avecNouvelles: mine.items.filter((d: HelpCard) => d.responseCount > 0).length,
      resolues: mine.items.filter((d: HelpCard) => d.status === 'RESOLVED').length,
    },
  };
}

// ─── H10 · /entraide/mes-reponses ───────────────────────────────────────────

/**
 * Mes réponses.
 *
 * ÉCART SIGNALÉ : `GET /help/my-responses` n'a PAS de `meta.count`, contrairement
 * à `GET /me/connections` qui porte le sien. Les deux nombres sont donc comptés
 * sur la page rendue, et ils seront FAUX au-delà de cinquante réponses. On ne
 * masque pas l'écart derrière une pagination muette : on le remonte.
 */
export async function chargerH10(): Promise<H10Data> {
  const [bandeau, mes] = await Promise.all([
    bandeauSeul(),
    memberApi.get('/help/my-responses?limit=50', helpMyResponsesResponseSchema),
  ]);

  return {
    ...bandeau,
    mesReponses: {
      total: mes.items.length,
      utiles: mes.items.filter((r) => r.markedHelpful).length,
      /**
       * LA LISTE DE LA PLANCHE MOBILE, et ses deux états.
       *
       * `markedHelpful` est le SEUL discriminant, et il vient du serveur :
       * `marquee` et `attente` sont les deux variantes que la maquette dessine, pas
       * un calcul fait ici. Rien n'est dérivé d'une horloge — `ageCourt` formate un
       * horodatage, il ne décide d'aucun état.
       *
       * ÉCART SIGNALÉ : la planche écrit « hier » et `ageCourt` rend « il y a 1 j ».
       * Un seul formateur sert tout le module (H02 l'emploie déjà) ; deux échelles
       * divergeraient au premier changement.
       */
      liste: mes.items.map((r) => ({
        categorie: CATEGORIES_FR[r.request.type],
        age: ageCourt(r.createdAt),
        auteur: r.request.author.displayName,
        titre: r.request.title,
        corps: r.body,
        prenom: prenomDe(r.request.author.displayName),
        marquee: r.markedHelpful,
        attente: !r.markedHelpful,
      })),
    },
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DESSIN SANS LA DONNÉE — POUR QUE LE CADRE SOIT SERVI TOUT DE SUITE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, sans exécuter le JavaScript : `/entraide` répondait 200
 * avec une coquille — pas de rail, pas de panneau de section, pas de barre basse.
 * La branche d'attente de `EcranDonnees` remplaçait le cadre entier par sa phrase,
 * donc les destinations déclarées sur ce cadre n'atteignaient jamais le navigateur.
 * Ce n'était PAS un lien mort : le `<a href="/entraide/aider">` est bien dans
 * `h01/desktop.generated.tsx` — c'était un cadre non rendu. Deux défauts
 * différents, et il ne faut pas confondre la cause.
 *
 * Le motif juste est celui de `/accueil` : le dessin se rend tout de suite, la
 * donnée se remplit ensuite. Cet objet est la part « dessin » — des compteurs à
 * zéro et des chaînes vides, c'est-à-dire RIEN D'INVENTÉ : un écran qui n'a pas
 * encore ses nombres n'en affiche aucun.
 *
 * `avertissement` EST LA SEULE EXCEPTION, ET C'EST UNE RÈGLE DURE. §2.7 exige la
 * phrase « sur chaque page de la section », et `HELP_SAFETY_BANNER` est la MÊME
 * constante que le serveur sert dans son `meta`. La laisser vide ferait une page
 * où la règle de sécurité manque pendant le chargement — exactement l'écran où
 * l'oublier serait le plus facile. C'est la discipline que `VUE_NEUTRE` du module
 * Parcours applique déjà à `CHECKLIST_NOTICE`.
 */
const SQUELETTE_BANDEAU: BandeauEntraide = {
  moi: { initiales: '', prenom: '' },
  /**
   * ─── LE TIRET CADRATIN, ET PAS UN ZÉRO ────────────────────────────────────
   *
   * `0` est un NOMBRE FAUX qui se lit comme vrai : « 23 entraides validées »
   * devenu « 0 entraides validées » annonce au membre qu'il n'a rien fait, le
   * temps que l'appel réponde. Les champs numériques du bandeau sont donc des
   * chaînes dans leur type là où la maquette les affiche en texte… et ils ne le
   * sont PAS : `Reputation` et `CompteursEntraide` les déclarent `number`.
   *
   * On ne peut donc pas y mettre un tiret, et c'est une limite DITE plutôt que
   * contournée : le zéro reste, il est visible pendant quelques dizaines de
   * millisecondes, et le rendre juste demanderait que ces champs acceptent une
   * chaîne — ce qui est un changement de type, donc d'autres écrans. Remonté.
   */
  reputation: { entraides: 0, guides: 0, parrainages: 0, evenements: 0 },
  compteurs: { ouvertes: 0, pouvezAider: 0, parrainages: 0, resoluesCeMois: 0 },
  avertissement: HELP_SAFETY_BANNER,
};

/**
 * LES SEPT ÉCRANS DU MODULE QUI ONT UNE ROUTE DE PANNEAU, chacun avec SA prise.
 *
 * Ce ne sont pas sept copies : six d'entre eux n'ajoutent RIEN au bandeau (H03,
 * H04, H07 et H08 sont littéralement `BandeauEntraide`), et les trois autres
 * n'ajoutent qu'un compteur. C'est le `data.ts` de chaque écran qui le dit, pas
 * une supposition.
 *
 * POURQUOI LES SEPT ET PAS SEULEMENT H01 : parce que ce sont les destinations que
 * le panneau de section vient de gagner. Un sous-lien qui atterrit sur une
 * coquille vide est, pour le porteur, un sous-lien qui ne marche pas — il verrait
 * « Chargement de votre compte… » et pas la page. Mesuré au HTML servi :
 * `/entraide/aider` servait CINQ mots et zéro entrée de rail.
 */
/**
 * LES FILTRES SONT LÀ AVANT LA LISTE : ils ne dépendent d'aucune réponse, et une
 * rangée de pastilles qui apparaît après coup fait sauter la page.
 */
export const SQUELETTE_H01: H01Data = {
  ...SQUELETTE_BANDEAU,
  ville: '',
  demandes: [],
  typesDemande: filtresType('*', () => undefined),
  /**
   * LES CINQ PASTILLES SONT LÀ AVANT LA LISTE, pour la même raison que les
   * filtres : elles ne dépendent d'aucune réponse, et une rangée qui apparaît
   * après coup fait sauter la page. Leurs deux compteurs valent zéro le temps du
   * chargement — la même limite de type que `reputation`, déjà dite plus haut.
   */
  portees: porteesDuFil('toutes', SQUELETTE_BANDEAU.compteurs, () => undefined),
  /**
   * ⚠ `null` ET SURTOUT PAS UN ÉTAT VIDE. La liste est vide ici parce que l'appel
   * n'a pas encore répondu, pas parce que la ville n'a aucune demande. Afficher
   * « Aucune demande ouverte à — » pendant le chargement serait exactement le
   * mensonge que `videDuFil` existe pour empêcher, et il durerait le temps d'un
   * aller-retour — assez pour être lu.
   */
  vide: null,
};
export const SQUELETTE_H03: H03Data = SQUELETTE_BANDEAU;
export const SQUELETTE_H04: H04Data = {
  ...SQUELETTE_BANDEAU,
  portees: porteesDeH04(SQUELETTE_BANDEAU.compteurs),
  suggestions: [],
  /** `null` : voir `SQUELETTE_H01`. Une liste vide d'attente n'est pas un vide. */
  vide: null,
};
export const SQUELETTE_H05: H05Data = { ...SQUELETTE_BANDEAU, ville: '' };
export const SQUELETTE_H07: H07Data = SQUELETTE_BANDEAU;
export const SQUELETTE_H08: H08Data = SQUELETTE_BANDEAU;
export const SQUELETTE_H09: H09Data = {
  ...SQUELETTE_BANDEAU,
  mesDemandes: { total: 0, avecNouvelles: 0, resolues: 0 },
};
export const SQUELETTE_H10: H10Data = {
  ...SQUELETTE_BANDEAU,
  mesReponses: { total: 0, utiles: 0, liste: [] },
};

/**
 * LES DEUX ÉCRANS DE DÉTAIL DU MODULE — la demande, la fiche d'un parrain.
 *
 * Même cause, même remède : sans squelette, `/entraide/:id` et
 * `/parrainage/:handle` répondent 200 en servant « DisaporyPlus Chargement de
 * votre compte… » et rien d'autre.
 *
 * `titre: '—'` ET PAS LA CHAÎNE VIDE, et c'est axe-core qui l'a tranché ailleurs :
 * un titre vide promu en `<h1>` fait un en-tête SANS CONTENU, et la même chaîne
 * vide dans un `<a>` fait un lien sans nom accessible (`link-name`, `serious`).
 * Le tiret cadratin donne un nom sans inventer de titre — et il se lit comme
 * « pas encore de valeur », ce que `0` ne fait pas.
 *
 * `parcours: null` et `resolue: null` font DISPARAÎTRE les lignes
 * correspondantes (la maquette les dessine sous condition) plutôt que d'afficher
 * « Étape undefined » ou une résolution qui n'a pas eu lieu.
 *
 * LES TEINTES DE LA PASTILLE DE DISPONIBILITÉ sont celles de la maquette pour
 * « Disponible » — `#E3F0EB` sur `#0F5C48`. Le LIBELLÉ, lui, est un tiret : la
 * pastille garde sa forme sans annoncer une disponibilité que le serveur n'a pas
 * confirmée.
 */
export const SQUELETTE_H02: H02Data = {
  ...SQUELETTE_BANDEAU,
  action: {
    id: '',
    kind: 'REQUEST',
    statut: 'OPEN',
    estAuteur: false,
    peutModifier: false,
    peutRouvrir: false,
    titre: '',
    corps: '',
    type: 'OTHER',
    categorie: '',
    echeance: '',
    deParcours: false,
    parcours: null,
    signalement: { type: 'HELP_REQUEST', id: '' },
    aidant: null,
  },
  demande: {
    titre: '—',
    corps: '',
    extrait: '',
    auteur: { initiales: '', nom: '', fond: '#F2F5F4', phase: '', ville: '' },
    nbReponses: 0,
    parcours: null,
    resolue: null,
  },
  reponses: [],
};

export const SQUELETTE_H06: H06Data = {
  ...SQUELETTE_BANDEAU,
  parrain: {
    handle: '',
    signalement: { type: 'USER', id: '' },
    complet: false,
    types: [],
    nom: '—',
    initiales: '',
    dispo: { libelle: '—', fond: '#E3F0EB', texte: '#0F5C48' },
    situation: '',
    bio: '',
    menes: 0,
    note: '',
    appellation: '',
  },
  evaluations: [],
};
