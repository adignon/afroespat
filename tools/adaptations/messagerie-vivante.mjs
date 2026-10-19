/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « MESSAGERIE VIVANTE » — M01, X01, X02, X04, K07 (heures calmes, résumé)║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le lot F rend vivants la messagerie, le temps réel, les notifications et la
 * recherche. Ce fichier tient ce que le JSX transcodé ne portait pas : un endroit
 * pour les gestes par bulle, un pied de fil, une croix sur le menu de la
 * conversation, et — plus bas — les gestes des notifications et de la recherche.
 *
 * Appliqué AVANT l'en-tête global et les zones de mise en page (voir
 * `generate-screens.mjs`) : ses motifs lisent le JSX des cadres tel que les
 * adaptations précédentes l'ont laissé, et l'en-tête global lit ensuite la barre.
 *
 * ⚠ ÉCARTS À LA MAQUETTE (AJOUTS, remontés au porteur) :
 *   · « Supprimer » / « Signaler » sous chaque bulle — `components/messagerie/actions-bulle` ;
 *   · le pied du fil (demande à accepter/ignorer, attente de réponse, « écrit… ») —
 *     `components/messagerie/pied-conversation` ;
 *   · une croix de fermeture sur le menu de la conversation, que la maquette ne dessine pas.
 */

/** Remplace la première occurrence d'un motif ; `null` si absent. */
function remplacerUn(jsx, motif, vers) {
  const m = motif.exec(jsx);
  if (m === null) return null;
  const neuf = typeof vers === 'function' ? vers(m) : vers;
  return jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length);
}

const FIL = '{(messages ?? []).map(';

/**
 * ── 1. LE FIL : REPÈRE, DÉFILEMENT, PIED ─────────────────────────────────────
 *
 * Le conteneur des bulles reçoit `data-fil-messages` (le front y défile vers le bas
 * quand un message arrive) ; sur 390 px il était en `overflow: hidden`, c'est-à-dire
 * qu'une conversation plus longue que l'écran était COUPÉE — il devient défilable.
 * Après lui, `{pied}` : demande de conversation, attente, « écrit… ».
 */
export const MV_FIL = {
  screens: ['M01'],
  nom: 'MV_FIL',
  why: 'Le fil de la conversation portait un conteneur muet : on y pose le repère de défilement, le défilement mobile (il était coupé), et le pied (demande à accepter, attente, « écrit… »).',
  provides: ['pied'],
  apply(jsx) {
    const i = jsx.indexOf(FIL);
    if (i < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{', i);
    const fin = jsx.indexOf('))}</div>', i);
    if (debut < 0 || fin < 0) return { jsx, applied: false };
    const finOuvrante = jsx.indexOf('>', debut);
    let ouvrante = jsx.slice(debut, finOuvrante);
    // Défilable : `overflow: "hidden"` coupait les longues conversations sur 390 px.
    ouvrante = ouvrante.replace('overflow: "hidden"', 'overflowY: "auto", minHeight: "0"');
    const neuf =
      '<div data-fil-messages=""' +
      ouvrante.slice('<div'.length) +
      jsx.slice(finOuvrante, fin + '))}</div>'.length) +
      '{pied ?? null}';
    return { jsx: jsx.slice(0, debut) + neuf + jsx.slice(fin + '))}</div>'.length), applied: true };
  },
};

/**
 * ── 2. L'HEURE DEVIENT UNE RANGÉE : HEURE (· Vu) + GESTE ────────────────────
 */
export const MV_BULLE_ACTIONS = {
  screens: ['M01'],
  nom: 'MV_BULLE_ACTIONS',
  why: 'Sous chaque bulle, « Supprimer » (la mienne) ou « Signaler » (celle de l’autre) : la maquette ne dessinait que l’heure.',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /\{m\.mention \? \(<>(<span style=\{\{ [^}]*\}\}>)\{m\.mention\}<\/span><\/>\) : null\}/,
      (m) =>
        '{m.mention || m.actions ? (<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>' +
        `{m.mention ? (${m[1]}{m.mention}</span>) : null}` +
        '{m.actions ?? null}</div>) : null}',
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── 3. UNE CROIX SUR LE MENU DE LA CONVERSATION ─────────────────────────────
 *
 * Le menu (carte de 300 px) n'avait ni croix ni poignée : il ne se fermait qu'au
 * voile, ce qu'un téléphone tenu d'une main rend peu évident. La croix est celle de
 * la fenêtre « Signaler » de X03 (même maquette), 40 px sur `#F2F5F4`, avec la
 * zone de clic de 44 px que les boutons ronds de cette maquette ont déjà.
 */
const CROIX =
  '<button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", font: "inherit", cursor: "pointer", flexShrink: "0", boxSizing: "content-box", padding: "2px", margin: "-2px", backgroundClip: "content-box" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>';

export const MV_MENU_CROIX = {
  screens: ['M01'],
  nom: 'MV_MENU_CROIX',
  why: 'Le menu de la conversation n’avait aucune fermeture visible : une croix, celle de la fenêtre « Signaler » de la même maquette.',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /<div style=\{\{ [^}]*\}\}>MENU DE LA CONVERSATION<\/div>/,
      (m) =>
        `<div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1" }}>${m[0]}</div>${CROIX}</div>`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── X02 · LES NOTIFICATIONS ─────────────────────────────────────────────────

const LIGNE_X02 =
  /<div (style=\{\{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 14px", borderRadius: "14px", background: n\.fond \}\})>(<span style=\{\{ width: "38px".*?\{n\.nonLu \? \(<><span style=\{\{[^}]*\}\}><\/span><\/>\) : null\})<\/div><\/Fragment>/s;

/**
 * Chaque ligne devient un lien vers sa cible (colonne `url`), et l'ouvrir la marque
 * lue. Sans cible, la ligne reste un bloc qui se marque lue au clic.
 */
export const MV_X02_LIGNES = {
  screens: ['X02'],
  nom: 'MV_X02_LIGNES',
  why: 'Les lignes de notification n’étaient pas cliquables : elles mènent à leur cible (colonne `url`) et se marquent lues à l’ouverture.',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      LIGNE_X02,
      (m) =>
        `<LigneNotification href={n.href ?? null} onOuvrir={n.onOuvrir ?? (() => undefined)} ${m[1].replace('style={{', 'style={{').replace(/^style=\{\{ (.*) \}\}$/s, 'style={{ $1 }}')}>${m[2]}</LigneNotification></Fragment>`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** « Tout marquer lu » : un lien mort (`href="#"`) devient le bouton qui écrit. */
export const MV_X02_TOUT_LIRE = {
  screens: ['X02'],
  nom: 'MV_X02_TOUT_LIRE',
  why: '« Tout marquer lu » était un lien mort (href="#") : il appelle POST /notifications/read, et s’éteint quand tout est lu.',
  provides: ['onToutLire', 'toutLuBloque'],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /<a href="#" style=\{\{ fontSize: "([\d.]+)px", fontWeight: "700" \}\}>Tout marquer lu<\/a>/,
      (m) => `<ToutMarquerLu onClick={onToutLire} desactive={toutLuBloque === true} taille="${m[1]}px" />`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** Le compteur de la cloche, que 12 §2.7 demande : près du titre, et en tête du mobile. */
export const MV_X02_COMPTEUR = {
  screens: ['X02'],
  nom: 'MV_X02_COMPTEUR',
  why: 'Le nombre de notifications non lues (12 §2.7) n’était affiché nulle part ; le téléphone n’avait ni titre de liste ni « Tout marquer lu ».',
  provides: ['nonLusTotal', 'onToutLire', 'toutLuBloque'],
  apply(jsx) {
    // Ordinateur et panneau : juste après le titre.
    let out = remplacerUn(
      jsx,
      /(<(?:h1|div) style=\{\{[^}]*\}\}>Notifications<\/(?:h1|div)>)/,
      (m) => `${m[1]}<CompteurNonLues n={nonLusTotal} />`,
    );
    if (out !== null) return { jsx: out, applied: true };
    // Panneau : le titre est le premier enfant de la rangée, le bouton le suivant.
    if (jsx.includes('>Notifications</') && jsx.includes('<ToutMarquerLu ')) {
      return {
        jsx: jsx.replace('<ToutMarquerLu ', '<CompteurNonLues n={nonLusTotal} /><ToutMarquerLu '),
        applied: true,
      };
    }
    // Téléphone : une rangée au-dessus de la liste (le titre est dans la barre).
    out = remplacerUn(
      jsx,
      /(<div style=\{\{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "6px"[^}]*\}\}>\{\(lignes \?\? \[\]\)\.map)/,
      (m) =>
        '<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: "0" }}><CompteurNonLues n={nonLusTotal} /><ToutMarquerLu onClick={onToutLire} desactive={toutLuBloque === true} taille="13px" /></div>' +
        m[1],
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** La liste vide dit qu'elle est vide, au lieu d'un cadre blanc. */
export const MV_X02_VIDE = {
  screens: ['X02'],
  nom: 'MV_X02_VIDE',
  why: 'Sans notification, la liste était un cadre blanc muet : elle dit « Aucune notification ».',
  provides: [],
  apply(jsx) {
    const i = jsx.indexOf('{(lignes ?? []).map(');
    if (i < 0) return { jsx, applied: false };
    const fin = jsx.indexOf('))}', i);
    if (fin < 0) return { jsx, applied: false };
    const apres = fin + '))}'.length;
    return {
      jsx:
        jsx.slice(0, apres) +
        '{(lignes ?? []).length === 0 ? <EtatVide texte="Aucune notification pour le moment." /> : null}' +
        jsx.slice(apres),
      applied: true,
    };
  },
};

// ─── X01 · LA RECHERCHE ──────────────────────────────────────────────────────

/**
 * Les quatre pastilles mortes (« Lyon ▾ », « Pays ▾ », « Période ▾ », « État ▾ »)
 * deviennent les vrais filtres du serveur : ville, rayon, pays, période, état. Sur
 * 390 px, la maquette ne dessine pas cette rangée du tout : elle est posée sous les
 * pastilles de type, défilable.
 */
export const MV_X01_FILTRES = {
  screens: ['X01'],
  nom: 'MV_X01_FILTRES',
  why: 'Les pastilles « Lyon ▾ / Pays ▾ / Période ▾ / État ▾ » étaient des <span> : ce sont les filtres ville, rayon, pays, période, état que le serveur traite. Le téléphone ne les dessinait pas.',
  provides: ['filtresAvances', 'typeActif'],
  apply(jsx) {
    // Ordinateur : la rangée de quatre pastilles.
    let out = remplacerUn(
      jsx,
      /<div style=\{\{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: "0" \}\}>(?:<span style=\{\{ padding: "8px 13px"[^}]*\}\}>[^<]*▾<\/span>){4}<\/div>/,
      '<FiltresRecherche requete={requete} type={typeActif} valeurs={filtresAvances} mobile={false} />',
    );
    if (out !== null) return { jsx: out, applied: true };
    // Téléphone : sous les pastilles de type, avant la colonne de résultats.
    out = remplacerUn(
      jsx,
      /(\)\)\}<\/div>)(<div style=\{\{ flexGrow: "1", overflow: "visible", padding: "12px 16px")/,
      (m) =>
        `${m[1]}<FiltresRecherche requete={requete} type={typeActif} valeurs={filtresAvances} mobile />${m[2]}`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** Le fait écrit sous le titre d'une carte, composé par le serveur. */
export const MV_X01_SOUSLIGNE = {
  screens: ['X01'],
  nom: 'MV_X01_SOUSLIGNE',
  why: 'Les sous-lignes des cartes (« 84 utiles », « 14 réponses · Ouverte · Lyon », « 620 € ») n’avaient aucune source : le serveur les compose maintenant (`SearchHit.subline`).',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /<div style=\{\{ fontSize: "12px", color: "#8A958F" \}\}>\{r\.extrait\}<\/div>/,
      (m) =>
        '{r.sousLigne ? (<div style={{ fontSize: "12px", fontWeight: "600", color: "#5D6B66" }}>{r.sousLigne}</div>) : null}' +
        m[0],
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * L'état vide, la mémoire et le signal « zéro résultat ».
 *
 *   · `POST /search/zero` part quand le serveur propose « Poser la question » ;
 *   · les recherches récentes (navigateur) s'affichent tant que rien n'est tapé ;
 *   · une recherche qui a donné des résultats est mémorisée.
 */
export const MV_X01_MEMOIRE = {
  screens: ['X01'],
  nom: 'MV_X01_MEMOIRE',
  why: 'Aucun résultat ne remontait au serveur (POST /search/zero), la page ne gardait aucune recherche récente, et rien ne la mémorisait.',
  provides: ['filtresAvances'],
  apply(jsx) {
    let out = jsx;
    let fait = false;
    const zero = remplacerUn(
      out,
      /\{vide\.bouton === "" \? null : \((<a href=\{vide\.href\}[^}]*\}\}>\{vide\.bouton\}<\/a>)\)\}/,
      (m) =>
        `{vide.bouton === "" ? null : (<><SignalerRechercheVide requete={requete} ville={filtresAvances?.ville ?? null} />${m[1]}</>)}`,
    );
    if (zero !== null) {
      out = zero;
      fait = true;
    }
    const memoire = remplacerUn(
      out,
      /\{vide === null \? null : \(/,
      (m) =>
        '<MemoriserRecherche requete={requete} nbResultats={(resultats ?? []).length} /><RecherchesRecentes requete={requete} />' +
        m[0],
    );
    if (memoire !== null) {
      out = memoire;
      fait = true;
    }
    return fait ? { jsx: out, applied: true } : { jsx, applied: false };
  },
};

/**
 * Le titre de la page sur 390 px. La maquette n'y écrit que la requête dans le
 * champ : un titre VISIBLE serait un titre inventé (c'est ce qui a coûté A01), mais
 * une page sans <h1> est muette pour un lecteur d'écran. Il est donc posé, masqué
 * à l'œil, avec les mêmes mots que le titre de l'ordinateur.
 */
export const MV_X01_H1_MOBILE = {
  screens: ['X01'],
  nom: 'MV_X01_H1_MOBILE',
  why: 'Le cadre mobile n’avait aucun <h1> : il est posé, masqué à l’œil (rien de dessiné en plus), avec les mots du titre d’ordinateur.',
  provides: [],
  apply(jsx) {
    if (jsx.includes('<h1')) return { jsx, applied: false };
    const out = remplacerUn(
      jsx,
      /(<div style=\{\{ flexGrow: "1", overflow: "visible", padding: "12px 16px"[^}]*\}\}>)/,
      (m) =>
        `${m[1]}<h1 style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Résultats pour « {requete} »</h1>`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_MESSAGERIE_VIVANTE = [
  MV_X01_FILTRES,
  MV_X01_SOUSLIGNE,
  MV_X01_MEMOIRE,
  MV_X01_H1_MOBILE,
  MV_FIL,
  MV_BULLE_ACTIONS,
  MV_MENU_CROIX,
  MV_X02_LIGNES,
  MV_X02_TOUT_LIRE,
  MV_X02_COMPTEUR,
  MV_X02_VIDE,
];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_MESSAGERIE_VIVANTE = {
  LigneNotification: '@/components/messagerie/notifications',
  ToutMarquerLu: '@/components/messagerie/notifications',
  CompteurNonLues: '@/components/messagerie/notifications',
  EtatVide: '@/components/etat-vide',
  FiltresRecherche: '@/components/messagerie/filtres-recherche',
  SignalerRechercheVide: '@/components/messagerie/recherche-vivante',
  MemoriserRecherche: '@/components/messagerie/recherche-vivante',
  RecherchesRecentes: '@/components/messagerie/recherche-vivante',
};
