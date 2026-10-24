/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT W2A, PHASE 2 — DES DONNÉES STATIQUES À RENDRE DYNAMIQUES               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Règle : une valeur vient de l'API ou du compte connecté ; sinon un état vide
 * HONNÊTE (« Aucune sanction », « Pas encore de mesure ») — jamais un chiffre, une
 * ville ou un nom propre de la maquette.
 *
 * L'audit du front (RAPPORT-FRONT §3) avait relevé vingt-deux endroits où une
 * planche transcodée montre à tout le monde ce que la maquette dessine pour
 * l'exemple : « ÉVÉNEMENTS À LYON », « Mes études à Lyon · 58 % », « Modifié le 2
 * janvier », « Sandra M. · Lyon 3e », « 14 j »… Plusieurs avaient déjà été liés par
 * les lots précédents ; ce fichier porte le reste.
 *
 * ── COMMENT ──────────────────────────────────────────────────────────────────
 *
 * Chaque adaptation vise UN littéral, l'échange contre une valeur lue (une prise
 * de données, ou un petit composant qui lit `GET /me` — `components/valeurs-vives`)
 * et le DIT quand il n'est pas là (`applied: false`). Elles sont universelles
 * (`screens: ['*']`) et filtrent par section : un littéral absent d'un cadre ne
 * veut pas dire « motif périmé », et le test `donnees-vives.test.ts`
 * (`apps/web/src/screens/__tests__`) garde de toute façon la liste noire des
 * littéraux de la maquette sur les écrans montés.
 *
 * Les valeurs numériques et les délais viennent de `packages/shared` (voir
 * `lib/textes-delais.ts`), jamais recopiées ici.
 */

import { finElement } from './reseau-vivant.mjs';

// ─── Outils ──────────────────────────────────────────────────────────────────

/** Remplace UNE occurrence exacte d'un texte ; `null` quand il n'y est pas. */
function remplacer(jsx, ancien, neuf) {
  const i = jsx.indexOf(ancien);
  if (i === -1) return null;
  return jsx.slice(0, i) + neuf + jsx.slice(i + ancien.length);
}

/** Applique une série de remplacements ; `applied` si AU MOINS un a pris. */
function serie(jsx, paires) {
  let out = jsx;
  let pris = false;
  for (const [ancien, neuf] of paires) {
    const r = remplacer(out, ancien, neuf);
    if (r !== null) {
      out = r;
      pris = true;
    }
  }
  return { jsx: out, applied: pris };
}

/**
 * L'INDICE QUI SUIT L'ACCOLADE FERMANTE de l'expression JSX `{ … }` qui s'ouvre à
 * `debut` — en comptant les accolades (les `{{ }}` des styles et les `${ }` des
 * gabarits y sont équilibrés). `-1` quand elles ne retombent pas à zéro.
 */
function finExpression(jsx, debut) {
  let profondeur = 0;
  for (let i = debut; i < jsx.length; i += 1) {
    const c = jsx[i];
    if (c === '{') profondeur += 1;
    else if (c === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Pose, juste après la boucle `{(liste ?? []).map(…)}`, un message qui ne s'affiche
 * que quand la liste est VIDE : « Aucun contact pour l'instant. » plutôt qu'une
 * carte muette. `null` quand la boucle n'est pas dans ce cadre.
 */
function avecEtatVide(jsx, liste, message) {
  const ouverture = `{(${liste} ?? []).map(`;
  const debut = jsx.indexOf(ouverture);
  if (debut === -1) return null;
  const fin = finExpression(jsx, debut);
  if (fin === -1) return null;
  const vide =
    `{(${liste} ?? []).length === 0 ? (<div data-etat-vide="" style={{ padding: "14px 0", fontSize: "13px", color: "#8A958F" }}>` +
    `${message}</div>) : null}`;
  return jsx.slice(0, fin) + vide + jsx.slice(fin);
}

/** Une adaptation universelle qui ne vaut que pour ces sections (les cadres s'y reconnaissent). */
function pour(sections, nom, why, provides, apply) {
  return {
    screens: ['*'],
    nom,
    why,
    provides,
    apply(jsx, ctx) {
      if (ctx === undefined || !sections.includes(ctx.section)) return { jsx, applied: false };
      return apply(jsx, ctx);
    },
  };
}

// ─── A01 · l'accueil ─────────────────────────────────────────────────────────

const ALERTE_A01 =
  '<div style={{ background: "#FDF0E7", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#B4581F" }}>ALERTE VIGILANCE</div><p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: "1.6" }}>Attention aux fausses offres de logement exigeant un virement avant toute visite.</p></div>';

const CARTE_PARCOURS_MOBILE =
  '<div style={{ background: "#0F5C48", borderRadius: "20px", padding: "14px 16px", color: "#fff", display: "flex", alignItems: "center", gap: "14px" }}>';

const A01_VIVANT = [
  pour(
    ['A01'],
    'A01_TITRE_EVENEMENTS_VILLE',
    '« ÉVÉNEMENTS À LYON » nomme la ville du membre (`GET /me`) ; sans ville, le titre dit « ÉVÉNEMENTS » et rien d’autre.',
    [],
    (jsx) =>
      serie(jsx, [
        [
          '>ÉVÉNEMENTS À LYON</span>',
          '><VilleMembre avant="ÉVÉNEMENTS À " sans="ÉVÉNEMENTS" majuscules /></span>',
        ],
      ]),
  ),
  pour(
    ['A01'],
    'A01_ALERTE_VIGILANCE',
    'L’alerte de vigilance est celle que le serveur publie (`scamAlert` de `GET /feed/sidebar`) ; sans alerte, la carte n’existe pas.',
    ['alerte'],
    (jsx) =>
      serie(jsx, [
        [
          ALERTE_A01,
          '{alerte ? (<div style={{ background: "#FDF0E7", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#B4581F" }}>ALERTE VIGILANCE</div><p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: "1.6" }}><strong>{alerte.titre}</strong>{alerte.corps === "" ? null : (<>{" "}{alerte.corps}</>)}</p></div>) : null}',
        ],
      ]),
  ),
  pour(
    ['A01'],
    'A01_CARTE_PARCOURS_MOBILE',
    'La carte « Mes études à Lyon · 58 % · Étape 7 » du téléphone montre le parcours actif réel (titre, avancement, étape courante), ou « Aucun parcours en cours » comme à 1 440 px.',
    [],
    (jsx) => {
      const debut = jsx.indexOf(CARTE_PARCOURS_MOBILE);
      if (debut === -1) return { jsx, applied: false };
      const fin = finElement(jsx, debut);
      if (fin === -1) return { jsx, applied: false };
      return { jsx: jsx.slice(0, debut) + '<CarteMonParcoursMobile />' + jsx.slice(fin), applied: true };
    },
  ),
];

// ─── K01 · le profil ─────────────────────────────────────────────────────────

const K01_VIVANT = [
  pour(
    ['K01'],
    'K01_PHRASES_VIVANTES',
    'Les trois phrases datées de K01 — pseudo, pays d’origine, nouveaux arrivants — sont composées depuis `GET /me` et les constantes partagées.',
    [],
    (jsx) =>
      serie(jsx, [
        [
          '>Modifié le 2 janvier · prochain changement possible le 2 avril</div>',
          '><PhrasePseudo /></div>',
        ],
        [
          '>Déjà modifié une fois. Contactez le support pour le changer.</div>',
          '><PhrasePaysOrigine /></div>',
        ],
        ['>Pendant 3 mois après votre arrivée</div>', '><PhraseNouvelArrivant /></div>'],
      ]),
  ),
];

// ─── K08 · mes données ───────────────────────────────────────────────────────

const K08_VIVANT = [
  pour(
    ['K08'],
    'K08_DELAIS',
    'Les délais de « Mes données » (lien d’archive, réactivation, délai de rétractation) viennent des règles partagées, pas de la maquette.',
    [],
    (jsx) =>
      serie(jsx, [
        ['>Sous 48 h, lien 7 jours</div>', '><Texte id="exportMobile" /></div>'],
        ['>Réversible 6 mois</div>', '><Texte id="desactiverMobile" /></div>'],
        ['>Définitif après 7 jours</div>', '><Texte id="supprimerMobile" /></div>'],
        [
          '>Votre profil est masqué. Reconnectez-vous dans les 6 mois pour le retrouver.</div>',
          '><Texte id="desactiverDesktop" /></div>',
        ],
        ['>Définitif après 7 jours.</div>', '><Texte id="supprimerDesktop" /></div>'],
        // La confirmation de suppression (cadre K08 de 440 px).
        [
          '>Vous avez 7 jours pour changer d\'avis.</div>',
          '><Texte id="suppressionRepit" /></div>',
        ],
      ]),
  ),
];

// ─── A06 · propositions reçues ───────────────────────────────────────────────

const A06_VIVANT = [
  pour(
    ['A06'],
    'A06_ENTETE_GUIDE',
    '« Mis à jour le 12 mars · 84 ont trouvé utile » est la date de mise à jour et le nombre de votes « utile » du guide (`GET /guides/:slug`).',
    [],
    (jsx) =>
      serie(jsx, [
        [
          '>Mis à jour le 12 mars · 84 ont trouvé utile</div>',
          '>{guide.misAJour}{guide.misAJour !== "" && guide.utiles !== "" ? " · " : ""}{guide.utiles}</div>',
        ],
      ]),
  ),
  pour(
    ['A06'],
    'A06_DELAIS_14_JOURS',
    'Le délai de 14 jours avant escalade est `GUIDE_PROPOSAL_ESCALATION_DAYS`, la constante que le serveur applique.',
    [],
    (jsx) =>
      serie(jsx, [
        [
          '>Vous avez 14 jours pour répondre à chaque proposition. Sans réponse, elle est transmise à la modération. Chaque proposition acceptée crédite son auteur comme contributeur.</div>',
          '><Texte id="propositionsDelai" /></div>',
        ],
        [
          "L'auteur a 14 jours pour répondre. Sans réponse, la modération tranche.",
          '<Texte id="correctionDelai" />',
        ],
      ]),
  ),
];

// ─── K05 · les contacts ──────────────────────────────────────────────────────

const ONGLET_K05 =
  /<span (style=\{\{ padding: "9px 16px"[^}]*\}\})>(Contacts|Demandes · \{contacts\.demandes\}|Suggestions)<\/span>/g;

const ANCRES_K05 = {
  Contacts: 'k05-contacts',
  'Demandes · {contacts.demandes}': 'k05-demandes',
  Suggestions: 'k05-suggestions',
};

const K05_VIVANT = [
  pour(
    ['K05'],
    'K05_ETATS_VIDES',
    'Les quatre listes de Contacts disent leur vide (« Aucun contact pour l’instant ») au lieu de rester des cartes muettes.',
    [],
    (jsx) => {
      let out = jsx;
      let pris = false;
      for (const [liste, message] of [
        ['contacts.liste', 'Aucun contact pour l’instant.'],
        ['demandesRecues', 'Aucune demande reçue.'],
        ['suggestions', 'Aucune suggestion pour le moment.'],
        ['bloques', 'Aucun membre bloqué.'],
      ]) {
        const r = avecEtatVide(out, liste, message);
        if (r !== null) {
          out = r;
          pris = true;
        }
      }
      return { jsx: out, applied: pris };
    },
  ),
  pour(
    ['K05'],
    'K05_SECTIONS_MOBILE',
    'Le téléphone n’avait qu’une liste (les contacts) : les demandes reçues, les suggestions et les bloqués s’empilent dessous, et les onglets y mènent.',
    ['demandesRecues', 'suggestions', 'bloques', 'contactsOccupe'],
    (jsx) => {
      // Seul le cadre mobile a des onglets de 9 px de marge haute et pas de « Bloqués ».
      if (jsx.includes('>Bloqués</span>')) return { jsx, applied: false };
      let out = jsx.replace(ONGLET_K05, (_t, style, libelle) => {
        const ancre = ANCRES_K05[libelle];
        // Deux clés `color` dans un même style donnent TS1117 (piège 8) : on n'ajoute que ce qui manque.
        const ajout = /[ ,{]color:/.test(style) ? 'textDecoration: "none"' : 'textDecoration: "none", color: "inherit"';
        const lie = style.replace(' }}', `, ${ajout} }}`);
        return `<a href="#${ancre}" ${lie}>${libelle}</a>`;
      });
      const liste = out.indexOf('{(contacts.liste ?? []).map(');
      if (liste === -1) return { jsx, applied: false };
      const carte = out.lastIndexOf('<div ', liste);
      const fin = finElement(out, carte);
      if (carte === -1 || fin === -1) return { jsx, applied: false };
      out =
        out.slice(0, carte) +
        '<div id="k05-contacts" style={{ display: "contents" }}>' +
        out.slice(carte, fin) +
        '</div><SectionsContactsMobile demandes={demandesRecues} suggestions={suggestions} bloques={bloques} occupe={contactsOccupe === true} />' +
        out.slice(fin);
      return { jsx: out, applied: true };
    },
  ),
];

// ─── S01 · l'annuaire du logement ────────────────────────────────────────────

const S01_VIVANT = [
  pour(
    ['S01'],
    'S01_PHRASE_ANNONCES',
    '« 0 annonces à France » nommait un pays à la place d’une ville : la phrase est composée (`phraseAnnonces`), sans lieu inventé.',
    [],
    (jsx) =>
      serie(jsx, [['>{liste.total} annonces à {liste.ville} · publication', '>{liste.phrase} · publication']]),
  ),
  pour(
    ['S01'],
    'S01_PASTILLE_VILLE',
    'La pastille de ville de la rangée de filtres n’existe que s’il y a UNE ville à nommer (elle disait « France »).',
    [],
    (jsx) => {
      const pastille =
        '<span style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff", color: "#16211D", border: "1px solid #E6EBE9" }}>{liste.ville}</span>';
      return serie(jsx, [[pastille, `{liste.ville !== "" ? (${pastille}) : null}`]]);
    },
  ),
];

// ─── H01 · le fil d'entraide ─────────────────────────────────────────────────

const PASTILLE_VILLE_H01 =
  '<span style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff", color: "#16211D", border: "1px solid #E6EBE9" }}>Lyon</span>';

const H01_VIVANT = [
  pour(
    ['H01'],
    'H01_PASTILLE_VILLE',
    'La pastille de ville du fil d’entraide nomme la ville du membre (celle de « N demandes ouvertes à … ») ; sans ville, elle n’existe pas.',
    [],
    (jsx) =>
      serie(jsx, [
        [
          PASTILLE_VILLE_H01,
          PASTILLE_VILLE_H01.replace('>Lyon</span>', '>{ville}</span>')
            .replace(/^/, '{ville !== "" && ville !== "—" ? (')
            .replace(/$/, ') : null}'),
        ],
      ]),
  ),
];

// ─── E04 · la feuille de présence ────────────────────────────────────────────

const E04_VIVANT = [
  pour(
    ['E04'],
    'E04_STATUT_REEL',
    '« Présent·e » ne s’écrit plus devant chaque inscrit : la ligne dit son statut réel (Inscrit·e, Présent·e, Absent·e, À enregistrer).',
    [],
    (jsx) => serie(jsx, [['>Présent·e{p.coche ? (<>', '>{p.statut}{p.coche ? (<>']]),
  ),
];

export const ADAPTATIONS_DONNEES_VIVES = [
  ...A01_VIVANT,
  ...K01_VIVANT,
  ...K08_VIVANT,
  ...A06_VIVANT,
  ...K05_VIVANT,
  ...S01_VIVANT,
  ...H01_VIVANT,
  ...E04_VIVANT,
];

export const AJOUTS_DONNEES_VIVES = {
  VilleMembre: '@/components/valeurs-vives',
  Texte: '@/components/valeurs-vives',
  PhrasePseudo: '@/components/valeurs-vives',
  PhrasePaysOrigine: '@/components/valeurs-vives',
  PhraseNouvelArrivant: '@/components/valeurs-vives',
  CarteMonParcoursMobile: '@/components/carte-mon-parcours',
  SectionsContactsMobile: '@/components/compte/sections-contacts-mobile',
};
