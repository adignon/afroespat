import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ─── LES DERNIERS CADRES BRANCHÉS, ÉPROUVÉS SUR LE JSX RÉELLEMENT PRODUIT ───
 *
 * CE QUE CE FICHIER GARDE, et pourquoi il ne pouvait pas être écrit ailleurs.
 *
 * Une liaison `donnees` se déclare dans `tools/screens/*.mjs`, et le journal du
 * générateur ANNONCE chaque liaison qu'il applique. Ce journal n'est PAS une
 * preuve : un trou mesuré du mécanisme le montre — une interpolation posée là où
 * va une déclaration entière de style (`style="…;{{ m.bord }}"`) passe les quatre
 * contrôles, est annoncée au journal, et le JSX NE LA PORTE PAS. Elle est jetée en
 * silence par le transcodeur.
 *
 * La seule épreuve qui vaut est donc celle du FICHIER PRODUIT, et c'est ce que ce
 * fichier fait : il lit les `.generated.tsx` sur le disque et vérifie ce qu'ils
 * contiennent vraiment.
 *
 * ── TROIS FORMES DE TÉMOIN CREUX, ÉVITÉES EXPRÈS ────────────────────────────
 *
 * Trois agents ont trouvé un trou dans leurs propres témoins, et les trois formes
 * sont connues. Chacune est écartée ici par construction :
 *
 *   1. UN TEST QUI AFFIRME PAR L'ABSENCE ne vérifie aucune valeur. Chaque cas
 *      ci-dessous affirme donc les DEUX sens : le littéral de la maquette a
 *      DISPARU du fichier, ET l'expression qui l'a remplacé y EST. Un cadre que la
 *      génération aurait cessé de produire ferait échouer la lecture du fichier ;
 *      un cadre produit sans sa liaison échouerait sur le second sens.
 *   2. UN TEST QUE LE SOCLE SAUVE — la reprise de session retirée qui laissait
 *      43 tests verts parce que le transport rejoue sur `401`. Rien ici ne touche
 *      au réseau : ce sont des fichiers, lus sur le disque, et aucun rejeu ne peut
 *      les remplir à la place du générateur.
 *   3. UN `.passthrough()` AJOUTÉ AVANT LE `.strict()` EXISTANT, qui gagne. Aucun
 *      schéma n'est composé ici : on ne valide pas une forme, on lit un texte.
 *
 * ── COMMENT CES CAS ONT ÉTÉ ÉPROUVÉS ───────────────────────────────────────
 *
 * Chaque assertion a été MUTÉE puis régénérée, et le verdict est au rapport. La
 * mutation type : retirer la clé `frames: ['Mobile']` d'une liaison, ou remettre
 * le littéral de la maquette dans `devient`. Le second cas est d'ailleurs refusé
 * par le quatrième contrôle du générateur — « une donnée doit VRAIMENT en être
 * une » — ce qui est une seconde barrière et non une raison de ne pas tester.
 */

const RACINE = resolve(import.meta.dirname, '../..', 'screens');

const cadre = (chemin: string): string => readFileSync(resolve(RACINE, chemin), 'utf8');

/**
 * Un cadre qui LIT ses données, et ce qu'il a cessé d'écrire en dur.
 *
 * `lit` est l'expression JSX attendue, telle que le transcodeur l'émet : `{x.y}`
 * pour une interpolation, `(xs ?? []).map(` pour une boucle. `nePlus` est le
 * littéral de la maquette qui a été remplacé — il ne doit plus figurer nulle part
 * dans le fichier.
 */
interface Liaison {
  readonly fichier: string;
  readonly lit: readonly string[];
  readonly nePlus: readonly string[];
}

const LIAISONS: readonly Liaison[] = [
  // ── Compte ────────────────────────────────────────────────────────────────
  {
    fichier: 'k03/mobile.generated.tsx',
    /**
     * LES COULEURS SORTENT SANS ACCOLADES, et c'est le JSX qui le veut : elles
     * vivent dans un objet de style (`background: niveaux.n1.fond`), pas dans un
     * nœud de texte. L'attendre sous la forme `{niveaux.n1.fond}` a fait échouer
     * ce cas à sa première exécution — sur une liaison pourtant bien appliquée.
     * C'est le genre d'erreur qu'un test écrit contre le JOURNAL du générateur
     * n'aurait jamais levée, et c'est la raison d'être de ce fichier.
     */
    lit: [
      '{niveaux.n1.etat}',
      'background: niveaux.n1.fond',
      '{niveaux.n2.etat}',
      'background: niveaux.n2.fond',
    ],
    nePlus: ['>Acquis<', '>À faire<'],
  },
  {
    fichier: 'k04/mobile.generated.tsx',
    /**
     * UNE CONDITION DU DIALECTE SORT EN TERNAIRE — `{t.dernier ? (<>…</>) : null}` —
     * et non en interpolation. Les deux variantes doivent être là : c'est ce qui
     * distingue « les deux cartes sont dessinées » de « une seule est gardée »,
     * qui serait un mensonge sur l'autre ligne.
     */
    lit: [
      '(telephones ?? []).map(',
      '{t.masque}',
      't.dernier ? (',
      't.retirable ? (',
      's.courante ? (',
      's.revocable ? (',
    ],
    nePlus: ['+229 •• 42', '+33 •• 18', 'iPhone · cet appareil'],
  },
  {
    fichier: 'k07/mobile.generated.tsx',
    lit: ['{prefs.calmeDebut}', '{prefs.calmeFin}'],
    nePlus: ['22 h – 7 h'],
  },
  {
    fichier: 'k02contact/ajout.generated.tsx',
    lit: ['{membre.prenom}'],
    nePlus: ['Ajouter Fatou aux contacts'],
  },
  {
    fichier: 'k06momo/numero.generated.tsx',
    lit: ['{premium.montantXof}'],
    nePlus: ['Payer 2 600 F'],
  },
  // ── Entraide ──────────────────────────────────────────────────────────────
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPTEUR N'A PAS DISPARU : IL A CHANGÉ DE CHEMIN                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Ces deux entrées exigeaient `{compteurs.ouvertes}` et
   * `{compteurs.pouvezAider}` dans le JSX, et elles avaient raison tant que la
   * rangée de pastilles était cinq `<span>` morts avec deux nombres interpolés
   * dedans.
   *
   * Elle est devenue une BOUCLE — le porteur voulait que ces pastilles filtrent
   * (« Intègre donc ») — et une pastille qui répond a besoin d'une clé, d'un
   * état actif, d'une destination et d'un geste. La rangée est donc une liste de
   * `PorteeFil`, et le nombre entre dans le LIBELLÉ : `porteesDuFil` compose
   * « Toutes · 9 » par `p.libelle(compteurs)`. Le cadre lit `{p.libelle}`, et il
   * ne peut plus nommer `compteurs` — il ne sait même plus qu'il en existe.
   *
   * ── CE QUI SERAIT L'ERREUR, ET POURQUOI IL Y A UN SECOND TEST ─────────────
   *
   * Corriger CES DEUX LIGNES et s'arrêter là perdrait la couverture au lieu de
   * la déplacer : on vérifierait que le cadre lit une liste, sans que personne ne
   * vérifie plus que le NOMBRE y arrive. C'est exactement l'angle mort qui laisse
   * une pastille afficher « Toutes · 0 » sur une ville qui a quarante demandes.
   *
   * Le nombre est donc éprouvé LÀ OÙ IL VIT MAINTENANT, dans
   * `entraide/__tests__/portees.test.ts` — qui n'existait pas, parce que jusqu'ici
   * ce fichier-ci suffisait.
   */
  {
    fichier: 'h01/mobile.generated.tsx',
    lit: ['(portees ?? [])', '{p.libelle}'],
    nePlus: ['Toutes · 41', 'Vous pouvez aider · 4'],
  },
  {
    fichier: 'h04/mobile.generated.tsx',
    lit: ['(portees ?? [])', '{p.libelle}'],
    nePlus: ['Toutes · 41', 'Vous pouvez aider · 4'],
  },
  // Lot D : `h05/mobile.generated.tsx` n'est plus dans cette table. Sa rangée de
  // filtres (dont « Lyon ») est le composant `ListeParrains`, qui charge ses villes : le
  // cadre ne lit plus aucune propriété (le générateur écrit `_props`), ce que cette
  // table interdit. La preuve que « Lyon » n'est plus dessiné en dur est dans
  // `entraide-vivant.test.ts`.
  // ── Services ──────────────────────────────────────────────────────────────
  {
    fichier: 's02contact/desktopcontact.generated.tsx',
    lit: ['{annonce.titre}', '{annonce.auteurCourt}', '{annonce.prenomAuteur}'],
    nePlus: ['Studio meublé Lyon 7e · Sarah T.', 'conversation avec Sarah'],
  },
  {
    fichier: 's02contact/mobilecontact.generated.tsx',
    lit: ['{annonce.titre}', '{annonce.auteurCourt}', '{annonce.prenomAuteur}'],
    nePlus: ['Studio meublé Lyon 7e · Sarah T.', 'conversation avec Sarah'],
  },
  {
    fichier: 's02verification/mobileverification.generated.tsx',
    lit: ['{annonce.prenomAuteur}'],
    nePlus: ['Contacter Sarah'],
  },
  {
    fichier: 's05lien/lienexterne.generated.tsx',
    lit: ['{offre.domaine}'],
    nePlus: ['arvel.fr'],
  },
  // ── Parcours ──────────────────────────────────────────────────────────────
  {
    fichier: 'j02/desktop.generated.tsx',
    lit: ['{panneau.titre}', '{panneau.type}', '{panneau.avancement}', '{panneau.etape}'],
    nePlus: ['>Mes études à Lyon<', '>PARCOURS ÉTUDES<', '>58%<'],
  },
  {
    fichier: 'j02/mobile.generated.tsx',
    lit: ['(modeles ?? []).map(', '{m.nom}', '{m.etapes}', 'm.choisi ? (', 'm.autre ? ('],
    nePlus: ['>Étudier<', '>12 étapes<', '>Régulariser ma situation<'],
  },
  {
    fichier: 'j02/mobileplanatteint.generated.tsx',
    lit: ['(modeles ?? []).map(', '{m.nom}', '{m.etapes}'],
    nePlus: ['Étudier · 12 étapes', 'Travailler · 10 étapes'],
  },
  // ── Transverse et onboarding ──────────────────────────────────────────────
  {
    fichier: 'x04/mobile.generated.tsx',
    lit: ['{quota.utilises}', '{quota.plafond}', '{quota.reinitialise}'],
    nePlus: ['1 événement sur 1 ce mois-ci', 'Réinitialisé le 1er octobre.'],
  },
  {
    fichier: 'o05/avecparcours.generated.tsx',
    lit: ['{parcours.titre}', '{parcours.rang}', '{parcours.total}', '{parcours.etape}'],
    nePlus: ['ÉTAPE 1 SUR 12', '>Mes études à Lyon<', 'Obtenir votre admission'],
  },
];

describe('les cadres branchés lisent vraiment leurs données, dans le JSX produit', () => {
  for (const liaison of LIAISONS) {
    it(`${liaison.fichier} lit ses propriétés et n’écrit plus les valeurs de la maquette`, () => {
      const source = cadre(liaison.fichier);

      // LE PREMIER SENS : l'expression attendue est là. Sans lui, le test
      // passerait sur un cadre vide, ou sur un cadre dont la liaison a été jetée
      // en silence par le transcodeur.
      for (const expression of liaison.lit) {
        expect(source, `${liaison.fichier} doit lire ${expression}`).toContain(expression);
      }

      // LE SECOND SENS : la valeur de la maquette a disparu. Sans lui, une liaison
      // posée sur une AUTRE occurrence du même texte laisserait la première en dur
      // et le test ne verrait rien.
      for (const littéral of liaison.nePlus) {
        expect(source, `${liaison.fichier} ne doit plus écrire « ${littéral} »`).not.toContain(
          littéral,
        );
      }

      // ET LA SIGNATURE : un cadre qui reçoit ses données sans les lire porte
      // `(_props:`. C'est le souligné que tout ce lot existe pour faire tomber.
      expect(source).not.toContain('(_props:');
    });
  }
});

/**
 * ─── 01 §2.1, RÈGLE DURE : AUCUN NUMÉRO EN CLAIR ───────────────────────────
 *
 * Le rempart est à deux étages, et aucun des deux n'est ce test : `meResponseSchema`
 * ne décrit AUCUN champ de numéro en clair (`phones[].masked` est le seul), et
 * `e2e/compte.spec.ts` éprouve la règle à l'écran. Ce cas-ci garde une troisième
 * chose, que ni l'un ni l'autre ne voit : ce que les cadres TRANSCODÉS écrivent en
 * dur dans le document servi.
 *
 * ⚠ IL Y A EXACTEMENT UN NUMÉRO EN CLAIR DANS TOUT LE MODULE, et il est NOMMÉ ici
 * plutôt que toléré en silence : « +229 97 12 34 42 », l'exemple du champ de
 * saisie du volet Mobile Money. Ce n'est pas une donnée de membre — aucune route
 * ne l'envoie, et il ne peut pas en venir une, puisque le contrat n'a pas de champ
 * pour un numéro en clair. C'est l'exemple que la maquette dessine, et que le
 * transcodeur ne transforme PAS en `placeholder` faute de reconnaître ce champ.
 *
 * Le test est écrit comme une BORNE et non comme une exception : si un second
 * numéro en clair apparaît, ou si celui-ci cesse d'être le seul, il échoue. C'est
 * la forme qui empêche une tolérance de s'étendre toute seule.
 */
describe('01 §2.1 — ce que les cadres du module Compte écrivent en dur', () => {
  /** Un numéro à la française ou à la béninoise, chiffres groupés, non masqué. */
  const EN_CLAIR = /\+(?:33|229)(?:\s?\d){6,}/g;

  const CADRES_COMPTE = [
    'k01',
    'k02',
    'k03',
    'k04',
    'k05',
    'k06',
    'k07',
    'k08',
    'k09',
    'k10',
  ] as const;

  it('les dix pages de Compte n’écrivent AUCUN numéro en clair', () => {
    const trouves: string[] = [];
    for (const écran of CADRES_COMPTE) {
      for (const largeur of ['desktop', 'mobile'] as const) {
        const source = cadre(`${écran}/${largeur}.generated.tsx`);
        for (const m of source.matchAll(EN_CLAIR)) trouves.push(`${écran}/${largeur}: ${m[0]}`);
      }
    }
    expect(trouves).toEqual([]);
  });

  /**
   * LE MASQUE EST BIEN CE QUE LA PAGE LIT, et pas seulement « rien de clair ».
   * C'est l'assertion de valeur qui empêche ce cas d'être creux : un cadre vide
   * passerait le test précédent sans rien garder.
   */
  it('K04 lit `masque`, sur SES DEUX cadres', () => {
    for (const largeur of ['desktop', 'mobile'] as const) {
      expect(cadre(`k04/${largeur}.generated.tsx`)).toContain('{t.masque}');
    }
  });

  it('le SEUL numéro en clair du module est l’exemple de saisie Mobile Money', () => {
    const volet = cadre('k06momo/numero.generated.tsx');
    const trouves = [...volet.matchAll(EN_CLAIR)].map((m) => m[0]);
    expect(trouves).toEqual(['+229 97 12 34 42']);
    // Et il n'est PAS une donnée : rien ne l'interpole, c'est du texte de maquette.
    expect(volet).not.toContain('{telephone');
    expect(volet).not.toContain('{t.masque}');
  });
});

/**
 * ─── 14 §4.1 : AUCUNE DONNÉE DE CARTE, SUR LES CADRES QUE CE LOT A BRANCHÉS ─
 *
 * `lib/api/__tests__/carte-interdite.test.ts` garde le CONTRAT — un `last4` dans
 * une réponse est refusé à la frontière. Ce cas garde l'autre bout : les trois
 * volets du paiement Mobile Money, dont ce lot a branché le montant, ne dessinent
 * aucun champ de carte et n'en lisent aucun.
 */
describe('14 §4.1 — les volets de paiement ne portent aucune donnée de carte', () => {
  const INTERDITS = ['last4', 'cardNumber', 'expiry', 'cvv', 'fingerprint', 'Numéro de carte'];

  for (const volet of ['numero', 'attente', 'succes'] as const) {
    it(`k06momo/${volet} ne porte aucun champ de carte`, () => {
      const source = cadre(`k06momo/${volet}.generated.tsx`);
      for (const interdit of INTERDITS) expect(source).not.toContain(interdit);
    });
  }

  /** L'assertion de valeur : le montant vient bien du serveur, pas de la maquette. */
  it('le montant du bouton est une donnée de `GET /plans`, pas le « 2 600 F » de la maquette', () => {
    const source = cadre('k06momo/numero.generated.tsx');
    expect(source).toContain('{premium.montantXof}');
    expect(source).not.toContain('Payer 2 600 F');
  });
});

/**
 * ─── 10 §7, RÈGLE DURE : LE SCORE DE RISQUE N'EST PAS AFFICHÉ ───────────────
 *
 * Les trois feuilles de contact de S02 sont celles que ce lot a branchées, et
 * elles parlent de l'annonce. Elles ne doivent porter ni chiffre de risque, ni
 * numéro de téléphone — la seconde moitié de la règle dure du module Services.
 *
 * `prudenceRenforcee` RESTE PERMIS, et c'est la distinction de fond : §2.2 veut la
 * TRANCHE, et c'est un booléen. Le refuser ici rendrait le rappel de prudence
 * impossible tout en ne protégeant rien.
 */
describe('10 §7 — ni score de risque ni téléphone sur les feuilles de S02', () => {
  const FEUILLES = [
    's02contact/desktopcontact.generated.tsx',
    's02contact/mobilecontact.generated.tsx',
    's02verification/mobileverification.generated.tsx',
  ] as const;

  for (const feuille of FEUILLES) {
    it(`${feuille} n’affiche aucun score ni numéro`, () => {
      const source = cadre(feuille);
      for (const interdit of ['riskScore', 'riskFlags', 'score', 'risque']) {
        expect(source.toLowerCase()).not.toContain(interdit.toLowerCase());
      }
      expect(source).not.toMatch(/\+(?:33|229)(?:\s?\d){6,}/);
      // L'assertion de valeur : la feuille nomme bien l'auteur de l'annonce.
      expect(source).toContain('{annonce.prenomAuteur}');
    });
  }
});

/**
 * ─── 03 §3.1 : LA LIMITE DU PLAN EST AFFICHÉE, JAMAIS APPLIQUÉE PAR L'ÉCRAN ─
 *
 * C'est la règle dure du module Parcours, et elle a deux moitiés. Le cadre
 * « plan atteint » que ce lot a branché doit :
 *
 *   · NE PAS BLOQUER LA LECTURE — §3.1 l'exige en toutes lettres (« encart "Vous
 *     avez déjà un parcours actif" avec bouton Premium, SANS BLOQUER LA LECTURE »).
 *     Les types restent donc listés sous l'encart, et ils sont désormais lus ;
 *   · NE DÉCIDER DE RIEN. Aucune comparaison de limite dans le cadre : c'est le
 *     serveur qui répond `422 PLAN_LIMIT_REACHED`, et l'écran n'en est que
 *     l'affichage.
 */
describe('03 §3.1 — le cadre « plan atteint » affiche la limite et ne l’applique pas', () => {
  it('il liste les types de parcours, et ils viennent du serveur', () => {
    const source = cadre('j02/mobileplanatteint.generated.tsx');
    expect(source).toContain('(modeles ?? []).map(');
    expect(source).toContain('{m.etapes}');
    // La lecture n'est pas bloquée : l'encart ET la liste sont dans le même cadre.
    expect(source).toContain('PLAN ATTEINT');
  });

  it('aucun cadre de J02 ne compare un quota ni ne lit un niveau', () => {
    for (const nom of ['desktop', 'mobile', 'mobileregulariser', 'mobileplanatteint'] as const) {
      const source = cadre(`j02/${nom}.generated.tsx`);
      for (const interdit of ['verificationLevel', 'JOURNEY_FREE_ACTIVE_LIMIT', 'PLAN_LIMIT']) {
        expect(source, `${nom} ne doit pas décider`).not.toContain(interdit);
      }
    }
  });
});
