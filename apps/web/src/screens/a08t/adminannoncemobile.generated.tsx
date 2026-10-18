// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section MOB2, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { A08TData } from './data';

export function A08TAdminAnnonceMobile(props: A08TData) {
  const { annonce, reseau } = props;

  return (
    <>

      <main style={{ display: "contents" }}>
<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.5)" }}></div><div style={{ position: "absolute", left: "0", right: "0", bottom: "0", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0" }}></span><h1 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Nouvelle annonce</h1><input type="text" value={annonce.titreValue} onChange={annonce.onTitre} placeholder="Titre de l’annonce" aria-label="Titre de l’annonce" autoComplete="off" maxLength={annonce.titreMax} style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", margin: "0", height: "46px", borderRadius: "14px", border: "1.5px solid #16785E", padding: "0 14px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: "700" }} /><textarea value={annonce.corpsValue} onChange={annonce.onCorps} placeholder="Votre annonce" aria-label="Corps de l’annonce" maxLength={annonce.corpsMax} style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", margin: "0", minHeight: "86px", borderRadius: "14px", border: "1px solid #E6EBE9", padding: "12px 14px", fontSize: "13.5px", lineHeight: "1.5" }} /><div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>Épingler en haut du fil</span><button type="button" role="switch" aria-checked={annonce.epingler} onClick={annonce.onEpingler} aria-label="Épingler en haut du fil" style={{ width: "46px", height: "26px", borderRadius: "999px", backgroundColor: annonce.epingler ? "#16785E" : "#CBD5D1", position: "relative", border: "none", padding: 0, cursor: "pointer" }}><span style={{ position: "absolute", top: "3px", left: annonce.epingler ? "23px" : "3px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" }}></span></button></div><div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>Notifier les {reseau.membres}</span><button type="button" role="switch" aria-checked={annonce.notifier} onClick={annonce.onNotifier} aria-label="Notifier les membres" style={{ width: "46px", height: "26px", borderRadius: "999px", backgroundColor: annonce.notifier ? "#16785E" : "#CBD5D1", position: "relative", border: "none", padding: 0, cursor: "pointer" }}><span style={{ position: "absolute", top: "3px", left: annonce.notifier ? "23px" : "3px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" }}></span></button></div><button type="button" onClick={annonce.onPublier} disabled={!annonce.pret} data-annonce-publier="" style={{ padding: "0 14px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", flexShrink: "0", width: "100%", height: "50px", cursor: !annonce.pret ? "default" : "pointer", opacity: annonce.pret ? "1" : ".55" }}>Publier l’annonce</button></div>
      </main>
    </>
  );
}
