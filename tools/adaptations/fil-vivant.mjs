/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT G — « FIL VIVANT » : A02 (UNE PUBLICATION), ET LE RESTE DU FIL         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * A02 écrivait EN DUR la publication qu'elle montre — « Fatou Ndiaye », « Parcours
 * Santé · Lyon 7e · il y a 6 h », « 11 réponses · 4 soutiens » — et un compositeur
 * qui n'était pas un champ (« Écrire une réponse… » est un `<div>`, « Envoyer » un
 * bouton sans geste), un « Répondre » en `href="#"`, « GUIDES LIÉS · 3 » et « Lier
 * un guide » inertes, un « Choisir un réseau » qui ne choisit rien.
 *
 * Les pièces cédent la place à `PublicationVivante` et `GuidesLiesPublication`
 * (`apps/web/src/components/publication-vivante.tsx`, AJOUT autorisé par le
 * porteur), qui reprennent les valeurs EXACTES de la planche et lisent
 * `GET /posts/:id`. Le fournisseur (`PublicationProvider`) est posé par la page.
 *
 * ── CE QUE LES ADAPTATIONS COUPENT, ET COMMENT ───────────────────────────────
 *
 * Toujours en COMPTANT les balises (`finElement`, piège 3), jamais en cherchant un
 * `</div>` ; et jamais sur une mesure (piège 1) : les ancres sont des balises et des
 * textes que la planche écrit sur les deux cadres.
 */
import { finElement } from './reseau-vivant.mjs';

/** Le rond de retour du cadre mobile, dessiné en `<span>` : un lien vers le fil. */
const RETOUR_MOBILE =
  /<span style=\{\{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center" \}\}>(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" \/><\/svg>)<\/span>/;

const A02_DESKTOP = {
  screens: ['A02'],
  nom: 'A02_PUBLICATION_VIVANTE_DESKTOP',
  why: 'L’article, la liste des réponses et le compositeur de A02 deviennent `PublicationVivante` : la vraie publication (`GET /posts/:id`), de vrais champs et gestes (répondre, modifier, supprimer, réagir, enregistrer, déplacer vers un réseau) — la planche les écrivait en dur.',
  provides: [],
  apply(jsx) {
    const debut = jsx.indexOf('<article style={{ background: "#fff"');
    if (debut < 0) return { jsx, applied: false };
    // Le compositeur est le DERNIER enfant du <main> : un <div> en absolu, en bas.
    const compo = jsx.indexOf('<div style={{ position: "absolute", left: "0", right: "0", bottom: "0"', debut);
    if (compo < 0) return { jsx, applied: false };
    const finCompo = finElement(jsx, compo);
    if (finCompo < 0) return { jsx, applied: false };
    return {
      jsx: jsx.slice(0, debut) + '<PublicationVivante largeur="desktop" />' + jsx.slice(finCompo),
      applied: true,
    };
  },
};

const A02_GUIDES = {
  screens: ['A02'],
  nom: 'A02_GUIDES_LIES_VIVANTS',
  why: 'La carte « GUIDES LIÉS · 3 » lit les guides réellement liés à la publication ; « Lier un guide » ouvre la fenêtre A01G du composeur et enregistre par `PATCH /posts/:id`.',
  provides: [],
  apply(jsx) {
    const marque = jsx.indexOf('GUIDES LIÉS · 3');
    if (marque < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{ background: "#fff"', marque);
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return {
      jsx: jsx.slice(0, debut) + '<GuidesLiesPublication largeur="desktop" />' + jsx.slice(fin),
      applied: true,
    };
  },
};

const A02_MOBILE = {
  screens: ['A02'],
  nom: 'A02_PUBLICATION_VIVANTE_MOBILE',
  why: 'La carte, les réponses et la barre de saisie de A02 mobile deviennent `PublicationVivante` : la vraie publication, répondre, modifier/supprimer ses commentaires, guides liés — la planche ne dessinait ni « Répondre », ni les guides, ni un champ de saisie.',
  provides: [],
  apply(jsx) {
    // Le corps : le <div> défilant qui suit l'en-tête, jusqu'à la barre de saisie.
    const corps = jsx.indexOf('<div style={{ flex: "1", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>');
    if (corps < 0) return { jsx, applied: false };
    const finCorps = finElement(jsx, corps);
    if (finCorps < 0) return { jsx, applied: false };
    const barre = jsx.indexOf('<div style={{ padding: "10px 12px 28px", background: "#fff", borderTop: "1px solid #E6EBE9"', finCorps);
    if (barre < 0) return { jsx, applied: false };
    const finBarre = finElement(jsx, barre);
    if (finBarre < 0) return { jsx, applied: false };
    let out = jsx.slice(0, corps) + '<PublicationVivante largeur="mobile" />' + jsx.slice(finBarre);
    // Le titre de l'en-tête dit le TYPE de la publication, et le rond retour est un lien.
    out = out.replace(RETOUR_MOBILE, (_m, svg) => {
      const style = 'width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center"';
      return `<Link href="/accueil" aria-label="Retour au fil" style={{ ${style} }}>${svg}</Link>`;
    });
    out = out.replace('>Question</span></div>', '><TitrePublication /></span></div>');
    return { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_FIL_VIVANT = [A02_DESKTOP, A02_GUIDES, A02_MOBILE];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_FIL_VIVANT = {
  PublicationVivante: '@/components/publication-vivante',
  GuidesLiesPublication: '@/components/publication-vivante',
  TitrePublication: '@/components/publication-vivante',
};
