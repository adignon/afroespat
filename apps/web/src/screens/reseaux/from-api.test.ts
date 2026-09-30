import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  communitiesResponseSchema,
  communityDetailResponseSchema,
  communityMembersResponseSchema,
  pollsResponseSchema,
  topicDetailResponseSchema,
  topicsResponseSchema,
} from '@app/shared';
import {
  communityIsOpen,
  countersAreVisible,
  discoversFrom,
  inviteeFrom,
  myNetsFrom,
  pinnedRowsFrom,
  pollFrom,
  repliesFrom,
  topicRowsFrom,
  withoutPinned,
} from './from-api';
import { echecDe } from './echec';
import { ApiError } from '../../lib/api/index';

/**
 * LE BRANCHEMENT DES RÉSEAUX, ÉPROUVÉ SUR DES CHARGES RÉELLES.
 *
 * Les fixtures sont celles de `packages/shared/src/__tests__/fixtures/` : des
 * réponses relevées OCTET POUR OCTET sur l'API qui tournait, sur un réseau
 * `PUBLIC` réellement créé, avec un sujet réellement ÉPINGLÉ. Elles sont PARSÉES
 * par le schéma partagé avant d'entrer dans les convertisseurs, et l'ordre
 * compte : c'est ce qui fait que ce fichier éprouve la chaîne complète — charge
 * réelle → schéma partagé → prises du cadre — plutôt que les convertisseurs
 * seuls contre un objet que l'auteur du test aurait façonné à leur mesure.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER GARDE, ET QUE RIEN D'AUTRE NE GARDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le back tient déjà la règle — « le contenu d'un réseau PUBLIC n'est pas
 * renvoyé à un non-membre, même quand l'en-tête l'est » — et la fige dans
 * `communities.int.test.ts`. Mais une garde côté serveur peut être DÉFAITE PAR
 * L'AFFICHAGE sans que le serveur bouge d'une ligne, de deux façons :
 *
 *   1. en présentant un REFUS comme une ABSENCE — « ce réseau n'a pas encore de
 *      sujet » au lieu de « rejoignez pour voir ». Le lecteur apprend alors que
 *      le réseau est mort, ce qui est faux, et le front a répondu à sa place une
 *      question que le serveur avait refusé de trancher ;
 *   2. en traitant un COMPTEUR MASQUÉ comme un compteur réel — `counters.topics`
 *      vaut 0 pour un passant, et l'afficher revient à affirmer « 0 sujet ».
 *
 * Les deux sont figées plus bas, et les mutations correspondantes ont été
 * passées : neutraliser `communityIsOpen` fait rougir.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

function charge(nom: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));
}

const membre = () => communityDetailResponseSchema.parse(charge('community_detail_membre'));
const passant = () => communityDetailResponseSchema.parse(charge('community_detail_nonmembre'));

// ─── 1. La garde, vue depuis l'écran ────────────────────────────────────────

describe('règle dure — l’écran sait qu’il regarde une façade, et ne la remplit pas', () => {
  it('`communityIsOpen` est vrai pour un membre ACTIF et faux pour un passant', () => {
    expect(communityIsOpen(membre())).toBe(true);
    expect(communityIsOpen(passant())).toBe(false);
  });

  /**
   * `INVITED` ET `PENDING` NE SONT PAS DES MEMBRES.
   *
   * Ce sont des antichambres, et le serveur leur refuse le contenu exactement
   * comme à un inconnu (`assertMember` exige `status === 'ACTIVE'`). Un écran
   * qui lirait `myRole !== null` se tromperait sur un invité — il a bien un
   * rôle `MEMBER` en base — et lui montrerait un réseau ouvert qui répondrait
   * 403 à chaque onglet.
   */
  it('un INVITÉ et un DEMANDEUR ne sont pas des membres, malgré leur rôle', () => {
    const base = passant();
    for (const statut of ['INVITED', 'PENDING'] as const) {
      const antichambre = { ...base, myStatus: statut, myRole: 'MEMBER' as const };
      expect(communityIsOpen(antichambre)).toBe(false);
    }
    // Non-vacuité : le même objet avec `ACTIVE` passe, sinon l'assertion
    // ci-dessus serait vraie d'une fonction qui rendrait toujours `false`.
    expect(communityIsOpen({ ...base, myStatus: 'ACTIVE', myRole: 'MEMBER' })).toBe(true);
  });

  it('aucun TITRE de sujet épinglé n’atteint les prises d’un passant', () => {
    const vu = membre();
    const titre = vu.pinned[0]?.title;
    expect(titre).toBeTruthy();
    // Le membre a bien une ligne épinglée, AVEC son titre.
    expect(pinnedRowsFrom(vu.pinned).map((r) => r.title)).toContain(titre);

    // Le passant n'en a aucune — et rien dans ce qu'on lui dessine ne porte le
    // titre. C'est l'assertion centrale : le convertisseur ne va chercher ce
    // titre nulle part ailleurs, parce qu'il n'y a nulle part ailleurs.
    const dehors = passant();
    expect(pinnedRowsFrom(dehors.pinned)).toEqual([]);
    expect(JSON.stringify(pinnedRowsFrom(dehors.pinned))).not.toContain(titre as string);
  });

  /**
   * LES COMPTEURS MASQUÉS NE DOIVENT PAS ÊTRE AFFICHÉS COMME DES COMPTEURS.
   *
   * `countersAreVisible` est la seule chose qui distingue « 0 sujet » de « je ne
   * vous le dirai pas ». Les deux charges portent la même valeur — 0 — et seul
   * `myStatus` les sépare.
   */
  it('les compteurs d’un passant sont masqués, et l’écran le sait', () => {
    const dehors = passant();
    expect(dehors.counters.topics).toBe(0);
    expect(countersAreVisible(dehors)).toBe(false);

    const dedans = membre();
    expect(dedans.counters.topics).toBeGreaterThan(0);
    expect(countersAreVisible(dedans)).toBe(true);
  });

  /**
   * LE REFUS EST RECONNU COMME TEL, ET PAS COMME UNE ERREUR QUELCONQUE.
   *
   * `echecDe` lit `error.code` ET `details.reason` — jamais le message. Sans
   * `notMember`, l'écran afficherait « Vous n'avez pas accès à cette action »
   * au lieu de proposer de rejoindre, ce qui est la seule chose utile à faire.
   */
  it('un 403 NOT_A_MEMBER devient une invitation à rejoindre, pas un message d’erreur', () => {
    /**
     * L'ORDRE DES ARGUMENTS EST `(code, message, status, details, retryAfter)`.
     * Écrit d'abord avec `status` en tête, ce test a rougi immédiatement — ce
     * qui est la bonne nouvelle : il lit vraiment ce que `echecDe` produit, et
     * non ce que son auteur espérait.
     */
    const refus = new ApiError(
      'FORBIDDEN',
      'Vous n’avez pas accès à cette action.',
      403,
      { reason: 'NOT_A_MEMBER', communityId: 'x' },
      null,
    );
    const e = echecDe(refus);
    expect(e.notMember).toBe(true);
    expect(e.rankTooLow).toBe(false);
    expect(e.incident).toBe(false);

    // Un 403 d'un AUTRE motif n'est PAS une invitation à rejoindre : le lecteur
    // est déjà dedans, il n'est simplement pas modérateur.
    const rang = new ApiError('FORBIDDEN', 'x', 403, { reason: 'MODERATOR_REQUIRED' }, null);
    expect(echecDe(rang).notMember).toBe(false);
    expect(echecDe(rang).rankTooLow).toBe(true);

    /**
     * ON DÉCIDE SUR LE CODE, JAMAIS SUR LE MESSAGE. Le même message, avec un
     * autre code, ne doit rien déclencher — sinon un passage de l'équipe des
     * textes suffirait à ouvrir ou fermer un écran.
     */
    const autre = new ApiError(
      'CONFLICT',
      'Vous n’avez pas accès à cette action.',
      409,
      { reason: 'NOT_A_MEMBER' },
      null,
    );
    expect(echecDe(autre).notMember).toBe(false);
  });
});

// ─── 2. Les conversions, sur les charges réelles ───────────────────────────

describe('les convertisseurs posent toutes les prises que le JSX transcodé lit', () => {
  it('une ligne de sujet porte ses CINQ couleurs, et l’épinglé se distingue', () => {
    const page = topicsResponseSchema.parse(charge('community_topics'));
    const lignes = topicRowsFrom(page.items);
    expect(lignes.length).toBeGreaterThan(0);

    const l = lignes[0];
    /**
     * Ces cinq prises manquaient AU JEU DE DONNÉES PARTAGÉ : le JSX les lit,
     * personne ne les posait, et elles arrivaient à `undefined`. Un sujet
     * épinglé ne se distinguait alors d'aucune façon — alors que la maquette
     * prend soin de le marquer DEUX fois, le fond de ligne et le fond d'icône,
     * parce qu'un fond très clair seul ne se voit pas à contraste réduit.
     */
    for (const prise of ['bg', 'iconBg', 'iconFg', 'stBg', 'stFg'] as const) {
      expect(typeof l?.[prise]).toBe('string');
      expect(l?.[prise]).not.toBe('');
    }

    const epingle = lignes.find((r) => r.pinned);
    const ordinaire = { ...(epingle ?? l), pinned: false };
    expect(epingle).toBeDefined();
    // Les DEUX marques diffèrent, pas une seule.
    expect(epingle?.bg).not.toBe('transparent');
    expect(epingle?.iconBg).not.toBe(ordinaire.iconBg === epingle?.iconBg ? 'x' : epingle?.iconBg);
  });

  it('un sujet épinglé n’est pas dessiné DEUX fois', () => {
    /**
     * Mesuré : le sujet épinglé figure dans `items` ET dans `meta.pinned`. Les
     * concaténer sans précaution l'afficherait deux fois — et le défaut ne se
     * verrait que sur un réseau qui épingle, c'est-à-dire tard.
     */
    const page = topicsResponseSchema.parse(charge('community_topics'));
    const epingles = page.meta.pinned;
    expect(epingles.length).toBeGreaterThan(0);
    expect(page.items.map((t) => t.id)).toContain(epingles[0]?.id);

    const toutes = [
      ...pinnedRowsFrom(epingles),
      ...withoutPinned(topicRowsFrom(page.items), epingles),
    ];
    const ids = toutes.map((r) => r.topicId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('une réponse de sujet s’indente d’après `parentCommentId`, pas d’un rang', () => {
    const sujet = topicDetailResponseSchema.parse(charge('topic_detail'));
    const lignes = repliesFrom(sujet.replies);
    expect(lignes.length).toBeGreaterThan(0);
    // Une racine : pas d'indentation, et on peut lui répondre.
    expect(lignes[0]?.indent).toBe('0px');
    expect(lignes[0]?.canReply).toBe(true);

    // Une réponse de réponse : indentée, et on ne peut PAS lui répondre —
    // un seul niveau est autorisé (`DEPTH_EXCEEDED`).
    const enfant = repliesFrom([
      { ...(sujet.replies[0] as (typeof sujet.replies)[number]), parentCommentId: sujet.replies[0]!.id },
    ]);
    expect(enfant[0]?.indent).toBe('48px');
    expect(enfant[0]?.canReply).toBe(false);
  });

  it('le bouton de découverte dit la VISIBILITÉ, et la couleur porte l’information', () => {
    const liste = communitiesResponseSchema.parse(charge('communities_list'));
    const cartes = discoversFrom(liste.discover.items);
    expect(cartes.length).toBeGreaterThan(0);

    const base = liste.discover.items[0]!;
    // `PUBLIC` non rejoint : « Rejoindre », sur fond vert.
    const publicNonRejoint = discoversFrom([{ ...base, visibility: 'PUBLIC', joined: false }])[0];
    expect(publicNonRejoint?.cta).toBe('Rejoindre');
    expect(publicNonRejoint?.btnBg).toBe('#16785E');

    // `ON_REQUEST` : « Demander », sur fond clair. La différence n'est pas
    // décorative — les deux gestes n'aboutissent pas au même état.
    const surDemande = discoversFrom([{ ...base, visibility: 'ON_REQUEST', joined: false }])[0];
    expect(surDemande?.cta).toBe('Demander');
    expect(surDemande?.btnBg).not.toBe('#16785E');

    // Déjà rejoint : « Ouvrir ». Proposer « Rejoindre » enverrait un appel
    // idempotent qui ne changerait rien, et l'écran mentirait sur l'état.
    const rejoint = discoversFrom([{ ...base, visibility: 'PUBLIC', joined: true }])[0];
    expect(rejoint?.cta).toBe('Ouvrir');
  });

  it('un réseau de ville sans description ne dessine pas « null »', () => {
    const liste = communitiesResponseSchema.parse(charge('communities_list'));
    const ville = liste.mine.find((c) => c.kind === 'CITY');
    expect(ville?.description).toBeNull();

    /**
     * Seuls les champs AFFICHÉS sont examinés. `unread` et `muted` valent bien
     * `null` et `false` — ils n'ont aucune source côté API et sont laissés
     * neutres à dessein — mais ils ne sont pas dessinés comme du texte. Une
     * assertion sur le JSON entier confondrait les deux, et c'est ce qu'elle a
     * fait au premier jet.
     */
    const cartes = myNetsFrom(liste.mine);
    for (const c of cartes) {
      expect(c.name).not.toContain('null');
      expect(c.members).not.toContain('null');
      expect(c.i.length).toBeGreaterThan(0);
      expect(c.bg.startsWith('#')).toBe(true);
    }
    // Et le SINGULIER est respecté : « 1 membre », jamais « 1 membres ».
    const seul = cartes.find((c) => c.members.startsWith('1 '));
    expect(seul?.members).toBe('1 membre');
  });

  it('la couleur d’un réseau est STABLE — le même réseau garde la sienne', () => {
    const liste = communitiesResponseSchema.parse(charge('communities_list'));
    const a = myNetsFrom(liste.mine);
    const b = myNetsFrom(liste.mine);
    expect(a.map((x) => x.bg)).toEqual(b.map((x) => x.bg));
  });

  /**
   * LA RÈGLE DES RÉSULTATS CACHÉS, CÔTÉ ÉCRAN.
   *
   * `voteCount` et `totalVotes` valent `null` tant que le membre n'a pas voté.
   * Un `?? 0` dans le convertisseur transformerait une information RETIRÉE en
   * une information FAUSSE — et afficherait « 0 vote » sur un sondage qui en a
   * peut-être cent.
   */
  it('un sondage non voté ne devient jamais « 0 vote »', () => {
    const page = pollsResponseSchema.parse(charge('community_polls'));
    const p = pollFrom(page.items[0]!);
    expect(p.revealed).toBe(false);
    expect(p.total).toBeNull();
    expect(p.options.every((o) => o.count === null)).toBe(true);
  });

  it('un membre sans nom affiché retombe sur son handle, jamais sur le vide', () => {
    const page = communityMembersResponseSchema.parse(charge('community_members'));
    const m = page.items[0]!;
    expect(m.displayName).toBe('');
    const ligne = inviteeFrom(m, false);
    expect(ligne.name).toBe(`@${m.handle}`);
    expect(ligne.i).not.toBe('·');
    expect(ligne.btn).toBe('Inviter');

    // Et le même membre, déjà invité, bascule ses TROIS prises de bouton.
    const invite = inviteeFrom(m, true);
    expect(invite.btn).toBe('Invité·e');
    expect(invite.btnBg).not.toBe(ligne.btnBg);
    expect(invite.btnFg).not.toBe(ligne.btnFg);
  });
});
