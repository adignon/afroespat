'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_MIN_INVITES,
  communityDescriptionSchema,
  communityNameSchema,
  type CommunityCategory,
  type CommunityDetailResponse,
  type CommunityVisibility,
  handleSchema,
  publicProfileResponseSchema,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';
import { avatarColor, initials, sansAccent } from '../accueil/from-api';
import { createCommunity } from './api';
import { echecDe, type ReseauEchec } from './echec';
import { panelReseaux, rail } from './chrome';
import type { A10Data, InviteeView } from '../a10/data';
import {
  CREER_ALLUME,
  CREER_INACTIF,
  categorieOptions,
  shortcuts,
  visibilityFor,
} from '../a10/data';

/**
 * L'ÉTAT DE A10 — créer un réseau d'intérêt.
 *
 * ── CE QUI CHANGE DANS CE LOT : LE FORMULAIRE EXISTE ───────────────────────
 *
 * Avant, ce crochet portait l'appel et le compteur, et le CADRE ne portait aucun
 * champ : les trente-trois cadres du module avaient zéro champ et zéro geste, et
 * A10 ne faisait pas exception — « Entrepreneurs africains à Lyon » était un
 * `<div>`, « Créer le réseau » un `<button>` nu. `soumettre(nom, …)` attendait
 * donc des valeurs que personne ne pouvait taper.
 *
 * Les champs vivent MAINTENANT ici, et les cadres les lisent. `soumettre` ne
 * prend plus d'arguments : l'état du formulaire est à un seul endroit, et il n'y
 * a plus de chemin par lequel l'écran et l'appel pourraient diverger.
 *
 * ── LE COMPTEUR DES CINQ LIT LA CONSTANTE DU SCHÉMA PARTAGÉ ────────────────
 *
 * `COMMUNITY_MIN_INVITES` vient de `@app/shared`, à côté du schéma que l'API
 * emploie pour refuser. C'est ce qui empêche l'écran d'afficher « 4 sur 4 » et
 * d'envoyer une requête que le serveur rejettera : une seconde définition de la
 * règle côté formulaire finirait par autoriser quatre invités là où l'API en
 * exige cinq.
 *
 * Le schéma DÉDOUBLONNE aussi les handles avant de compter — inviter cinq fois
 * la même personne ne suffit pas à ouvrir un réseau vide. Le compteur d'ici fait
 * donc la même chose, et pour la même raison.
 *
 * Les BORNES des deux champs de texte sont lues sur leurs schémas
 * (`communityNameSchema.maxLength`, `communityDescriptionSchema.maxLength`) et non
 * recopiées : `@app/shared` n'exporte pas de constante pour elles, mais Zod les
 * expose, et c'est la même source que l'API applique.
 *
 * ── DEUX REFUS, ET AUCUN N'EST DEVANCÉ ─────────────────────────────────────
 *
 *   · `403 LEVEL_REQUIRED` si le compte n'est pas **L2**. On ne lit PAS le niveau
 *     pour griser le bouton : un niveau lu une fois et gardé, c'est la faille de
 *     quinze minutes rejouée dans le front. On tente, et `echec.levelRequired`
 *     porte `requiredLevel`, `currentLevel` et `labelFr` — de quoi afficher
 *     l'INVITATION de §7.3, jamais une erreur sèche ;
 *   · `422 CITY_THRESHOLD` si la ville n'atteint pas le seuil. Le service le
 *     revérifie à la création même si `creationGate` disait oui — sinon un appel
 *     direct suffirait à ouvrir un réseau dans une ville de trois membres.
 *
 * CE COMMENTAIRE DISAIT « L1 », ET C'ÉTAIT PÉRIMÉ. La table des capacités fait
 * foi : `'community.create': { minLevel: 'L2' }`. C'est l'arbitrage du porteur
 * sur la refonte des niveaux — « N2 — tout le reste, sans exception ».
 *
 * ── `candidats` ARRIVE ENFIN REMPLI, ET CET EN-TÊTE DISAIT LE CONTRAIRE ────
 *
 * Il annonçait une liste vide « hors de ce lot », avec la conséquence mesurée :
 * `invitesChoisis` ne pouvait pas atteindre `COMMUNITY_MIN_INVITES`, donc
 * `creerPret` restait faux et créer un réseau depuis l'écran était IMPOSSIBLE.
 * C'est corrigé : la page passe `useContactsInvitables()`, qui lit
 * `GET /me/connections` en réemployant l'appel de trois autres écrans.
 *
 * ── LE FILTRE DE RECHERCHE NE TOUCHE QUE L'AFFICHAGE ───────────────────────
 *
 * `recherche` réduit `invitees`, jamais `choisis`. C'est la seule répartition
 * juste : un contact invité puis masqué par une frappe dans le champ reste
 * invité, et le compteur « N sur 5 » continue de le compter. Filtrer l'état
 * ferait disparaître une invitation à chaque lettre tapée, et le compteur
 * reculerait sous les yeux du membre sans qu'il ait rien décoché.
 */
export interface CreationEtat {
  readonly data: A10Data;
  readonly echec: ReseauEchec | null;
  readonly envoi: boolean;
  readonly cree: CommunityDetailResponse | null;
  /** Combien d'invités DISTINCTS sont choisis, et combien il en faut. */
  readonly invitesChoisis: number;
  readonly invitesRequis: number;
  /**
   * Le formulaire est-il complet ?
   *
   * `false` grise le bouton d'envoi — et c'est une commodité d'ÉCRITURE, pas une
   * autorisation : la règle est dans le schéma partagé, qui refusera de toute
   * façon, et le serveur derrière lui. Ce booléen évite un aller-retour inutile,
   * il ne garde rien.
   */
  readonly complet: boolean;
  readonly basculer: (handle: string) => void;
  readonly choisirVisibilite: (index: number) => void;
  /**
   * Envoie `POST /communities` avec l'état du formulaire.
   *
   * SANS ARGUMENT, et c'est le changement : les trois champs sont dans ce
   * crochet, parce que ce sont ses champs que les cadres éditent.
   */
  readonly soumettre: () => Promise<void>;
}

export function useCreation(
  candidats: readonly InviteeView[],
  /**
   * Ce qu'il faut faire du réseau créé. La page le sait — elle a le routeur —
   * et le crochet ne décide pas de la navigation.
   */
  apresCreation?: (reseau: CommunityDetailResponse) => void,
  /** Le geste de la croix de l'en-tête mobile. La page le sait aussi. */
  surFermeture?: () => void,
): CreationEtat {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState<CommunityCategory>(
    categorieOptions[0]?.value ?? 'autre',
  );
  const [choisis, setChoisis] = useState<readonly string[]>([]);
  const [recherche, setRecherche] = useState('');
  const [visibiliteIndex, setVisibiliteIndex] = useState(0);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<CommunityDetailResponse | null>(null);

  /** DÉDOUBLONNÉ et en minuscules, comme le schéma partagé le fait avant de compter. */
  const handles = useMemo(
    () => [...new Set(choisis.map((h) => h.toLowerCase()))],
    [choisis],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ « RECHERCHER PAR PSEUDO » — AU-DELÀ DES CONTACTS                      ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   *
   * Le champ ne filtrait QUE les contacts : un membre sans contact ne pouvait
   * inviter personne, et le réseau ne se créait jamais (cinq invités exigés).
   * Le porteur : « La création de réseau est dessinée aussi. »
   *
   * Un pseudo EXACT tapé dans le champ — avec ou sans « @ » — est maintenant
   * cherché par `GET /users/:handle`, la route du profil public. C'est la seule
   * recherche de personne qui ne fasse pas un ANNUAIRE : il faut connaître le
   * pseudo, comme pour écrire à quelqu'un. Le serveur accepte d'inviter tout
   * membre actif (`createCommunity` résout les pseudos lui-même et dit ceux
   * qu'il n'a pas trouvés).
   *
   * Les personnes ainsi trouvées RESTENT dans la liste une fois la recherche
   * effacée : sinon une invitée disparaîtrait de l'écran tout en restant
   * comptée dans « 3 sur 5 ».
   */
  const [trouves, setTrouves] = useState<readonly InviteeView[]>([]);
  useEffect(() => {
    const brut = recherche.trim().replace(/^@/, '').toLowerCase();
    if (!handleSchema.safeParse(brut).success) return;
    if (candidats.some((c) => c.handle.toLowerCase() === brut)) return;
    if (trouves.some((c) => c.handle.toLowerCase() === brut)) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void memberApi
        .get(`/users/${encodeURIComponent(brut)}`, publicProfileResponseSchema, {
          signal: ac.signal,
        })
        .then((p) => {
          setTrouves((liste) =>
            liste.some((c) => c.handle === p.handle)
              ? liste
              : [
                  ...liste,
                  {
                    profil: `/@${p.handle}`,
                    i: initials(p.displayName),
                    name: p.displayName,
                    sub: `@${p.handle}`,
                    bg: avatarColor(p.handle),
                    invited: false,
                    btn: 'Inviter',
                    btnBg: '#16785E',
                    btnFg: '#fff',
                    handle: p.handle,
                  },
                ],
          );
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [recherche, candidats, trouves]);

  /**
   * LA RECHERCHE PORTE SUR LE PSEUDO **ET** SUR LE NOM.
   *
   * Le libellé de la planche ne promet que le pseudo — « Rechercher par
   * pseudo » — mais c'est le NOM qui est écrit en gros sur chaque ligne, et
   * taper « Sandra » pour ne rien trouver serait une surprise, pas une règle.
   * Chercher plus large que le libellé ne retire rien à ce qu'il annonce.
   *
   * `sansAccent` est celui du module Accueil, déjà éprouvé seul : il met en
   * minuscules et retire les diacritiques, de sorte que « ndiaye » trouve
   * « Ndiaye » et « fatou » trouve « Fatou ». Une comparaison brute laisserait
   * « Ndiaye » introuvable pour qui tape sans majuscule.
   */
  const invitees: readonly InviteeView[] = useMemo(() => {
    const pris = new Set(handles);
    const nu = sansAccent(recherche.trim().replace(/^@/, ''));
    const tous = [...candidats, ...trouves];
    const retenus =
      nu === ''
        ? tous
        : tous.filter(
            (c) => sansAccent(c.handle).includes(nu) || sansAccent(c.name).includes(nu),
          );
    return retenus.map((c) => {
      const invited = pris.has(c.handle.toLowerCase());
      return {
        ...c,
        invited,
        btn: invited ? 'Invité·e' : 'Inviter',
        btnBg: invited ? '#E3F0EB' : '#16785E',
        btnFg: invited ? '#0F5C48' : '#fff',
      };
    });
  }, [candidats, trouves, handles, recherche]);

  const basculer = useCallback((handle: string) => {
    setChoisis((c) => (c.includes(handle) ? c.filter((h) => h !== handle) : [...c, handle]));
  }, []);

  /**
   * LE FORMULAIRE EST-IL ENVOYABLE ?
   *
   * Le nom passe par SON schéma — `communityNameSchema.safeParse` — plutôt que par
   * un `length >= 3` écrit ici : le schéma `trim()` avant de compter, donc trois
   * espaces ne sont pas un nom, et c'est exactement ce que l'API applique. La
   * catégorie est toujours valide (le menu ne propose que la liste fermée), et
   * les cinq invitations sont comptées sur les handles dédoublonnés.
   */
  const nomValide = communityNameSchema.safeParse(nom).success;
  const complet = nomValide && handles.length >= COMMUNITY_MIN_INVITES;

  const soumettre = useCallback(async () => {
    setEnvoi(true);
    setEchec(null);
    try {
      const visibilite: CommunityVisibility =
        visibilityFor(visibiliteIndex)[visibiliteIndex]?.v ?? 'PUBLIC';
      /**
       * On TENTE. Aucune lecture de niveau, aucune lecture de `creationGate`
       * avant l'appel : les deux portes sont tenues par le serveur, et c'est
       * son refus qui porte de quoi les expliquer.
       */
      const reseau = await createCommunity({
        name: nom,
        ...(description.trim() === '' ? {} : { description }),
        category: categorie,
        visibility: visibilite,
        inviteHandles: handles,
      });
      setCree(reseau);
      apresCreation?.(reseau);
    } catch (e) {
      setEchec(echecDe(e));
    } finally {
      setEnvoi(false);
    }
  }, [apresCreation, categorie, description, handles, nom, visibiliteIndex]);

  /**
   * CE QU'IL RESTE À FAIRE, EN UNE PHRASE QUI PEUT DISPARAÎTRE.
   *
   * La maquette écrit « Invitez encore 2 membres pour créer le réseau. » sur
   * l'ordinateur et « Invitez encore 2 membres. » sur le téléphone. Les deux
   * formes sont composées ici, et elles rendent une chaîne VIDE dès que le compte
   * est atteint : lier le seul nombre laisserait « Invitez encore 0 membres » à
   * l'écran au moment précis où le bouton s'allume.
   */
  const manquants = Math.max(0, COMMUNITY_MIN_INVITES - handles.length);
  const mot = manquants === 1 ? 'membre' : 'membres';
  const reste = manquants === 0 ? '' : `Invitez encore ${manquants} ${mot}`;

  const data: A10Data = useMemo(
    () => ({
      rail,
      shortcuts,
      panelReseaux,
      visibility: visibilityFor(visibiliteIndex),
      invitees,
      nomValue: nom,
      onNomChange: (e) => setNom(e.target.value),
      nomMax: communityNameSchema.maxLength ?? 0,
      descriptionValue: description,
      onDescriptionChange: (e) => setDescription(e.target.value),
      descriptionMax: communityDescriptionSchema.maxLength ?? 0,
      rechercheValue: recherche,
      onRechercheChange: (e) => setRecherche(e.target.value),
      categorie,
      categorieLabel: COMMUNITY_CATEGORY_LABELS[categorie],
      categorieOptions,
      /**
       * UN `<option>` NE REND QUE DU TEXTE, donc la valeur arrive en `string`. On
       * la revalide contre la liste fermée plutôt que de la forcer : un menu
       * natif ne peut pas rendre autre chose, mais c'est le schéma partagé qui
       * décide ce qu'est une catégorie, pas une assertion de type.
       */
      onCategorie: (e) => {
        const choix = categorieOptions.find((c) => c.value === e.target.value);
        if (choix !== undefined) setCategorie(choix.value);
      },
      onVisibilite: setVisibiliteIndex,
      onInviter: basculer,
      /**
       * `void` EXPLICITE : `onClick` attend un gestionnaire synchrone. Les refus
       * partent dans `echec`, que la page affiche — rien n'est avalé.
       */
      onCreer: () => {
        void soumettre();
      },
      onFermer: () => surFermeture?.(),
      creerPret: complet && !envoi,
      creerFond: complet && !envoi ? CREER_ALLUME.fond : CREER_INACTIF.fond,
      creerEncre: complet && !envoi ? CREER_ALLUME.encre : CREER_INACTIF.encre,
      invitesTexte: `${handles.length} sur ${COMMUNITY_MIN_INVITES}`,
      invitesBarre: `${Math.round((Math.min(handles.length, COMMUNITY_MIN_INVITES) / COMMUNITY_MIN_INVITES) * 100)}%`,
      invitesReste: reste === '' ? '' : `${reste} pour créer le réseau.`,
      invitesResteCourt: reste === '' ? '' : `${reste}.`,
    }),
    [
      basculer,
      categorie,
      complet,
      description,
      envoi,
      handles.length,
      invitees,
      nom,
      recherche,
      reste,
      soumettre,
      surFermeture,
      visibiliteIndex,
    ],
  );

  return {
    data,
    echec,
    envoi,
    cree,
    invitesChoisis: handles.length,
    invitesRequis: COMMUNITY_MIN_INVITES,
    complet,
    basculer,
    choisirVisibilite: setVisibiliteIndex,
    soumettre,
  };
}
