import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { extractFrame, extractSection } from '../dc-to-jsx.mjs';
import { applyData } from '../generate-screens.mjs';
import { screens } from '../screens/05-entraide.mjs';

/**
 * ─── LE GARDE-FOU DE `donnees`, ÉPROUVÉ SUR LES OCTETS RÉELS DE LA MAQUETTE ──
 *
 * Les liaisons de `05 Entraide` reposent toutes sur une promesse : si un designer
 * RETIRE ou DÉDOUBLE un littéral lié, la génération S'ARRÊTE en le nommant, au lieu
 * de produire un écran où la donnée ne s'affiche plus. Cette promesse ne se démontre
 * qu'en retirant vraiment un fragment et en vérifiant que la génération refuse.
 *
 * Or `docs/` ne se modifie pas — le porteur l'a interdit, et `git status docs/` doit
 * rester vide. La mutation se fait donc sur une COPIE EN MÉMOIRE du fichier, ce qui
 * est exactement pourquoi `generate-screens.mjs` exporte `applyData`.
 *
 * ── CE QUE CE FICHIER AJOUTE À CE QUE LE GÉNÉRATEUR FAIT DÉJÀ ───────────────
 *
 * Le générateur applique les liaisons à chaque exécution : une déclaration fausse
 * casse déjà `pnpm guardrails`. Ce qu'il NE fait pas, c'est éprouver le REFUS. Un
 * garde-fou qu'on n'a jamais vu se déclencher est un garde-fou supposé — et la
 * consigne de ce lot est formelle : un test qui ne meurt pas quand on casse la règle
 * qu'il prétend garder est un test creux. Ici c'est le contraire qu'on éprouve : que
 * le MÉCANISME meurt quand la maquette casse.
 *
 * ATTENTION : importer `generate-screens.mjs` DÉCLENCHE la génération, qui vit au
 * niveau du module. C'est sans danger — elle est idempotente, vérifiée par empreinte
 * — mais l'appelant doit s'attendre à son journal.
 */

const ROOT = resolve(import.meta.dirname, '..', '..');
const FICHIER = 'docs/template/05 Entraide.dc.html';
const html = readFileSync(resolve(ROOT, FICHIER), 'utf8');

/** Le HTML d'un cadre, et les liaisons qui lui sont déclarées. */
function cadre(section, nom) {
  const ecran = screens.find((s) => s.section === section);
  assert.ok(ecran !== undefined, `écran ${section} introuvable dans la déclaration`);
  const frame = ecran.frames.find((f) => f.name === nom);
  assert.ok(frame !== undefined, `cadre ${nom} introuvable sur ${section}`);
  const inner = extractFrame(extractSection(html, section), frame.width).inner;
  const liens = (ecran.donnees ?? []).filter(
    (d) => d.frames === undefined || d.frames.includes(nom),
  );
  return { inner, liens, ecran };
}

const cas = [];
const verifier = (nom, fn) => {
  try {
    fn();
    cas.push({ nom, ok: true });
  } catch (e) {
    cas.push({ nom, ok: false, message: e.message });
  }
};

// ── 1. La référence : les liaisons déclarées s'appliquent sur la vraie maquette ─
verifier('les liaisons de H01 Desktop s’appliquent sur la maquette réelle', () => {
  const { inner, liens } = cadre('H01', 'Desktop');
  const { applied } = applyData(inner, liens, 'H01', 'Desktop');
  assert.equal(applied.length, liens.length, 'toutes les liaisons doivent s’appliquer');
  assert.ok(liens.length >= 8, `H01 Desktop déclare ${liens.length} liaisons, on en attend au moins 8`);
});

verifier('les liaisons de H02 Desktop s’appliquent sur la maquette réelle', () => {
  const { inner, liens } = cadre('H02', 'Desktop');
  const { applied } = applyData(inner, liens, 'H02', 'Desktop');
  assert.equal(applied.length, liens.length);
});

verifier('les liaisons de H06 Desktop s’appliquent sur la maquette réelle', () => {
  const { inner, liens } = cadre('H06', 'Desktop');
  const { applied } = applyData(inner, liens, 'H06', 'Desktop');
  assert.equal(applied.length, liens.length);
});

// ── 2. LE PREMIER CONTRÔLE : un littéral RETIRÉ arrête la génération ───────────
verifier('un littéral RETIRÉ de la maquette fait ÉCHOUER la génération', () => {
  const { inner, liens } = cadre('H01', 'Desktop');
  // « Amina » est le prénom de la barre haute. Un designer qui le remplace par un
  // autre mot ne doit PAS produire un écran où le prénom cesse d’être une donnée.
  const mute = inner.replace('>Amina<', '>Fatou<');
  assert.notEqual(mute, inner, 'la mutation n’a rien changé : le test ne prouverait rien');
  assert.throws(
    () => applyData(mute, liens, 'H01', 'Desktop'),
    /figure 0 fois dans ce cadre, et la déclaration en attend 1/,
    'la génération a ACCEPTÉ une maquette où le littéral lié a disparu',
  );
});

verifier('un littéral DÉDOUBLÉ fait ÉCHOUER la génération', () => {
  const { inner, liens } = cadre('H01', 'Desktop');
  // Deux avatars dans le rail : le compte ne tombe plus juste, et c’est tout
  // l’intérêt — on ne produit pas neuf écrans justes et un faux.
  const mute = inner.replace('>AD<', '>AD<>AD<');
  assert.notEqual(mute, inner);
  assert.throws(
    () => applyData(mute, liens, 'H01', 'Desktop'),
    /figure 2 fois dans ce cadre, et la déclaration en attend 1/,
  );
});

// ── 3. LE TROISIÈME CONTRÔLE : une couleur ASSOMBRIE est refusée ──────────────
//
// C’est la règle « ne pas assombrir les couleurs » rendue EXÉCUTABLE. Huit paires
// de ce projet passent sous le seuil AA, et c’est une décision assumée du porteur ;
// le garde-fou de contraste reste à 16/24. Une liaison qui « corrigerait » une
// teinte au passage ne peut donc pas passer.
verifier('une liaison qui ASSOMBRIT une couleur de la maquette est REFUSÉE', () => {
  const { inner } = cadre('H06', 'Desktop');
  const lien = {
    noeud:
      '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Disponible</span>',
    // `#0F5C48` devenu `#0A4234` : plus contrasté, et DÉFENDU.
    devient:
      '<span style="background:#E3F0EB;color:#0A4234;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">{{ parrain.dispo.libelle }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'liaison volontairement fautive, pour éprouver le refus',
  };
  assert.throws(
    () => applyData(inner, [lien], 'H06', 'Desktop'),
    /ajoute du dessin que la maquette n’écrit pas là/,
    'une couleur assombrie a été ACCEPTÉE : la règle n’est plus exécutable',
  );
});

// ── 4. LE QUATRIÈME CONTRÔLE : une « donnée » sans interpolation ne lie rien ──
verifier('une liaison SANS interpolation est REFUSÉE', () => {
  const { inner } = cadre('H01', 'Desktop');
  const lien = {
    noeud: '>Amina<',
    devient: '>Amina<',
    fois: 1,
    frames: ['Desktop'],
    why: 'liaison volontairement fautive',
  };
  assert.throws(
    () => applyData(inner, [lien], 'H01', 'Desktop'),
    /ne porte aucune interpolation/,
    'une liaison qui recopie le littéral a été acceptée : le journal annoncerait une donnée inexistante',
  );
});

// ── 5. UN MOT INVENTÉ est refusé ──────────────────────────────────────────────
verifier('une liaison qui AJOUTE un mot que la maquette n’écrit pas est REFUSÉE', () => {
  const { inner } = cadre('H01', 'Desktop');
  const lien = {
    noeud: '>4 guides utiles · 2 parrainages · 6 événements<',
    devient: '>{{ reputation.guides }} guides très utiles · {{ reputation.parrainages }} parrainages<',
    fois: 1,
    frames: ['Desktop'],
    why: 'liaison volontairement fautive',
  };
  assert.throws(
    () => applyData(inner, [lien], 'H01', 'Desktop'),
    /ajoute du dessin que la maquette n’écrit pas là/,
  );
});

// ── 6. LA MAQUETTE N'A PAS ÉTÉ TOUCHÉE ───────────────────────────────────────
verifier('la maquette sur le disque est inchangée après toutes ces mutations', () => {
  const relu = readFileSync(resolve(ROOT, FICHIER), 'utf8');
  assert.equal(relu, html, 'docs/ a été modifié : les mutations doivent rester EN MÉMOIRE');
});

// ── 7. AUCUN NUMÉRO DE TÉLÉPHONE DANS LA MAQUETTE ────────────────────────────
//
// Le fait sur lequel repose tout le raisonnement de ce lot : `05 Entraide` n’écrit
// AUCUN numéro, masqué ou non. C’est pour cela que la règle dure 01 §2.1 ne tient
// pas par le dessin ici, contrairement à K04 — et c’est donc un fait à FIGER, pas à
// répéter de mémoire.
verifier('les vingt cadres de 05 Entraide n’écrivent AUCUN numéro de téléphone', () => {
  for (const ecran of screens) {
    for (const frame of ecran.frames) {
      const inner = extractFrame(extractSection(html, ecran.section), frame.width).inner;
      const trouve = /\+\d{2,}[\d\s.•·-]{6,}/.exec(inner);
      assert.equal(
        trouve,
        null,
        `${ecran.section} ${frame.name} écrit « ${trouve?.[0]} » : la règle 01 §2.1 tiendrait par le dessin, et le raisonnement du lot est à revoir`,
      );
    }
  }
});

// ─── Verdict ────────────────────────────────────────────────────────────────
console.log('\n─── tools/__tests__/entraide-donnees.test.mjs ───');
let echecs = 0;
for (const c of cas) {
  console.log(`  ${c.ok ? '✓' : '✗'} ${c.nom}`);
  if (!c.ok) {
    console.log(`      ${c.message}`);
    echecs += 1;
  }
}
console.log(`  ${cas.length - echecs}/${cas.length} vert(s)`);
process.exit(echecs === 0 ? 0 : 1);
