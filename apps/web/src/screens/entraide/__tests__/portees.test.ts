import { describe, expect, it } from 'vitest';
import { porteesDuFil } from '../appels';
import type { CompteursEntraide } from '../data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CINQ PASTILLES DE PORTÉE DU FIL D'ENTRAIDE — ET LEURS DEUX NOMBRES    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ── POURQUOI CE FICHIER EXISTE, ALORS QU'IL N'EXISTAIT PAS ─────────────────
 *
 * `queues-donnees.test.ts` vérifiait que les cadres mobiles de H01 et H04 lisent
 * `{compteurs.ouvertes}` et `{compteurs.pouvezAider}` dans le JSX produit. C'était
 * la bonne garde tant que la rangée était cinq `<span>` morts avec deux nombres
 * interpolés dedans.
 *
 * Le porteur a voulu que ces pastilles FILTRENT (« Intègre donc »), et une
 * pastille qui répond a besoin d'une clé, d'un état actif, d'une destination et
 * d'un geste. La rangée est devenue une boucle sur `PorteeFil`, le nombre est
 * entré dans le LIBELLÉ, et le cadre ne nomme plus `compteurs` du tout — il ne
 * sait même plus qu'il en existe. L'attente du cadre a donc été corrigée vers
 * `{p.libelle}`.
 *
 * ET CORRIGER CETTE ATTENTE SANS ÉCRIRE CE FICHIER AURAIT PERDU LA COUVERTURE AU
 * LIEU DE LA DÉPLACER. On aurait vérifié que le cadre lit une liste, sans que plus
 * personne ne vérifie que le NOMBRE y arrive — c'est-à-dire l'angle mort exact qui
 * laisse une pastille afficher « Toutes · 0 » sur une ville qui a quarante
 * demandes ouvertes. Un test qu'on assouplit pour le faire passer est pire que le
 * test absent : il donne le vert.
 *
 * ── CE QUE CHAQUE CAS GÈLE ────────────────────────────────────────────────
 *
 * MUTATION TÉMOIN pour le premier : remplacer `` `Toutes · ${String(c.ouvertes)}` ``
 * par `'Toutes'` dans `PORTEES_FIL` fait tomber le premier cas, et LUI SEUL.
 */

/** Des compteurs RECONNAISSABLES : trois nombres qu'on ne confond pas entre eux. */
const COMPTEURS: CompteursEntraide = {
  ouvertes: 41,
  pouvezAider: 4,
  parrainages: 7,
  resoluesCeMois: 12,
};

describe('les pastilles de portée du fil d’entraide', () => {
  it('les deux premières portent leur compteur DANS leur libellé', () => {
    const portees = porteesDuFil('toutes', COMPTEURS, () => undefined);

    const toutes = portees.find((p) => p.cle === 'toutes');
    const aider = portees.find((p) => p.cle === 'aider');

    expect(toutes?.libelle).toBe('Toutes · 41');
    expect(aider?.libelle).toBe('Vous pouvez aider · 4');
  });

  /**
   * ZÉRO EST UNE RÉPONSE, PAS UNE ABSENCE.
   *
   * `GET /help/can-help` rend une liste VIDE quand le membre n'a déclaré aucun
   * type d'aide et franchi aucune étape (`meta.reason = 'NO_CRITERIA'`). La
   * pastille doit alors dire « · 0 » et non « Vous pouvez aider » tout court :
   * le nombre est l'information, et le faire disparaître laisserait croire que
   * la pastille n'a pas encore chargé.
   */
  it('un compteur à zéro s’écrit, il ne s’efface pas', () => {
    const portees = porteesDuFil(
      'toutes',
      { ...COMPTEURS, ouvertes: 0, pouvezAider: 0 },
      () => undefined,
    );

    expect(portees.find((p) => p.cle === 'toutes')?.libelle).toBe('Toutes · 0');
    expect(portees.find((p) => p.cle === 'aider')?.libelle).toBe('Vous pouvez aider · 0');
  });

  /**
   * LES TROIS AUTRES N'ONT PAS DE NOMBRE, et ce n'est pas un oubli : la maquette
   * ne leur en dessine aucun. En écrire un demanderait une route qui compte mes
   * demandes, mes réponses et mes parrainages pour la seule décoration d'une
   * pastille — et `compteurs.parrainages` existe, donc la tentation est réelle.
   * Ce cas la gèle.
   */
  it('les trois autres n’affichent aucun nombre', () => {
    const portees = porteesDuFil('toutes', COMPTEURS, () => undefined);

    for (const cle of ['mes-demandes', 'mes-reponses', 'parrainage']) {
      const libelle = porteesDuFil('toutes', COMPTEURS, () => undefined).find(
        (p) => p.cle === cle,
      )?.libelle;
      expect(libelle, cle).toBeDefined();
      expect(libelle, cle).not.toMatch(/\d/);
    }

    expect(portees).toHaveLength(5);
  });

  /**
   * CE QUI BASCULE ET CE QUI NAVIGUE — l'union discriminée, éprouvée.
   *
   * Les deux premières changent la LISTE sans quitter la page (`href: null`,
   * `onChoisir` posé) ; les trois autres sont des LIENS (`href` posé,
   * `onChoisir: null`), vers les adresses que le panneau d'ordinateur emploie
   * déjà. Les confondre donnerait soit un lien mort, soit un bouton qui ne mène
   * nulle part.
   */
  it('deux pastilles basculent, trois naviguent', () => {
    const portees = porteesDuFil('toutes', COMPTEURS, () => undefined);

    const bascules = portees.filter((p) => p.href === null);
    expect(bascules.map((p) => p.cle)).toEqual(['toutes', 'aider']);
    for (const p of bascules) expect(p.onChoisir).toBeTypeOf('function');

    const liens = portees.filter((p) => p.href !== null);
    expect(liens.map((p) => p.href)).toEqual([
      '/entraide/mes-demandes',
      '/entraide/mes-reponses',
      '/parrainage',
    ]);
    for (const p of liens) expect(p.onChoisir).toBeNull();
  });

  /**
   * UNE SEULE PASTILLE ACTIVE À LA FOIS, et c'est la portée demandée.
   *
   * Le défaut que le porteur a signalé ailleurs sur les boutons de vote — « quand
   * on clique non, le bouton oui ne doit plus avoir la couleur primaire » — est
   * le même ici : deux pastilles teintées affirmeraient deux portées. Ce cas
   * l'interdit sur les cinq.
   */
  it('exactement une pastille est active, et c’est celle qu’on demande', () => {
    for (const choisie of ['toutes', 'aider'] as const) {
      const portees = porteesDuFil(choisie, COMPTEURS, () => undefined);
      const actives = portees.filter((p) => p.actif);
      expect(actives.map((p) => p.cle), choisie).toEqual([choisie]);
    }
  });

  /** Le geste rend la CLÉ de sa pastille — sans quoi la page filtrerait au hasard. */
  it('le geste d’une bascule annonce sa propre portée', () => {
    const vues: string[] = [];
    const portees = porteesDuFil('toutes', COMPTEURS, (cle) => {
      vues.push(cle);
    });

    for (const p of portees) p.onChoisir?.();
    expect(vues).toEqual(['toutes', 'aider']);
  });
});
