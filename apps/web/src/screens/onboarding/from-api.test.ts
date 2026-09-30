import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { journeyTemplatesResponseSchema } from '@app/shared';
import { createAnnounce, goalCards, toTemplateChoices } from './from-api';

/**
 * LA CONVERSION DE O03, ÉPROUVÉE SUR LA CHARGE RÉELLE.
 *
 * ── LA RÈGLE QUE CE FICHIER GARDE ───────────────────────────────────────────
 *
 * Le nombre d'étapes annoncé au membre vient du SERVEUR, jamais de la maquette.
 * `01 Accès et Onboarding.dc.html` écrit « Étudier · 12 étapes » ; l'API répond
 * « Étudier en France · 15 étapes », parce que le modèle `STUDIES` a été rechargé
 * en version 3. Les deux se ressemblent assez pour qu'une relecture ne voie rien,
 * et l'écart est une PROMESSE FAUSSE au moment précis où le membre choisit son
 * parcours : on lui annonce douze étapes pour lui en livrer quinze.
 *
 * ── POURQUOI ICI, ALORS QU'UN TEST DE BOUT EN BOUT LE VÉRIFIE DÉJÀ ──────────
 *
 * Parce que celui-là demande une API, une base, une inscription complète et
 * quarante secondes — et qu'il consomme un des DIX envois d'OTP autorisés par
 * heure et par IP. Celui-ci dure quinze millisecondes et n'a besoin de rien. Le
 * premier prouve que la chaîne entière tient ; celui-ci dit, à chaque
 * sauvegarde, où elle se casse.
 *
 * ── LA CHARGE N'EST PAS ÉCRITE À LA MAIN ────────────────────────────────────
 *
 * `journey_templates.json` est la réponse OCTET POUR OCTET de `GET
 * /journey-templates` sur l'API qui tournait. Elle est relue ici À TRAVERS son
 * schéma, exactement comme le socle le fera à l'exécution : un test qui
 * contournerait le schéma pourrait passer sur une charge que l'application
 * refuserait.
 */

const CHARGE = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures/journey_templates.json',
);

const reponse = journeyTemplatesResponseSchema.parse(
  JSON.parse(readFileSync(CHARGE, 'utf8')) as unknown,
);

describe('les modèles de parcours, tels que O03 les montre', () => {
  it('prend le nombre d’étapes de la VERSION, et non de la maquette', () => {
    const choix = toTemplateChoices(reponse);

    expect(choix.length).toBe(reponse.items.length);
    for (const [i, t] of choix.entries()) {
      // Aucun nombre n'est écrit en dur : le modèle peut passer en version 4
      // demain et ce test doit continuer de passer. Il éprouve la PROVENANCE.
      expect(t.stepCount).toBe(reponse.items[i]?.version.stepCount);
    }
  });

  it('affiche le nom du SERVEUR, pas celui dessiné', () => {
    const cartes = goalCards(toTemplateChoices(reponse));
    expect(cartes[0]?.title).toBe(reponse.items[0]?.nameFr);
    // La maquette écrit « Étudier » ; l'API « Étudier en France ». Le test ne fige
    // ni l'un ni l'autre — il exige seulement que le titre vienne de la réponse.
    expect(cartes.map((c) => c.title)).toEqual(reponse.items.map((t) => t.nameFr));
  });

  it('écrit le nombre d’étapes tel que la réponse le donne', () => {
    const cartes = goalCards(toTemplateChoices(reponse));
    const attendu = reponse.items.map((t) =>
      t.version.stepCount === 1 ? '1 étape' : `${t.version.stepCount} étapes`,
    );
    expect(cartes.map((c) => c.steps)).toEqual(attendu);
  });

  it('annonce le parcours qui sera VRAIMENT créé', () => {
    const premier = reponse.items[0];
    const phrase = createAnnounce(toTemplateChoices(reponse));
    expect(phrase).toContain(premier?.nameFr ?? '');
    expect(phrase).toContain(String(premier?.version.stepCount));
  });

  it('apparie l’icône sur le CODE, et survit à un changement d’ordre', () => {
    const choix = toTemplateChoices(reponse);
    const cartes = goalCards(choix);
    /**
     * L'ordre d'une liste d'API n'est pas un contrat. Un appariement positionnel
     * mettrait l'icône du diplôme sur « Régulariser ma situation » le jour où
     * `journey_templates.sort_order` change. On inverse donc la liste et on exige
     * que chaque carte garde SON tracé.
     */
    const inverses = goalCards([...choix].reverse());
    for (const [i, carte] of cartes.entries()) {
      const miroir = inverses[inverses.length - 1 - i];
      expect(miroir?.icon).toBe(carte.icon);
      expect(miroir?.title).toBe(carte.title);
    }
  });

  it('accorde le singulier — « 1 étape », jamais « 1 étapes »', () => {
    const cartes = goalCards([{ id: 'x', code: 'STUDIES', nameFr: 'Un seul pas', stepCount: 1 }]);
    expect(cartes[0]?.steps).toBe('1 étape');
    expect(
      createAnnounce([{ id: 'x', code: 'WORK', nameFr: 'Un seul pas', stepCount: 1 }]),
    ).toContain('(1 étape)');
  });
});

describe('avant que la liste arrive', () => {
  it('montre les quatre titres de la maquette, SANS nombre d’étapes', () => {
    const cartes = goalCards([]);

    expect(cartes).toHaveLength(4);
    expect(cartes[0]?.title).toBe('Étudier');
    /**
     * LA LIGNE QUI COMPTE. Reprendre « 12 étapes » de la maquette serait la faute
     * exacte qu'on corrige, et elle serait invisible : le nombre est plausible, la
     * page est complète, et seul le membre s'en apercevrait en arrivant sur un
     * parcours qui en compte quinze. Un sous-titre vide n'a aucune conséquence de
     * mise en page — c'est un simple texte gris dans les deux cadres.
     */
    for (const carte of cartes) expect(carte.steps).toBe('');
  });

  it('dessine quand même une icône sur chaque carte', () => {
    // Un `<path d="">` vide laisserait une pastille verte sans dessin. Le piège du
    // sélecteur vide, en plus petit.
    for (const carte of goalCards([])) expect(carte.icon.length).toBeGreaterThan(10);
  });

  it('annonce un parcours sans le chiffrer', () => {
    const phrase = createAnnounce([]);
    expect(phrase).toContain('parcours');
    // Promettre un nombre qu'on ne connaît pas est la faute qu'on corrige.
    expect(phrase).not.toMatch(/\d/);
  });

  it('met la première carte en avant, comme la maquette la dessine', () => {
    expect(goalCards([]).map((c) => c.on)).toEqual([true, false, false, false]);
    expect(goalCards(toTemplateChoices(reponse))[0]?.on).toBe(true);
  });
});

describe('les témoins — ce qui ne décide rien reste VERT', () => {
  it('un modèle de code inconnu reçoit un tracé, sans faire tomber les autres', () => {
    /**
     * La maquette n'en dessine que quatre. Un cinquième modèle un jour ne doit ni
     * faire tomber ce fichier ni laisser une carte sans dessin : il reçoit le tracé
     * de document, le plus neutre des quatre.
     */
    const cartes = goalCards([
      ...toTemplateChoices(reponse),
      { id: 'z', code: 'CODE_QUI_N_EXISTE_PAS', nameFr: 'Un cinquième', stepCount: 3 },
    ]);
    expect(cartes).toHaveLength(reponse.items.length + 1);
    expect(cartes.at(-1)?.icon.length).toBeGreaterThan(10);
    /**
     * PAS D'ASSERTION SUR LE NOMBRE D'ÉTAPES ICI, et c'est la mutation qui l'a
     * appris : ce témoin en portait une, et il rougissait donc AVEC la règle
     * lorsqu'on remettait le nombre de la maquette. Un témoin qui tombe sur la
     * mutation qu'il doit ignorer ne témoigne de rien — il double la règle au lieu
     * de la cerner. Le nombre est éprouvé plus haut, à sa place.
     */
    expect(cartes.at(-1)?.title).toBe('Un cinquième');
  });

  it('le nom du modèle ne change rien à son nombre d’étapes', () => {
    const renomme = toTemplateChoices(reponse).map((t) => ({ ...t, nameFr: 'Autre nom' }));
    expect(goalCards(renomme).map((c) => c.steps)).toEqual(
      goalCards(toTemplateChoices(reponse)).map((c) => c.steps),
    );
  });
});
