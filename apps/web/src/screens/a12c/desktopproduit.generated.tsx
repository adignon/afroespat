// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A12T, cadre 760 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 760 px, ce qui ne
// serait pas responsive.
import { ChampsContribution } from '@/components/champs-contribution';
import type { VilleData } from '../villes/data';

export function A12CDesktopProduit(props: VilleData) {
  const { ville, vivant } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.5)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "540px", background: "#fff", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(100vh - 48px)", overflow: "hidden" }} data-modal-panel=""><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><div style={{ fontSize: "12px", fontWeight: "700", color: "#8A958F" }}>Étape 2 sur 2 · {ville.nom}</div><h2 id="a12c-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px", marginTop: "2px" }}>Produit du pays</h2></div><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "2px", font: "inherit", cursor: "pointer", boxSizing: "content-box", margin: "-2px", backgroundClip: "content-box" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div><div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}><ChampsContribution c={vivant.contribution} ville={ville.nom} /></div><div style={{ display: "flex", gap: "8px" }}><button type="button" onClick={vivant.contribution.onRetour} data-contribution-bouton="Retour" style={{ height: "50px", padding: "0 20px", borderRadius: "14px", background: "#F2F5F4", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer" }}>Retour</button><button type="button" onClick={vivant.contribution.onPublier} disabled={vivant.contribution.bloque} data-contribution-bouton="Publier" style={{ flex: "1", height: "50px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer", opacity: vivant.contribution.bloque ? ".55" : "1" }}>Publier</button></div></div>
    </>
  );
}
