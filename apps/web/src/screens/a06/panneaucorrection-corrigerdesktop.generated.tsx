// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Texte } from '@/components/valeurs-vives';
import type { CorrectionPanneauView } from './data';

export function A06PanneauCorrectionCorrigerDesktop({ correction }: { readonly correction: CorrectionPanneauView }) {
  return (
    <>
<button type="button" onClick={correction.onFermer} aria-label="Fermer sans envoyer" data-correction-voile="" style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.45)", border: "none", padding: "0", zIndex: 70, cursor: "pointer" }}></button>
      <div style={{ position: "fixed", top: "0", right: "0", bottom: "0", width: "480px", maxWidth: "100vw", overflowY: "auto", zIndex: 71, background: "#fff", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Proposer une correction</span><button type="button" onClick={correction.onFermer} aria-label="Fermer" data-correction-fermer="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Passage sélectionné</div>
          <div data-correction-passage="" style={{ marginTop: "-8px", background: "#F2F5F4", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", color: "#5D6B66" }}>{correction.passage}</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Remplacer par</div>
          <textarea value={correction.remplacement} onChange={correction.onRemplacement} aria-label="Le texte que vous proposez à la place" data-correction-remplacement="" style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", margin: "0", marginTop: "-8px", border: "1.5px solid #16785E", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", minHeight: "76px" }} />
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Pourquoi cette correction ? <span style={{ color: "#B4581F" }}>*</span></div>
          <textarea value={correction.motif} onChange={correction.onMotif} aria-label="Pourquoi cette correction ? (obligatoire)" data-correction-motif="" required aria-required="true" minLength={20} style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", margin: "0", marginTop: "-8px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "14px", fontSize: "14px" }} />
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Source <span style={{ color: "#8A958F", fontWeight: "500" }}>(facultatif)</span></div>
          <input type="url" inputMode="url" autoComplete="off" placeholder="https://" aria-label="Une source qui appuie votre correction (facultatif)" value={correction.source} onChange={correction.onSource} data-correction-source="" style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", outline: "none", marginTop: "-8px", height: "46px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "0 14px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "inherit" }} />
          <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#F3F7F5", borderRadius: "14px", padding: "12px 14px", fontSize: "12.5px", color: "#0F5C48", fontWeight: "600" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><Texte id="correctionDelai" /></div>
          {correction.accuse === null ? null : (<div role="status" data-correction-accuse="" style={{ background: "#16211D", color: "#fff", borderRadius: "16px", padding: "14px 16px", fontSize: "13px", fontWeight: "600", lineHeight: "1.5" }}>{correction.accuse}</div>)}<div style={{ flex: "1" }}></div>
          <div style={{ display: "flex", gap: "8px" }}><button type="button" onClick={correction.onFermer} data-correction-annuler="" style={{ height: "50px", padding: "0 20px", borderRadius: "14px", background: "#F2F5F4", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer" }}>Annuler</button><button type="button" onClick={correction.onEnvoyer} disabled={!correction.peutEnvoyer} data-correction-envoyer="" style={{ flex: "1", height: "50px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: correction.peutEnvoyer ? "pointer" : "default", opacity: correction.peutEnvoyer ? "1" : ".55" }}>Envoyer la proposition</button></div>
      </div>
    </>
  );
}
