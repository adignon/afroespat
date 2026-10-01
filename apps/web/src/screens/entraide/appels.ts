'use client';

import {
  helpCanHelpResponseSchema,
  helpDetailResponseSchema,
  helpListResponseSchema,
  helpMineResponseSchema,
  helpMyResponsesResponseSchema,
  mentorCardResponseSchema,
  myMentorshipsResponseSchema,
  publicProfileResponseSchema,
  type HelpCard,
  type HelpMember,
  type MeResponse,
  type Phase,
  type PublicProfileResponse,
} from '@app/shared';
import { fetchMe, memberApi } from '@/lib/api/index';
import type { BandeauEntraide, CompteursEntraide, MembreDessine } from './data';
import type { H01Data } from '../h01/data';
import type { H02Data, ReponsePublique } from '../h02/data';
import type { H03Data } from '../h03/data';
import type { H04Data } from '../h04/data';
import type { H05Data } from '../h05/data';
import type { H06Data } from '../h06/data';
import type { H07Data } from '../h07/data';
import type { H08Data } from '../h08/data';
import type { H09Data } from '../h09/data';
import type { H10Data } from '../h10/data';

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
  const [profil, compteurs] = await Promise.all([
    memberApi.get(`/users/${encodeURIComponent(me.user.handle)}`, publicProfileResponseSchema),
    chargerCompteurs(me),
  ]);

  const stats = profil.stats;
  return {
    moi: { initiales: initialesDe(me.user.displayName), prenom: prenomDe(me.user.displayName) },
    reputation: {
      entraides: stats?.helpValidatedCount ?? 0,
      guides: stats?.guideHelpfulVotes ?? 0,
      parrainages: stats?.mentorshipsCompleted ?? 0,
      evenements: stats?.eventsOrganized ?? 0,
    },
    compteurs,
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
async function chargerCompteurs(me: MeResponse): Promise<CompteursEntraide> {
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
      .then((r) => ({ ouvertes: r.meta.open ?? 0, resoluesCeMois: r.meta.resolvedThisMonth ?? 0 }))
      .catch(() => ({ ouvertes: 0, resoluesCeMois: 0 })),
    decoratif(
      memberApi.get('/help/can-help?limit=20', helpCanHelpResponseSchema).then((r) => r.items.length),
    ),
    decoratif(
      memberApi
        .get('/me/mentorships', myMentorshipsResponseSchema)
        .then((r) => r.items.filter((m) => m.status === 'ACTIVE' || m.status === 'REQUESTED').length),
    ),
  ]);

  return { ...metaFil, pouvezAider, parrainages };
}

/** Le bandeau seul, pour les six écrans qui ne lisent que lui. */
const bandeauSeul = async (): Promise<BandeauEntraide> => {
  const { moi, reputation, compteurs } = await chargerBandeau();
  return { moi, reputation, compteurs };
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
export async function chargerH01(): Promise<H01Data> {
  const { moi, reputation, compteurs, profil } = await chargerBandeau();
  return { moi, reputation, compteurs, ville: profil.city?.name ?? '—' };
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
  return {
    ...bandeau,
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
              etape: parcours.stepName,
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
export const chargerH05 = (): Promise<H05Data> => bandeauSeul();
export const chargerH07 = (): Promise<H07Data> => bandeauSeul();
export const chargerH08 = (): Promise<H08Data> => bandeauSeul();

// ─── H04 · /entraide/aider ──────────────────────────────────────────────────

export const chargerH04 = (): Promise<H04Data> => bandeauSeul();

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
  const [bandeau, fiche] = await Promise.all([
    bandeauSeul(),
    memberApi.get(`/mentors/${encodeURIComponent(handle)}`, mentorCardResponseSchema),
  ]);

  return {
    ...bandeau,
    parrain: {
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
    },
  };
}
