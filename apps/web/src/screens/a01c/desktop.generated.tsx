// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A01C, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A01CData } from './data';

export function A01CDesktop(props: A01CData) {
  const { thread } = props;

  return (
    <>

      
      <div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div>
      <div style={{ position: "fixed", left: "50%", top: "40px", bottom: "40px", transform: "translateX(-50%)", width: "720px", background: "#fff", borderRadius: "28px", display: "flex", flexDirection: "column", overflow: "hidden" }} data-modal-panel="">
        <div style={{ height: "68px", padding: "0 20px 0 24px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #EAEEEC", flexShrink: "0" }}><h2 id="a01c-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800", letterSpacing: "-0.4px", flex: "1" }}>Commentaires <span style={{ color: "#8A958F", fontWeight: "700" }}>· 8</span></h2><span style={{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "12px", padding: "3px" }}><span style={{ padding: "7px 12px", borderRadius: "9px", background: "#fff", fontSize: "12.5px", fontWeight: "700" }}>Pertinents</span><span style={{ padding: "7px 12px", borderRadius: "9px", fontSize: "12.5px", fontWeight: "700", color: "#5D6B66" }}>Récents</span></span><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
        <div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", background: "#F6F8F7", borderRadius: "18px", padding: "14px" }}><span style={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>AD</span><div style={{ minWidth: "0" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontSize: "13.5px", fontWeight: "700" }}>Amina Diallo</span><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "10.5px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px" }}>Victoire</span></div><div style={{ fontSize: "13px", color: "#5D6B66", lineHeight: "1.5", marginTop: "3px" }}>Attestation de virement irrévocable validée ce matin. Merci à la communauté…</div></div></div>
          {(thread ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><div style={{ display: "flex", gap: "12px", paddingLeft: c.indent }}>
              <span style={{ width: c.av, height: c.av, borderRadius: "999px", background: c.bg, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{c.i}</span>
              <div style={{ flex: "1", minWidth: "0" }}>
                <div style={{ background: "#F6F8F7", borderRadius: "16px", padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}><span style={{ fontSize: "13.5px", fontWeight: "700" }}>{c.name}</span><svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg><span style={{ fontSize: "11.5px", color: "#8A958F" }}>{c.phase}</span>{c.author ? (<><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px" }}>Auteur</span></>) : null}</div><div style={{ fontSize: "13.5px", lineHeight: "1.55", marginTop: "3px" }}>{c.text}</div></div>
                <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "12px", color: "#8A958F", marginTop: "6px", paddingLeft: "4px" }}><span>{c.time}</span><span style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: "700", color: c.likeFg }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7" /></svg>{c.likes}</span>{c.canReply ? (<><a href="#" style={{ fontWeight: "700", color: "#5D6B66" }}>Répondre</a></>) : null}<a href="#" style={{ fontWeight: "600", color: "#8A958F" }}>Signaler</a></div>
              </div>
            </div></Fragment>
))}
          <a href="#" style={{ fontSize: "12.5px", fontWeight: "700", paddingLeft: "48px" }}>Voir 3 autres commentaires</a>
        </div>
        <div style={{ flexShrink: "0", borderTop: "1px solid #EAEEEC", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#5D6B66", background: "#F2F5F4", borderRadius: "12px", padding: "8px 12px" }}>En réponse à <strong style={{ color: "#16211D" }}>Sandra M.</strong><span style={{ flex: "1" }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>AD</span><div style={{ flex: "1", height: "46px", borderRadius: "999px", background: "#F2F5F4", padding: "0 18px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "#8A958F" }}>Écrire un commentaire…</div><button style={{ height: "46px", padding: "0 20px", borderRadius: "999px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700" }}>Envoyer</button></div>
        </div>
      </div>
    
    </>
  );
}
