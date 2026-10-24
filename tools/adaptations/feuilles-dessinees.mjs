/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « FEUILLES DESSINÉES » — LES PLANCHES NON MONTÉES DEVIENNENT VIVANTES   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Décision du porteur : « Monte les dessins de la maquette et rends-les dynamiques. »
 *
 * L'audit avait recensé des planches générées qu'aucune page n'importait : J03 « Je
 * suis bloqué·e » (six cadres), J04 « Partager un jalon » (deux), et les feuilles mobiles
 * J01M, J05 (invitation), J07 (export), J08 (arrêt), X04 (encart de refus). À leur place,
 * `components/parcours/feuilles.tsx` rendait un panneau écrit à la main, qui ne
 * ressemblait pas au dessin. Mesuré sur J03 : décompte « 1 · Votre message / 2 · Portée /
 * 3 · Aperçu » absent, cartes de portée sans pastille, aperçu sans la carte terre cuite
 * « Depuis un parcours » ; sur J04 : la carte « ÉTAPE FRANCHIE · N sur M » absente.
 *
 * ── CE QUE FONT CES ADAPTATIONS ────────────────────────────────────────────────
 *
 * Le dessin reste CELUI DE LA MAQUETTE, transcodé. On ne remplace que les NŒUDS qu'une
 * image ne peut pas rendre vivants, un par un, et chacun reprend le `style` du nœud qu'il
 * remplace — relevé sur le cadre lui-même, ordinateur et mobile (piège n° 1) :
 *
 *   · un texte dessiné (« Visa étudiant », « 4 sur 12 ») → `<FVal k=… />` ;
 *   · un bouton (« Suivant », « Publier », « Arrêter ») → `<FAct k=… />` ;
 *   · un lien (une ligne de « Mes parcours », « Nouveau parcours ») → `<FLien … />` ;
 *   · une région qui demande un état (le champ de texte, la liste de contacts, les cartes de
 *     portée, le sélecteur de rôle) → `<FSlot k=… s={[styles du dessin]} />`.
 *
 * Les pièces sont dans `components/parcours/feuille-dessinee.tsx` ; les contrôleurs qui les
 * alimentent (état, appels serveur, niveau requis) dans `components/parcours/feuilles.tsx`.
 *
 * ── LES RÈGLES QUE LE REMPLACEMENT TIENT ───────────────────────────────────────
 *
 *   · une coupe COMPTE ses balises (`finElement`, piège n° 3) ; un nœud introuvable fait
 *     répondre `applied: false` — le générateur le dit, l'écran ne devient pas muet ;
 *   · on ancre sur un TEXTE ou une structure, jamais sur une mesure (piège n° 1) ;
 *   · le premier contrôle d'un nœud est toujours le plus petit élément qui contient le texte.
 *
 * ── ÉCARTS À LA MAQUETTE, REMONTÉS ─────────────────────────────────────────────
 *
 *   · J07 : la maquette dessine « Réservé à Premium / Découvrir Premium ». Le paiement est
 *     hors périmètre et tout est gratuit ; la carte annonce l'export, et le bouton l'ouvre.
 *     Les couleurs sont celles de l'encart voisin (vert pâle), la phrase « documents
 *     cochés » est corrigée (l'export contient les étapes et leurs durées, pas la checklist) ;
 *   · J04 : l'icône « photo » à droite de la phrase d'encouragement est retirée — le partage
 *     d'un jalon n'accepte pas d'image (`MILESTONE_TEXT_MAX`, texte seul) ;
 *   · X04 : seul l'encart « NIVEAU » est gardé. L'encart « PLAN » relève du paiement, la
 *     barre haute « Créer un événement » et la barre d'onglets appartiennent à la page, pas
 *     à la feuille de refus ;
 *   · J03 : les champs que la maquette ne dessine pas (titre de la publication, secteurs,
 *     contrats, pseudo du parrain — exigés par `publishBlocker`) s'ajoutent sous les cartes
 *     de portée, dans le langage visuel du champ voisin (AJOUT).
 */
import { finElement } from './reseau-vivant.mjs';

export const AJOUTS_FEUILLES_DESSINEES = {
  FVal: '@/components/parcours/feuille-dessinee',
  FAct: '@/components/parcours/feuille-dessinee',
  FLien: '@/components/parcours/feuille-dessinee',
  FSlot: '@/components/parcours/feuille-dessinee',
};

// ─── Outils ──────────────────────────────────────────────────────────────────

/**
 * L'élément qui contient `texte`, en remontant de `remonter` parents depuis le plus petit.
 * `{ debut, fin }` ou `null`. Les balises se COMPTENT (`finElement`).
 */
function enveloppe(jsx, texte, remonter = 0) {
  const at = jsx.indexOf(texte);
  if (at < 0) return null;
  const ouvertures = [...jsx.slice(0, at).matchAll(/<([a-zA-Z][\w.]*)\b/g)].map((m) => m.index);
  let reste = remonter;
  for (let i = ouvertures.length - 1; i >= 0; i -= 1) {
    const debut = ouvertures[i];
    const fin = finElement(jsx, debut);
    if (fin < at + texte.length) continue;
    if (reste === 0) return { debut, fin };
    reste -= 1;
  }
  return null;
}

const ouvrante = (jsx, debut) => jsx.slice(debut, jsx.indexOf('>', debut) + 1);
const balise = (jsx, debut) => /^<([a-zA-Z][\w.]*)/.exec(jsx.slice(debut))?.[1] ?? '';
/** `style={{ … }}` de la balise ouvrante, ou une chaîne vide. */
const attrStyle = (o) => /style=\{\{[^{}]*\}\}/.exec(o)?.[0] ?? '';
/** Les objets de style d'un fragment, dans l'ordre du document : `[{ … }, { … }]`. */
function tableauStyles(fragment) {
  const objets = [...fragment.matchAll(/style=\{(\{[^{}]*\})\}/g)].map((m) => m[1]);
  return `[${objets.join(', ')}]`;
}

function remplacer(jsx, zone, neuf) {
  return jsx.slice(0, zone.debut) + neuf + jsx.slice(zone.fin);
}

/** Un texte dessiné → `<FVal>`. `null` quand le nœud n'y est pas. */
function val(jsx, texte, cle, remonter = 0) {
  const e = enveloppe(jsx, texte, remonter);
  if (e === null) return null;
  const nom = balise(jsx, e.debut);
  if (nom !== 'div' && nom !== 'span') return null;
  return remplacer(jsx, e, `<FVal k="${cle}" tag="${nom}" ${attrStyle(ouvrante(jsx, e.debut))} />`);
}

/** Un bouton dessiné → `<FAct>`, libellé conservé. */
function act(jsx, libelle, cle) {
  const e = enveloppe(jsx, `>${libelle}</button>`);
  if (e === null || balise(jsx, e.debut) !== 'button') return null;
  return remplacer(
    jsx,
    e,
    `<FAct k="${cle}" ${attrStyle(ouvrante(jsx, e.debut))}>${libelle}</FAct>`,
  );
}

/** Une région dessinée → `<FSlot>` qui reçoit les styles du dessin. */
function slot(jsx, texte, cle, remonter = 0) {
  const e = enveloppe(jsx, texte, remonter);
  if (e === null) return null;
  return remplacer(jsx, e, `<FSlot k="${cle}" s={${tableauStyles(jsx.slice(e.debut, e.fin))}} />`);
}

/** De l'élément qui contient `a` à celui qui contient `b` (frères). */
function slotEntre(jsx, a, remA, b, remB, cle) {
  const ea = enveloppe(jsx, a, remA);
  const eb = enveloppe(jsx, b, remB);
  if (ea === null || eb === null || eb.fin <= ea.debut) return null;
  const zone = { debut: ea.debut, fin: eb.fin };
  return remplacer(jsx, zone, `<FSlot k="${cle}" s={${tableauStyles(jsx.slice(zone.debut, zone.fin))}} />`);
}

/** Pose `<FSlot k="alertes" />` juste APRÈS l'élément qui contient `texte`. */
function alertesApres(jsx, texte, remonter = 0) {
  const e = enveloppe(jsx, texte, remonter);
  if (e === null) return null;
  return jsx.slice(0, e.fin) + '<FSlot k="alertes" />' + jsx.slice(e.fin);
}

/** Enchaîne des étapes ; `null` dès que l'une ne trouve pas son nœud. */
function enchainer(jsx, etapes) {
  let sortie = jsx;
  for (const etape of etapes) {
    sortie = etape(sortie);
    if (sortie === null) return null;
  }
  return sortie;
}

function transformation(screens, nom, why, fonction) {
  return {
    screens,
    nom,
    why,
    provides: [],
    apply(jsx) {
      const neuf = fonction(jsx);
      return neuf === null || neuf === undefined ? { jsx, applied: false } : { jsx: neuf, applied: true };
    },
  };
}

// ─── J03 · « Je suis bloqué·e » — trois volets ───────────────────────────────

const FD_J03 = transformation(
  ['J03'],
  'FD_J03',
  'Les trois volets de « Je suis bloqué·e » (message, portée, aperçu) reçoivent leur texte, leurs cartes de portée, leur aperçu et leurs gestes réels (§3.5).',
  (jsx) => {
    if (jsx.includes("Voici où j'en suis")) {
      return enchainer(jsx, [
        (j) => slot(j, "Voici où j'en suis", 'brouillon'),
        (j) => alertesApres(j, 'Relisez et complétez'),
        (j) => act(j, 'Annuler', 'annuler'),
        (j) => act(j, 'Suivant', 'suivant'),
      ]);
    }
    if (jsx.includes('Publier dans Annonces logement')) {
      return enchainer(jsx, [
        (j) => slotEntre(j, 'Publier dans Annonces logement', 2, 'Envoyer seulement à mon équipe', 2, 'portee'),
        (j) => act(j, 'Retour', 'retour'),
        (j) => act(j, 'Voir l’aperçu', 'suivant'),
      ]);
    }
    if (jsx.includes('Depuis un parcours')) {
      return enchainer(jsx, [
        (j) => val(j, '>Logement</span>', 'categorie'),
        (j) => val(j, 'Étape 7 · Logement · échéance dans 9 jours', 'etape'),
        (j) => val(j, "Besoin d'un garant pour un studio à Lyon", 'titre'),
        (j) => val(j, 'on me demande un garant français.', 'texte'),
        (j) => val(j, '>AD<', 'initiales'),
        (j) => val(j, 'Amina D.', 'auteur'),
        (j) => val(j, 'Étudiante · Lyon', 'profil'),
        (j) => act(j, 'Annuler', 'annuler'),
        (j) => act(j, 'Publier', 'publier'),
        (j) => alertesApres(j, 'FVal k="profil"', 2),
      ]);
    }
    return null;
  },
);

// ─── J04 · « Partager un jalon » ─────────────────────────────────────────────

const FD_J04 = transformation(
  ['J04'],
  'FD_J04',
  'La carte « ÉTAPE FRANCHIE », le champ de texte VIDE (§3.6) et les deux gestes de « Partager un jalon » sont réels.',
  (jsx) =>
    enchainer(jsx, [
      (j) => val(j, '4 sur 12', 'compte'),
      (j) => val(j, 'Visa étudiant', 'titreEtape'),
      (j) => val(j, 'Franchie en 4 semaines', 'duree'),
      (j) => slot(j, 'Racontez-la avec vos mots…', 'texte'),
      // L'icône « photo » : le jalon se partage en texte seul. Le bouton n'existerait pas.
      (j) => {
        const e = enveloppe(j, 'M3 4h18v16H3zM8.5', 2);
        return e === null ? j : remplacer(j, e, '');
      },
      (j) => alertesApres(j, 'Cela encourage ceux qui préparent leur départ.', 1),
      (j) => act(j, 'Plus tard', 'plusTard'),
      (j) => act(j, 'Publier', 'publier'),
    ]),
);

// ─── J05 · « Inviter dans l'équipe » (feuille mobile) ────────────────────────

const FD_J05I = transformation(
  ['J05'],
  'FD_J05I',
  'La feuille « Inviter dans l’équipe » : champ de pseudo réel, contacts de `GET /me/connections`, rôle choisi et `POST /journeys/:id/members` (§3.4).',
  (jsx) => {
    if (!jsx.includes('Pseudo ou contact')) return null;
    return enchainer(jsx, [
      (j) => j.replace('Pseudo ou contact', '<FSlot k="pseudo" />'),
      (j) => slotEntre(j, 'Sandra M.', 2, 'Yasmine B.', 2, 'contacts'),
      (j) => slot(j, 'Observateur', 'role', 1),
      (j) => val(j, "L'accompagnant peut échanger et recevoir vos demandes privées.", 'aideRole'),
      (j) => alertesApres(j, 'FVal k="aideRole"', 0) ?? j,
    ]);
  },
);

// ─── J07 · « Exporter mon parcours » (feuille mobile) ────────────────────────

const FD_J07X = transformation(
  ['J07'],
  'FD_J07X',
  'La feuille « Exporter mon parcours » ouvre la page imprimable `/parcours/:id/export`. Plus de carte « Réservé à Premium » : le paiement est hors périmètre et tout est gratuit.',
  (jsx) => {
    if (!jsx.includes('Réservé à Premium') || !jsx.includes('documents cochés.')) return null;
    let out = jsx;
    // La carte : mêmes mesures, teintes de l'encart voisin (X04 « NIVEAU »).
    const carte = enveloppe(out, 'Réservé à Premium', 1);
    if (carte === null) return null;
    let corps = out.slice(carte.debut, carte.fin);
    corps = corps
      .replace('background: "#FBE3D4"', 'background: "#E3F0EB"')
      .replace('color: "#B4581F"', 'color: "#0F5C48"')
      .replace('>Réservé à Premium<', '>Prêt à imprimer<')
      .replace(
        '>Un PDF avec vos étapes, durées et documents cochés.<',
        '>Un PDF avec vos étapes et leurs durées réelles. Vos notes n’y figurent pas.<',
      );
    out = remplacer(out, carte, corps);
    return enchainer(out, [
      (j) => {
        // « Découvrir Premium » devient « Exporter » : même bouton, teinte du bouton principal voisin.
        const e = enveloppe(j, '>Découvrir Premium</button>');
        if (e === null) return null;
        const o = ouvrante(j, e.debut).replace('background: "#E0733A"', 'background: "#16785E"');
        return remplacer(j, e, `<FAct k="exporter" ${attrStyle(o)}>Exporter</FAct>`);
      },
      (j) => act(j, 'Plus tard', 'plusTard'),
    ]);
  },
);

// ─── J08 · « Arrêter … ? » (feuille mobile) ──────────────────────────────────

const FD_J08A = transformation(
  ['J08'],
  'FD_J08A',
  'La feuille d’arrêt : « Garder » la ferme, « Arrêter » appelle `PATCH /journeys/:id` (ABANDONED) (§3.9). Le titre et le nombre d’étapes franchies sont déjà liés.',
  (jsx) => {
    if (!jsx.includes('>Garder</button>')) return null;
    // Le titre « Arrêter « {panneau.titre} » ? » et la phrase « Vos {parcours.franchies} étapes
    // franchies… » restent LIÉS aux données (`chargerJ08`) : le titre est promu en <h2> par le
    // générateur, et la boîte de dialogue y trouve son nom accessible.
    return enchainer(jsx, [
      // Le pluriel suit le nombre (la maquette écrit « 6 étapes » ; un parcours qui en a franchi
      // une lirait « Vos 1 étapes franchies restent »).
      (j) =>
        j.includes('Vos {parcours.franchies} étapes franchies restent')
          ? j.replace(
              'Vos {parcours.franchies} étapes franchies restent',
              'Vos {parcours.franchies} {parcours.franchies === 1 ? "étape franchie reste" : "étapes franchies restent"}',
            )
          : null,
      (j) => alertesApres(j, 'dans votre historique'),
      (j) => act(j, 'Garder', 'garder'),
      (j) => act(j, 'Arrêter', 'arreter'),
    ]);
  },
);

// ─── J01M · « Mes parcours · N » (feuille mobile) ────────────────────────────

const FD_J01M = transformation(
  ['J01M'],
  'FD_J01M',
  'Chaque ligne de « Mes parcours » mène à son parcours ; « Nouveau parcours » mène à la création.',
  (jsx) => {
    if (!jsx.includes('<Fragment key={pIndex}>') || !jsx.includes('Mes parcours · ')) return null;
    return enchainer(jsx, [
      (j) => {
        // La ligne : premier <div> après l'ouverture du <Fragment> de la boucle.
        const f = j.indexOf('<Fragment key={pIndex}>');
        if (f < 0) return null;
        const debut = j.indexOf('<div', f);
        const fin = finElement(j, debut);
        if (debut < 0 || fin < 0) return null;
        const o = ouvrante(j, debut);
        const interieur = j.slice(debut + o.length, fin - '</div>'.length);
        return (
          j.slice(0, debut) +
          '<FLien href={`/parcours/${p.id}`} ' +
          attrStyle(o) +
          '>' +
          interieur +
          '</FLien>' +
          j.slice(fin)
        );
      },
      (j) => {
        const e = enveloppe(j, 'Nouveau parcours');
        if (e === null || balise(j, e.debut) !== 'a') return null;
        const o = ouvrante(j, e.debut);
        const interieur = j.slice(e.debut + o.length, e.fin - '</a>'.length);
        return remplacer(j, e, `<FLien href="/parcours/nouveau" ${attrStyle(o)}>${interieur}</FLien>`);
      },
    ]);
  },
);

// ─── X04 · l'encart de refus « NIVEAU » (mobile) ─────────────────────────────

const FD_X04 = transformation(
  ['X04'],
  'FD_X04',
  'L’encart « NIVEAU » seul : le niveau exigé, ce qu’il faut faire et où aller viennent du refus du serveur (`LEVEL_REQUIRED`). « PLAN » est un compteur de paiement : il n’est pas monté.',
  (jsx) => {
    if (!jsx.includes('Cette action demande une identité vérifiée')) return null;
    const e = enveloppe(jsx, 'Cette action demande une identité vérifiée', 2);
    if (e === null) return null;
    let encart = jsx.slice(e.debut, e.fin);
    // Le titre, le texte et le bouton suivent le niveau requis ; « Voir les niveaux » garde son lien.
    encart = encart
      .replace(
        />Cette action demande une identité vérifiée</,
        '><FVal k="titre" tag="span" /><',
      )
      .replace(
        />Deux minutes avec votre pièce d'identité\. Elle n'est jamais conservée par la plateforme\.</,
        '><FVal k="texte" tag="span" /><',
      );
    const bouton = /<button style=\{\{[^{}]*\}\}>Vérifier mon identité<\/button>/.exec(encart);
    if (bouton === null) return null;
    encart = encart.replace(
      bouton[0],
      `<FAct k="monter" ${attrStyle(bouton[0])}>Vérifier mon identité</FAct>`,
    );
    return encart;
  },
);

export const ADAPTATIONS_FEUILLES_DESSINEES = [FD_J03, FD_J04, FD_J05I, FD_J07X, FD_J08A, FD_J01M, FD_X04];
