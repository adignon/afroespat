import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminDashboardResponseSchema, type AdminDashboardResponse } from '@app/shared';
import { vueD02 } from './appels';

/**
 * D02 — LE TABLEAU DE BORD, ÉPROUVÉ SUR LA CHARGE RELEVÉE.
 *
 * La fixture est `GET /v1/admin/dashboard` prise OCTET POUR OCTET sur l'API qui
 * tournait, avec une vraie session d'équipe : mot de passe argon2id puis TOTP, le
 * parcours réel de 15 §2.1. Elle est PARSÉE par le schéma partagé avant d'entrer
 * dans `vueD02`, et l'ordre compte — c'est ce qui fait que ce fichier éprouve la
 * chaîne complète (charge réelle → schéma partagé → prises du cadre) plutôt que la
 * dérivation seule contre un objet façonné à sa mesure.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER GARDE, ET QUE RIEN D'AUTRE NE GARDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois défauts, dont deux sont des RÈGLES DURES du module, et aucun ne serait vu
 * par `tsc`, par le lint, ni par la génération d'écrans — dans les trois cas le
 * JSX compile et l'écran s'affiche :
 *
 *   1. UN NOMBRE INVENTÉ. Une mesure absente rendue comme « 0 » donne un tableau
 *      de bord parfaitement crédible et faux. Zéro est un FAIT, pas une absence.
 *   2. UNE TRANCHE VIDE CONFONDUE AVEC UN NOM FAUX. L'inverse du précédent : lever
 *      sur `COMPLETED` absent arrêterait le tableau de bord d'une plateforme jeune
 *      dont presque tous les seaux sont vides. Les deux doivent se distinguer.
 *   3. LE BANDEAU D'ALERTES ENTAMÉ. `GET /admin/dashboard` n'en rend aucun
 *      morceau ; un champ `alerts` greffé doit ARRÊTER l'écran, pas être dépouillé
 *      en silence.
 *
 * Chaque cas a été éprouvé en CASSANT la règle qu'il garde — les mutations sont
 * nommées dans le rapport, avec leur verdict. Un témoin vert n'est pas un succès,
 * c'est une question.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));

/** La charge relevée, passée par le schéma partagé — jamais contournée. */
const reelle = (): AdminDashboardResponse =>
  adminDashboardResponseSchema.parse(charge('admin_dashboard'));

/** Une copie profonde de la charge réelle, pour en retirer une pièce. */
const sansMesure = (bloc: string, metric: string): AdminDashboardResponse => {
  const r = reelle();
  return {
    blocks: {
      ...r.blocks,
      [bloc]: (r.blocks[bloc] ?? []).filter((p) => p.metric !== metric),
    },
  };
};

describe('D02 — les cinq cartes servies', () => {
  it('dérive les cinq cartes de la charge RELEVÉE, mises en forme', () => {
    const vue = vueD02(reelle());

    // Les valeurs sont celles de la charge : 1 978 inscrits, 0 actif sur 30 j.
    // L'espace est l'INSÉCABLE FINE de `fr-FR` (U+202F), pas une espace ordinaire
    // — l'écrire en clair ici ferait échouer le test pour la mauvaise raison.
    expect(vue.membres.inscrits).toBe('1 978');
    expect(vue.membres.actifs30j).toBe('0');

    // L2 = 46 sur 1 618 + 314 + 46 = 1 978 → 2 %.
    expect(vue.membres.niveau2).toBe('2 %');

    // `journeys.by_status` n'arrive qu'avec ACTIVE = 337 : les trois autres
    // tranches sont des seaux VIDES, donc zéro, et « Créés » est leur somme.
    expect(vue.parcours.actifs).toBe('337');
    expect(vue.parcours.crees).toBe('337');
    expect(vue.parcours.aboutis).toBe('0');
    expect(vue.parcours.enPause).toBe('0');

    expect(vue.guides.publies).toBe('2');
    expect(vue.services.fichesPro).toBe('1');
  });

  /**
   * L'ESPACE DES MILLIERS EST L'INSÉCABLE FINE, pas une espace ordinaire.
   *
   * Écrite à la main, elle produit une coupure de ligne au milieu d'un nombre —
   * « 1 » en fin de ligne et « 978 » à la suivante, sur un tableau de bord. C'est
   * `Intl` qui la pose, et ce test fige le fait plutôt que l'intention.
   */
  it('met les milliers dans l’espace insécable fine de `fr-FR`', () => {
    expect(vueD02(reelle()).membres.inscrits).toBe('1 978');
    expect(vueD02(reelle()).membres.inscrits).not.toContain(' ');
  });

  /**
   * LE DÉLAI EST SERVI EN MINUTES et la maquette écrit des heures.
   *
   * Sous l'heure on garde les minutes : « 0 h » dirait « immédiat » là où le vrai
   * délai est de quarante minutes.
   */
  it('rend le délai médian en minutes sous l’heure, en heures au-dessus', () => {
    expect(vueD02(reelle()).entraide.delaiMedian).toBe('0 min');

    const r = reelle();
    const entraide = (r.blocks.entraide ?? []).map((p) =>
      p.metric === 'help.first_response_median_minutes' ? { ...p, value: 1140 } : p,
    );
    expect(vueD02({ blocks: { ...r.blocks, entraide } }).entraide.delaiMedian).toBe('19 h');
  });
});

describe('D02 — [RÈGLE DURE] zéro est un fait, pas une absence', () => {
  /**
   * LE DÉFAUT RÉEL : une mesure renommée côté serveur, ou mal orthographiée ici.
   * Rendue comme « 0 », elle donne « 0 inscrit » sur un tableau de bord d'allure
   * normale, et personne ne regarde un tableau de bord pour vérifier qu'il est
   * vrai. On REFUSE, en nommant la mesure et en listant ce que l'API a envoyé.
   */
  it('REFUSE une mesure globale absente, au lieu d’afficher zéro', () => {
    expect(() => vueD02(sansMesure('membres', 'members.registered'))).toThrow(
      /members\.registered/,
    );
    expect(() => vueD02(sansMesure('membres', 'members.registered'))).toThrow(
      /pas une absence/,
    );
  });

  it('REFUSE un bloc attendu absent, en listant les blocs reçus', () => {
    const r = reelle();
    const { parcours: _retire, ...reste } = r.blocks;
    expect(() => vueD02({ blocks: reste })).toThrow(/Le bloc « parcours » manque/);
  });

  /**
   * L'AUTRE SENS, et c'est le cas qui distingue ce test d'un simple « tout
   * refuser » : une MESURE VENTILÉE dont le NOM est introuvable est un désaccord
   * de contrat, tandis qu'une TRANCHE absente est un seau vide, donc un fait.
   *
   * Sans cette distinction, un `?? 0` posé partout aurait effacé le premier
   * défaut, et un `throw` posé partout aurait arrêté le tableau de bord sur une
   * plateforme jeune. Les deux assertions se tiennent par les épaules.
   */
  it('REFUSE un nom de mesure ventilée introuvable, mais ACCEPTE une tranche vide', () => {
    /**
     * Le nom disparaît entièrement → désaccord de contrat.
     *
     * La casse du message n'est pas fixée ici : `sommeDesTranches` (qui calcule
     * « Créés ») garde le nom avant `tranche`, et les deux formulent le refus à
     * leur façon. Ce qui compte et qui est figé, c'est que le refus NOMME la
     * mesure et dise qu'elle ne figure sur aucune ligne.
     */
    expect(() => vueD02(sansMesure('parcours', 'journeys.by_status'))).toThrow(
      /journeys\.by_status/,
    );
    expect(() => vueD02(sansMesure('parcours', 'journeys.by_status'))).toThrow(
      /ne figure sur aucune ligne/i,
    );

    // Le nom est là, la tranche `COMPLETED` non → zéro, sans lever.
    expect(vueD02(reelle()).parcours.aboutis).toBe('0');
  });

  /**
   * UNE PART N'EST PAS RAPPORTÉE À UN TOTAL PRIS AILLEURS.
   *
   * « Niveau 2 » se rapporte à la somme des tranches de `members.by_level`, pas à
   * `members.registered` : les deux populations diffèrent, et sur la charge
   * relevée elles coïncident par hasard (1 978 des deux côtés). Ce test écarte
   * volontairement les deux pour que la coïncidence ne valide pas le mauvais
   * dénominateur.
   */
  it('rapporte « Niveau 2 » à la somme des NIVEAUX, pas aux inscrits', () => {
    const r = reelle();
    const membres = (r.blocks.membres ?? []).map((p) =>
      p.metric === 'members.registered' ? { ...p, value: 100_000 } : p,
    );
    // Si le dénominateur était `members.registered`, 46/100 000 donnerait « 0 % ».
    expect(vueD02({ blocks: { ...r.blocks, membres } }).membres.niveau2).toBe('2 %');
  });

  /** Un dénominateur à zéro est un état normal le premier jour, pas une erreur. */
  it('rend « 0 % » et non « NaN % » quand aucun niveau n’est servi', () => {
    const r = reelle();
    const membres = (r.blocks.membres ?? []).map((p) =>
      p.metric === 'members.by_level' ? { ...p, value: 0 } : p,
    );
    expect(vueD02({ blocks: { ...r.blocks, membres } }).membres.niveau2).toBe('0 %');
  });
});

describe('D02 — [RÈGLE DURE] le bandeau d’alertes n’est pas entamé', () => {
  /**
   * LE MUR, RENDU EXÉCUTABLE.
   *
   * Le bandeau « SLA dépassé · Justificatifs pro · Villes à activer » n'est livré
   * à aucun tiers : `GET /admin/dashboard` ne rend que des blocs de points de
   * mesure. Le jour où quelqu'un greffe un `alerts` partiel sur la réponse,
   * `.strict()` ARRÊTE l'écran au lieu de le dépouiller en silence — et c'est le
   * mécanisme même par lequel `isPilot` a pu être servi et ignoré des semaines.
   *
   * Ce test est la raison pour laquelle le `.strict()` du schéma ne doit pas être
   * retiré : sans lui, zod jette `alerts` sans un mot et l'écran afficherait un
   * bandeau figé à côté de vraies alertes disponibles.
   */
  it('un champ `alerts` greffé sur la réponse ARRÊTE la validation', () => {
    const avecAlertes = { ...(charge('admin_dashboard') as object), alerts: [{ kind: 'SLA' }] };
    expect(() => adminDashboardResponseSchema.parse(avecAlertes)).toThrow();
  });

  /** La charge relevée n'en porte AUCUN morceau : le mur est un fait, pas un choix. */
  it('la charge relevée ne contient aucune alerte, sous aucun nom', () => {
    const brut = JSON.stringify(charge('admin_dashboard'));
    for (const mot of ['alert', 'alerte', 'sla_due', 'villes_a_activer']) {
      expect(brut.toLowerCase()).not.toContain(mot);
    }
  });

  /**
   * ET LE MRR N'EST TOUJOURS PAS POSÉ. `blocks.revenus` est relevé VIDE.
   *
   * Ce test n'est pas une curiosité : il fige la raison pour laquelle le bloc
   * REVENUS de D02 reste dessiné. Le jour où le serveur se mettra à le remplir, il
   * ROUGIRA — et ce sera le signal d'aller brancher la carte, au lieu de la
   * laisser figée alors que la donnée est devenue disponible.
   */
  it('`blocks.revenus` est VIDE — un MRR faux est pire qu’un MRR absent', () => {
    expect(reelle().blocks.revenus).toEqual([]);
  });
});
