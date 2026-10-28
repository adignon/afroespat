// GÉNÉRÉ depuis docs/template/08 Compte.dc.html, section K02, cadre 420 px.
// AJOUT : feuille basse DÉRIVÉE du cadre d'ordinateur (voir tools/adaptations/feuilles-mobiles.mjs).
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 420 px, ce qui ne
// serait pas responsive.
import type { K02Data } from '../compte/data';

export function K02AjoutFeuille(props: K02Data) {
  const { demandeBloque, demandeTexte, membre, motifs, onDemandeTexte, onEnvoyerDemande } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "auto", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "calc(100vh - 24px)", overflow: "hidden" }} data-modal-panel="">
<button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "20px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "-10px", marginBottom: "-10px", backgroundClip: "content-box", flexShrink: "0" }}></button><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><h2 id="k02-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Ajouter {membre.prenom} aux contacts</h2></div></div><div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}><div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Comment vous connaissez-vous ?</div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: "0" }}>{(motifs ?? []).map((mo) => (<button key={mo.cle} type="button" onClick={mo.onChoisir} aria-pressed={mo.actif} data-demande-motif={mo.cle} style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", background: mo.fond, color: mo.texte, border: `1px solid ${mo.bord}`, fontFamily: "inherit", cursor: "pointer" }}>{mo.libelle}</button>))}</div></div><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Message (facultatif)</div><textarea value={demandeTexte} onChange={onDemandeTexte} placeholder="On s’est vues au repas partagé samedi !" aria-label="Message de votre demande" data-demande-message="" style={{ minHeight: "48px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5", width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", color: "#16211D", outline: "none" }} /></div><button type="button" onClick={onEnvoyerDemande} disabled={demandeBloque} data-demande-envoyer="" style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%", cursor: demandeBloque ? "default" : "pointer", opacity: demandeBloque ? ".55" : "1" }}>Envoyer la demande</button><div style={{ fontSize: "12px", color: "#5D6B66" }}>Menu ··· : Bloquer · Signaler</div></div></div>
    </>
  );
}
