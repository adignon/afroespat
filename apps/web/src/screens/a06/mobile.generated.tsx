// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import Link from 'next/link';
import type { A06Data } from './data';

export function A06Mobile(props: A06Data) {
  const { guide, propositionDepliee, propositionRepliee, propositionsCompte } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ padding: "52px 16px 12px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><Link href={guide.href} aria-label="Revenir au guide" data-a06-retour="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></Link><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>Propositions reçues</h1></div><div style={{ display: "flex", gap: "6px", marginTop: "12px" }}><span style={{ padding: "8px 13px", borderRadius: "999px", background: "#16785E", color: "#fff", fontSize: "12.5px", fontWeight: "700" }}>En attente · {propositionsCompte.attente}</span><span style={{ padding: "8px 13px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", fontSize: "12.5px", fontWeight: "700" }}>Acceptées · {propositionsCompte.acceptees}</span><span style={{ padding: "8px 13px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", fontSize: "12.5px", fontWeight: "700" }}>Refusées</span></div></div>
      <div style={{ flex: "1", padding: "14px 16px", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "30px", height: "30px", borderRadius: "999px", background: propositionDepliee.bg, color: "#fff", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{propositionDepliee.i}</span><span style={{ fontSize: "13.5px", fontWeight: "700", flex: "1" }}>{propositionDepliee.proposant}</span><span style={{ background: "#FBE3D4", color: "#B4581F", fontSize: "11px", fontWeight: "700", padding: "4px 9px", borderRadius: "999px" }}>{propositionDepliee.delai}</span></div>
          <div style={{ background: "#F6F8F7", borderRadius: "14px", padding: "12px", marginTop: "12px" }}><div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>AVANT</div><div style={{ fontSize: "13.5px", lineHeight: "1.55", marginTop: "4px" }}>quel que soit leur pays d'origine, dès <span style={{ background: "#EDF1EF", textDecoration: "line-through", color: "#5D6B66" }}>l'obtention</span> du VLS-TS</div></div>
          <div style={{ background: "#EFF7F3", borderRadius: "14px", padding: "12px", marginTop: "8px" }}><div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#16785E" }}>APRÈS</div><div style={{ fontSize: "13.5px", lineHeight: "1.55", marginTop: "4px" }}>quel que soit leur pays d'origine, dès <span style={{ background: "#CFE3DA", borderRadius: "3px" }}>la validation</span> du VLS-TS <span style={{ background: "#CFE3DA", borderRadius: "3px" }}>sur le site de l'ANEF</span></div></div>
          <div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "10px" }}><strong style={{ color: "#16211D" }}>Motif :</strong> {propositionDepliee.motif}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}><button type="button" onClick={propositionDepliee.onAccepter} disabled={!propositionDepliee.decidable} data-proposition-accepter="" style={{ height: "44px", borderRadius: "12px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", cursor: !propositionDepliee.decidable ? "default" : "pointer", opacity: propositionDepliee.decidable ? "1" : ".55" }}>Accepter</button><button type="button" onClick={propositionDepliee.onRefuser} disabled={!propositionDepliee.decidable} data-proposition-refuser="" style={{ height: "44px", borderRadius: "12px", background: "#F2F5F4", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", color: "#5D6B66", cursor: !propositionDepliee.decidable ? "default" : "pointer", opacity: propositionDepliee.decidable ? "1" : ".55" }}>Refuser</button></div>
          <button type="button" onClick={propositionDepliee.onAmender} disabled={!propositionDepliee.decidable} data-proposition-amender="" style={{ width: "100%", height: "42px", marginTop: "8px", borderRadius: "12px", background: "#fff", border: "1.5px solid #CFE3DA", color: "#0F5C48", font: "inherit", fontSize: "13px", fontWeight: "700", cursor: !propositionDepliee.decidable ? "default" : "pointer", opacity: propositionDepliee.decidable ? "1" : ".55" }}>Accepter en modifiant</button>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "16px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "30px", height: "30px", borderRadius: "999px", background: propositionRepliee.bg, color: "#fff", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{propositionRepliee.i}</span><span style={{ fontSize: "13.5px", fontWeight: "700", flex: "1" }}>{propositionRepliee.proposant}</span><span style={{ background: "#FBE3D4", color: "#B4581F", fontSize: "11px", fontWeight: "700", padding: "4px 9px", borderRadius: "999px" }}>{propositionRepliee.delai}</span></div><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "8px" }}>{propositionRepliee.motif}</div></div>
      </div>
    
      </main>
    </>
  );
}
