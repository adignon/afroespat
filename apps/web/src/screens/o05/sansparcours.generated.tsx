// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O05, cadre 700 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 700 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { O05Data } from '../onboarding/data';

export function O05SansParcours(props: O05Data) {
  const { events, lieu, onAccueil, onDemander } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", display: "flex", flexDirection: "column", padding: "40px", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ width: "100%", maxWidth: "520px", margin: "48px auto 0", display: "flex", flexDirection: "column", gap: "14px" }}>
        <h1 style={{ margin: "0", fontSize: "32px", fontWeight: "800", letterSpacing: "-1px" }}>Bienvenue{lieu.ville === "" ? "" : ` à ${lieu.ville}`}</h1>
        <div style={{ background: "#0F5C48", borderRadius: "22px", padding: "20px", color: "#fff", display: "flex", alignItems: "center", gap: "14px" }}><span style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>{lieu.initiales}</span><span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "16px", fontWeight: "700" }}>{lieu.reseau}</span><span style={{ display: "block", fontSize: "12.5px", color: "#A9CDBF" }}>{lieu.membres}</span></span>{lieu.rejoint ? (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg>) : null}</div>
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>PROCHAINS ÉVÉNEMENTS</div>
          {(events ?? []).map((e, eIndex) => (
<Fragment key={eIndex}><div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}><div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "#E3F0EB", color: "#0F5C48", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><span style={{ fontSize: "15px", fontWeight: "800", lineHeight: "1" }}>{e.d}</span><span style={{ fontSize: "9px", fontWeight: "700" }}>{e.m}</span></div><div><div style={{ fontSize: "13.5px", fontWeight: "700" }}>{e.t}</div><div style={{ fontSize: "12px", color: "#8A958F" }}>{e.s}</div></div></div></Fragment>
))}
{(events ?? []).length === 0 ? (<div style={{ fontSize: "13px", color: "#8A958F", marginTop: "12px" }}>Aucun événement annoncé dans votre ville pour le moment.</div>) : null}
        </div>
        {lieu.parrain === null ? null : (<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px", display: "flex", alignItems: "center", gap: "12px" }}><span style={{ width: "46px", height: "46px", borderRadius: "999px", background: "#0F5C48", color: "#fff", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{lieu.parrain.initiales}</span><span style={{ flex: "1" }}><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", fontWeight: "700" }}>{lieu.parrain.nom}<svg width="14" height="14" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg></span><span style={{ display: "block", fontSize: "12px", color: "#8A958F" }}>{lieu.parrain.detail}</span></span><button type="button" onClick={onDemander} style={{ height: "40px", padding: "0 18px", borderRadius: "999px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700" }}>Demander</button></div>)}
        <button type="button" onClick={onAccueil} style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }}>Aller à l'accueil</button>
      </div>
    
      </main>
      </div>
    </>
  );
}
