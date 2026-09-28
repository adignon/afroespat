import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibilité — §10.6 : « contrôle automatisé (axe-core) sur chaque page
 * principale ». Exigence de la définition de « terminé » (§12.2) : une
 * fonctionnalité n'est pas finie tant qu'une violation subsiste.
 *
 * axe-core ne remplace pas une relecture humaine : il attrape le contraste, les
 * noms accessibles manquants, la structure de titres. Il ne dit rien de la
 * pertinence d'un libellé. C'est un plancher, pas un plafond.
 */

const PAGES = [
  { path: '/accueil', name: 'A01 Fil d’actualité' },

  // Lot 2 — les dix-sept sections restantes de « 03 Accueil v2 ». Une route par
  // écran ; les variantes d'état (`?onglet=`, `?vue=`) sont couvertes par celles qui
  // changent réellement de balisage, pas par les vingt combinaisons possibles.
  { path: '/publications/repas-partage', name: 'A02 Publication' },
  { path: '/guides', name: 'A03 Guides — liste' },
  { path: '/guides/visale-sans-cdi', name: 'A04 Guide — lecture' },
  { path: '/guides/visale-sans-cdi?vue=auteur', name: 'A04 Guide — vue auteur' },
  { path: '/guides/nouveau', name: 'A05 Guide — éditeur' },
  { path: '/guides/visale-sans-cdi/propositions', name: 'A06 Propositions reçues' },
  { path: '/guides/visale-sans-cdi/corriger', name: 'A06 Proposer une correction' },
  { path: '/reseaux', name: 'A07 Réseaux' },
  { path: '/reseaux/beninois-en-france', name: 'A08 Réseau — Sujets' },
  { path: '/reseaux/beninois-en-france?onglet=fil', name: 'A08T Réseau — Fil' },
  { path: '/reseaux/beninois-en-france?onglet=membres', name: 'A08T Réseau — Membres' },
  { path: '/reseaux/beninois-en-france?onglet=gerer&vue=proprietaire', name: 'A08T Gérer le réseau' },
  { path: '/reseaux/beninois-en-france/sujets/passeport', name: 'A09 Sujet' },
  { path: '/reseaux/nouveau', name: 'A10 Créer un réseau' },
  { path: '/villes', name: 'A11 Villes et Membres' },
  { path: '/villes/lyon', name: 'A12 Fiche ville' },
  { path: '/villes/lyon?onglet=produits', name: 'A12T Ville — Produits du pays' },
  { path: '/stories/visale', name: 'A13 Story — lecture' },
  { path: '/stories/nouvelle', name: 'A14 Story — création' },
  // Entraide (05 Entraide.dc.html) — H01 à H10.
  { path: '/entraide', name: 'H01 Fil d’entraide' },
  { path: '/entraide/abc', name: 'H02 Demande — détail' },
  { path: '/entraide/nouveau', name: 'H03 Publier une demande' },
  { path: '/entraide/aider', name: 'H04 Vous pouvez aider' },
  { path: '/entraide/mes-demandes', name: 'H09 Mes demandes' },
  { path: '/entraide/mes-reponses', name: 'H10 Mes réponses' },
  { path: '/parrainage', name: 'H05 Parrains — liste' },
  { path: '/parrainage/amina', name: 'H06 Parrain — fiche' },
  { path: '/parrainage/mes-parrainages', name: 'H07 Mes parrainages' },
  { path: '/parrainage/devenir', name: 'H08 Devenir parrain' },
  // Agenda (07 Agenda.dc.html) — E01 à E04.
  { path: '/agenda', name: 'E01 Agenda' },
  { path: '/agenda/42', name: 'E02 Événement' },
  { path: '/agenda/nouveau', name: 'E03 Créer un événement' },
  { path: '/agenda/42/presence', name: 'E04 Présence' },
  /**
   * Les douze routes du module Parcours (`docs/specs/T5-pages-et-prompts.md` §5).
   *
   * §10.6 demande le contrôle « sur chaque page principale » : les y ajouter
   * une par une est la seule lecture honnête de cette phrase. Elles passent
   * toutes, et deux adaptations du générateur y sont pour beaucoup — le `<h1>`
   * promu depuis le titre visible (la maquette n'écrit aucun `<h2>` : sans cela
   * les douze pages arrivaient sans aucun titre) et les fermetures de modale
   * promues en vrais `<button>` avec leur nom accessible.
   */
  { path: '/parcours', name: 'J11 Mes parcours' },
  { path: '/parcours/nouveau', name: 'J02 Créer un parcours' },
  { path: '/parcours/1', name: 'J01 Parcours' },
  { path: '/parcours/1/etapes/7', name: 'J01S Étape en cours' },
  { path: '/parcours/1/discussion', name: 'J01D Discussion' },
  { path: '/parcours/1/equipe', name: 'J05 Équipe' },
  { path: '/parcours/1/documents', name: 'J06 Checklist de documents' },
  { path: '/parcours/1/historique', name: 'J07 Historique' },
  { path: '/parcours/1/reglages', name: 'J08 Réglages' },
  { path: '/parcours/1/abouti', name: 'J10 Fin de parcours' },
  { path: '/parcours/publics', name: 'J09 Parcours publics' },
  { path: '/parcours/publics/1', name: 'J09 Vue publique d’un parcours' },
] as const;

for (const { path, name } of PAGES) {
  test(`${name} ne présente aucune violation d’accessibilité`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      // AA est la cible (§10.6). AAA n'est pas exigé et produirait du bruit.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // ÉCART ASSUMÉ — le contraste est exclu ICI, et ici seulement.
      //
      // Le porteur a choisi de conserver les couleurs de la maquette telles
      // quelles ; trois jetons n'atteignent pas le seuil AA. La liste exacte, avec
      // les ratios mesurés, vit dans packages/config/guardrails/check-contrast.mjs
      // et s'affiche à CHAQUE build : l'écart reste sous les yeux plutôt que de
      // disparaître. Voir docs/decisions.md.
      //
      // Tout le reste d'axe-core continue de bloquer : noms accessibles, rôles,
      // ordre des titres, libellés de formulaire, attributs ARIA.
      .disableRules(['color-contrast'])
      .analyze();

    // Message lisible : la liste brute d'axe est illisible en sortie de CI.
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact ?? 'n/a'}) — ${v.help}\n    ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n    ')}`,
    );

    expect(summary, `Violations sur ${path} :\n${summary.join('\n')}`).toEqual([]);
  });
}
