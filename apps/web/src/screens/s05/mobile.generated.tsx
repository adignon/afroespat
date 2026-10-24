// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S05, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { ChampsOffre } from '@/components/services/champs-offre';
import { BoutonRetour } from '@/components/services/bouton-retour';
import { BoutonEnregistrer } from '@/components/services/bouton-enregistrer';
import type { S05Data } from './data';

export function S05Mobile(props: S05Data) {
  const { formulaire, offre, vivant } = props;

  return (
    <>

      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><BoutonRetour repli="/services/emploi" nom="Retour" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", border: "none", font: "inherit", padding: 0, cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></BoutonRetour><span style={{ fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{offre.mode === "detail" ? "Offre" : "Publier une offre"}</span><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><BoutonEnregistrer type="JOB" id={offre.id} taille={19} /></span></div>{offre.mode === "detail" ? (<div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ display: "flex", gap: "6px" }}><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{offre.genre}</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{offre.contrat}</span></div><h1 style={{ margin: "0", fontSize: "21px", fontWeight: "800" }}>{offre.titre}</h1><div style={{ fontSize: "13px", color: "#5D6B66" }}>{offre.entreprise} · {offre.ville}</div><div style={{ fontSize: "13.5px", lineHeight: "1.6" }}>{offre.description}</div></div>) : (<div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><ChampsOffre f={formulaire} mobile /></div>)}{offre.mode === "detail" ? (<div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}>{vivant.aLien ? <button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }} data-modal-open="S05L">Postuler</button> : null}<button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }} data-modal-open="S05R">Recommander</button></div>) : (<div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque} data-publier="" style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Publier l’offre</button></div>)}
      </main>
    </>
  );
}
