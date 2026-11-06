/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT E1 — COMPORTEMENT TRANSVERSE (messagerie paginée, boutons morts J09/J01E)║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Trois retouches du JSX transcodé, regroupées ici pour ne pas alourdir les
 * fichiers des autres lots :
 *
 *   · M01 — « Messages plus anciens » en tête du fil et « Voir plus de conversations »
 *     sous la liste : la messagerie ne lisait que les 20 premières conversations et les
 *     20 derniers messages, sans moyen d'aller plus loin ;
 *   · J09 (fiche d'un parcours public, ordinateur) — le bouton « Je suis bloqué·e » du
 *     panneau n'avait aucun geste : la fiche est celle d'AUTRUI, il n'y a pas de
 *     parcours à débloquer. Le bouton est retiré de ce cadre ;
 *   · J01E (parcours abouti) — « Aider le suivant » n'avait aucun geste : il mène à
 *     `/entraide/aider`.
 *
 * Aucune couleur nouvelle : celles de la maquette (`#EEF2F0`, `#0F5C48`).
 */

function remplacerUn(jsx, motif, vers) {
  const m = motif.exec(jsx);
  if (m === null) return null;
  const neuf = typeof vers === 'function' ? vers(m) : vers;
  return jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length);
}

const BOUTON_PLUS =
  'type="button" disabled={pagination === true} style={{ font: "inherit", alignSelf: "center", border: "none", background: "#EEF2F0", color: "#0F5C48", fontSize: "12.5px", fontWeight: "700", borderRadius: "999px", padding: "0 16px", minHeight: "44px", cursor: "pointer", flexShrink: "0" }}';

export const E1_M01_PLUS_ANCIENS = {
  screens: ['M01'],
  nom: 'E1_M01_PLUS_ANCIENS',
  why: 'Le fil ne montrait que les derniers messages : « Messages plus anciens » charge la page précédente (curseur).',
  provides: ['onPlusAnciens', 'pagination'],
  apply(jsx) {
    const marque = '{(messages ?? []).map(';
    const i = jsx.indexOf(marque);
    if (i < 0) return { jsx, applied: false };
    const bouton =
      `{onPlusAnciens ? (<button onClick={onPlusAnciens} data-plus-anciens="" ${BOUTON_PLUS}>{pagination === true ? "Chargement…" : "Messages plus anciens"}</button>) : null}`;
    return { jsx: jsx.slice(0, i) + bouton + jsx.slice(i), applied: true };
  },
};

export const E1_M01_PLUS_CONVERSATIONS = {
  screens: ['M01'],
  nom: 'E1_M01_PLUS_CONVERSATIONS',
  why: 'La liste ne montrait que les premières conversations : « Voir plus de conversations » charge la page suivante.',
  provides: ['onPlusConversations', 'pagination'],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /\)\)\}(<div style=\{\{ padding: "12px 6px 6px" \}\}><div style=\{\{[^}]*\}\}>DEMANDES)/,
      (m) =>
        `))}{onPlusConversations ? (<button onClick={onPlusConversations} data-plus-conversations="" ${BOUTON_PLUS}>{pagination === true ? "Chargement…" : "Voir plus de conversations"}</button>) : null}${m[1]}`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const E1_J09_FICHE_SANS_BLOQUE = {
  screens: ['J09'],
  nom: 'E1_J09_FICHE_SANS_BLOQUE',
  why: 'Sur la fiche publique d’un autre membre, « Je suis bloqué·e » n’a aucun parcours à débloquer : le bouton mort est retiré de ce cadre.',
  provides: [],
  apply(jsx) {
    if (!jsx.includes('{membre.prenom}')) return { jsx, applied: false };
    const out = remplacerUn(jsx, /<button style=\{\{[^}]*\}\}>Je suis bloqué·e<\/button>/, '');
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const E1_J01E_AIDER_LE_SUIVANT = {
  screens: ['J01E'],
  nom: 'E1_J01E_AIDER_LE_SUIVANT',
  why: '« Aider le suivant » (parcours abouti) n’avait aucun geste : il mène à l’entraide, section « Aider ».',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /<button style=\{\{ ([^}]*) \}\}>Aider le suivant<\/button>/,
      (m) =>
        `<a href="/entraide/aider" style={{ ${m[1]}, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Aider le suivant</a>`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_TRANSVERSE_E1 = [
  E1_M01_PLUS_ANCIENS,
  E1_M01_PLUS_CONVERSATIONS,
  E1_J09_FICHE_SANS_BLOQUE,
  E1_J01E_AIDER_LE_SUIVANT,
];
