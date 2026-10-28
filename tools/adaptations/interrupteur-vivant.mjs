/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT W7 — L'INTERRUPTEUR DES PLANCHES ET LE CHAMP DE CHOIX DE O04           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le commutateur “Je suis disponible pour aider” s'affiche mal »
 * (capture jointe : la pastille blanche déborde, le rendu est déformé ; il suggère
 * de « mettre un div autour du switch »), puis « le champ de choix de Compétences
 * et Langues s'affiche tout en bas de la page ».
 *
 * ── 1. L'INTERRUPTEUR : UNE ÉLLIPSE, PAS UNE PISTE ──────────────────────────────
 *
 * Les planches dessinent la piste : un bouton 48 × 28, rayon 999. La cible tactile
 * de 44 px (T1 §2.3) était obtenue par `padding: 8px 0` + `box-sizing: content-box`
 * + `background-clip: content-box` (règles `TOUCH_TARGET_ADAPTATIONS`). MESURÉ au
 * navigateur : la boîte de contenu garde bien 48 × 28, MAIS le rayon de la zone de
 * peinture se réduit de la valeur du remplissage, AXE PAR AXE. Le rayon 999 est
 * d'abord ramené à 22 px (la moitié de 44), puis la zone de contenu en retire 8 en
 * vertical et 0 en horizontal : les extrémités de la piste deviennent des ellipses
 * de 22 × 14 au lieu de demi-cercles de 14. La piste est un ovale aplati, et la
 * pastille ronde de 22 px, posée à 3 px du bord, frôle le contour (capture agrandie :
 * elle « déborde »).
 *
 * LA CORRECTION EST CELLE QUE LE PORTEUR SUGGÈRE : un enveloppe. Le bouton devient la
 * CIBLE (48 × 44, transparente, `padding: 0`, rayon 22) ; la PISTE est un `<span>`
 * de 48 × 28 en `border-box`, `border-radius: 999px`, de sorte que son rayon n'est
 * plus jamais réduit par un remplissage ; la pastille est positionnée par rapport à
 * LA PISTE (`top: 3px`, plus de 11 px de compensation). Le bouton garde son rôle
 * `switch`, son `aria-checked`, son nom, et le focus visible global (2 px, T1 §6).
 *
 * Les trois interrupteurs bouton de la planche (O04 ordinateur, A14 ordinateur et
 * téléphone) sont réécrits ICI, sur le JSX que la règle de la cible vient de
 * produire. L'interrupteur de O04 téléphone n'était qu'un `<span>` inerte : il
 * reçoit le même bouton, branché sur les mêmes données que l'ordinateur.
 *
 * ── 2. LE PANNEAU DE CHOIX : AUCUN PARENT POSITIONNÉ ───────────────────────────
 *
 * `ChoixReferentiel` rend son panneau en `position: absolute; top: calc(100% + 4px)`,
 * c'est-à-dire sous le plus proche ancêtre POSITIONNÉ. La boîte que la planche dessine
 * autour du champ n'en est pas un : l'ancêtre était le cadre entier, et le panneau
 * s'ouvrait sous la page (mesuré : top 1004 px sur une fenêtre de 1000). Les deux
 * boîtes `{competencesChamp}` et `{languesChamp}` reçoivent `position: relative`.
 */

/** Le bouton-cible et la piste, avec la pastille DANS la piste. */
function interrupteur({ onClick, attrs, piste, gauche }) {
  const ouvrant = onClick === null ? '<button type="button"' : `<button type="button" onClick={${onClick}}`;
  return (
    `${ouvrant} style={{ width: "48px", height: "44px", padding: "0", border: "none", background: "transparent", ` +
    `display: "flex", alignItems: "center", flexShrink: "0", cursor: "pointer", borderRadius: "22px" }}${attrs}>` +
    `<span data-interrupteur-piste="" style={{ position: "relative", display: "block", boxSizing: "border-box", width: "48px", ` +
    `height: "28px", borderRadius: "999px", backgroundColor: ${piste} }}>` +
    `<span style={{ position: "absolute", top: "3px", left: ${gauche}, width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span>` +
    '</span></button>'
  );
}

const MOTIF_BOUTON =
  /<button onClick=\{(\w+)\} style=\{\{ width: "48px", height: "28px", borderRadius: "999px", border: "none", backgroundColor: (\w+), position: "relative", cursor: "pointer", padding: "8px 0", boxSizing: "content-box", backgroundClip: "content-box" \}\}([^>]*)><span style=\{\{ position: "absolute", top: "11px", left: (\w+), width: "22px", height: "22px", borderRadius: "999px", background: "#fff" \}\}><\/span><\/button>/g;

/** L'interrupteur INERTE de O04 téléphone : un span 48 × 28, sa pastille à 23 px. */
const MOTIF_INERTE =
  '<span style={{ width: "48px", height: "28px", borderRadius: "999px", background: "#16785E", position: "relative" }}><span style={{ position: "absolute", top: "3px", left: "23px", width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span></span>';

const INTERRUPTEUR_PISTE = {
  screens: ['O04', 'A14'],
  nom: 'INTERRUPTEUR_PISTE',
  why: 'L’interrupteur 48 × 28 : une cible de 44 px autour d’une VRAIE piste (demi-cercles), pastille dans la piste.',
  // O04 téléphone gagne le bouton branché ; ces prises existent déjà dans OnboardingVals.
  provides: ['toggleHelp', 'help', 'helpTrack', 'helpKnob'],
  apply(jsx, { section }) {
    let out = jsx;
    let applied = false;
    out = out.replace(MOTIF_BOUTON, (_tout, onClick, piste, attrs, gauche) => {
      applied = true;
      return interrupteur({ onClick, attrs, piste, gauche });
    });
    if (section === 'O04' && out.includes(MOTIF_INERTE)) {
      applied = true;
      out = out.replace(
        MOTIF_INERTE,
        interrupteur({
          onClick: 'toggleHelp',
          attrs: ' role="switch" aria-checked={help} aria-label="Disponible pour aider"',
          piste: 'helpTrack',
          gauche: 'helpKnob',
        }),
      );
    }
    return { jsx: out, applied };
  },
};

/** Le champ de O04 : la boîte grise qui reçoit le contrôle devient le repère du panneau. */
const BOITE_CHAMP = (nom) =>
  `<div style={{ minHeight: "48px", padding: "6px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>{${nom}}</div>`;

const O04_PANNEAU_ANCRE = {
  screens: ['O04'],
  nom: 'O04_PANNEAU_ANCRE',
  why: 'Les boîtes « Compétences » et « Langues » de O04 deviennent le repère (`position: relative`) du panneau de choix.',
  provides: [],
  apply(jsx) {
    let out = jsx;
    let applied = false;
    for (const nom of ['competencesChamp', 'languesChamp']) {
      const avant = BOITE_CHAMP(nom);
      if (!out.includes(avant)) continue;
      applied = true;
      out = out.replace(avant, avant.replace('alignItems: "center" }}', 'alignItems: "center", position: "relative" }}'));
    }
    return { jsx: out, applied };
  },
};

export const ADAPTATIONS_INTERRUPTEUR_VIVANT = [INTERRUPTEUR_PISTE, O04_PANNEAU_ANCRE];

export const AJOUTS_INTERRUPTEUR_VIVANT = {};
