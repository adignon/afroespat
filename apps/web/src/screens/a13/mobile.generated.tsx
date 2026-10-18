// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A13, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import type { A13Data } from './data';

export function A13Mobile(props: A13Data) {
  const { onPrecedent, onSuivant, st } = props;

  return (
    <>
      <div style={{ flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

        <div data-story-fond="" style={{ position: "relative", width: "100%", height: "100%", minHeight: "100vh", background: st.bg, color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {st.photo ? (<><div style={{ position: "absolute", inset: "0", background: st.photoFond }}></div><div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "60%", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.78))" }}></div></>) : null}
          <div style={{ position: "relative", padding: "48px 14px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "4px" }}>{(st.bars ?? []).map((b, bIndex) => (
<Fragment key={bIndex}><span style={{ flex: "1", height: "3px", borderRadius: "999px", background: "rgba(255,255,255,.3)", overflow: "hidden" }}><span key={st.cle} data-story-barre={st.barre} data-story-pause={st.barrePause} style={{ display: "block", height: "100%", width: b, background: "#fff" }}></span></span></Fragment>
))}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>{st.profil ? (<Link href={st.profil} data-avatar-profil="" aria-label={`Voir le profil de ${st.name}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", border: "2px solid #fff", background: st.avBg, fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{st.i}</span></Link>) : (<span style={{ width: "40px", height: "40px", borderRadius: "999px", border: "2px solid #fff", background: st.avBg, fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{st.i}</span>)}<span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", fontWeight: "700" }}>{st.profil ? (<Link href={st.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{st.name}</Link>) : st.name}<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" /><path d="m8 12 3 3 5-6" stroke="#16785E" strokeWidth="2.4" fill="none" /></svg></span><span style={{ display: "block", fontSize: "11.5px", color: "rgba(255,255,255,.8)" }}>{st.sub}</span></span><button type="button" onClick={st.onFermer} aria-label="Fermer" style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
            <span style={{ alignSelf: "flex-start", background: "#fff", color: st.pillFg, fontSize: "10.5px", fontWeight: "800", letterSpacing: ".8px", padding: "6px 12px", borderRadius: "999px" }}>{st.pill}</span>
          </div>
          <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", justifyContent: st.align, padding: "22px 22px 18px", gap: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "1.4px", color: "rgba(255,255,255,.78)" }}>{st.label}</div>
            <div style={{ fontSize: "28px", fontWeight: "800", lineHeight: "1.18", letterSpacing: "-0.6px", textWrap: "pretty" }}>{st.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,.14)", borderRadius: "16px", padding: "12px 14px", fontSize: "12.5px", fontWeight: "600", lineHeight: "1.45" }}>{st.confirmers ? (<><span style={{ display: "flex", paddingLeft: "6px", flexShrink: "0" }}>{(st.confirmers ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><span style={{ width: "26px", height: "26px", borderRadius: "999px", background: c.bg, border: "2px solid rgba(255,255,255,.9)", marginLeft: "-6px", fontSize: "9px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.i}</span></Fragment>
))}</span></>) : null}<span>{st.state}</span></div>
          </div>
          <div style={{ position: "relative", padding: "0 14px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}><span style={{ height: "48px", borderRadius: "999px", background: "#fff", color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "14px", fontWeight: "800", whiteSpace: "nowrap" }}>{st.useful ? (<><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></>) : null}{st.a1}<span style={{ color: "#6FA893", fontSize: "12.5px", fontWeight: "700" }}>{st.n1}</span></span><span style={{ height: "48px", borderRadius: "999px", border: "1.5px solid rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: "13.5px", fontWeight: "700", whiteSpace: "nowrap" }}>{st.a2}<span style={{ opacity: ".55", fontSize: "12.5px", fontWeight: "700" }}>{st.n2}</span></span></div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ flex: "1", minWidth: "0", position: "relative", display: "flex" }}><input value={st.messageTexte} onChange={st.onMessageTexte} onKeyDown={st.onMessageTouche} onFocus={st.onMessageFocus} onBlur={st.onMessageBlur} placeholder={st.write} aria-label={st.write} disabled={st.messageBloque} style={{ flex: "1", minWidth: "0", height: "46px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.45)", padding: st.messageEnvoiVisible ? "0 52px 0 18px" : "0 18px", fontSize: "13.5px", color: "rgba(255,255,255,.85)", background: "transparent", outline: "none", fontFamily: "inherit" }} />{st.messageEnvoiVisible ? (<button type="button" onMouseDown={st.onMessageEnvoyer} onClick={st.onMessageEnvoyer} aria-label="Envoyer" style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: "6px", width: "36px", height: "36px", borderRadius: "999px", background: "#fff", border: "none", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" /></svg></button>) : null}</span><button type="button" onClick={st.onSignet} aria-pressed={st.signetActif} aria-label={st.signetNom} style={{ width: "44px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none", padding: 0 }}><svg width="21" height="18" viewBox="0 0 24 24" fill={st.signetFill} stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></button></div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,.65)", textAlign: "center" }}>Touchez pour passer au suivant · glissez pour changer de membre</div>
          </div>
        <button type="button" onClick={onPrecedent} aria-label="Story précédente" style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)", zIndex: 2, width: "52px", height: "52px", borderRadius: "999px", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none", padding: 0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button><button type="button" onClick={onSuivant} aria-label="Story suivante" style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", zIndex: 2, width: "52px", height: "52px", borderRadius: "999px", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none", padding: 0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg></button></div>
      
      </main>
      </div>
    </>
  );
}
