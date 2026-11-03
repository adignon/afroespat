// GÉNÉRÉ depuis docs/template/Landing Page v4.dc.html — ne pas modifier à la main :
// relancer `node tools/generate-landing.mjs`. Les adaptations sont décrites dans ce script.
//
// Le style en ligne est celui de la maquette, à l'identique. La donnée et le comportement vivent dans `data.ts`.
import { Fragment } from 'react';
import { ImageLanding } from '@/components/landing/image-landing';
import type { LandingVals } from './data';
import './landing.generated.css';

export function LandingView(props: LandingVals) {
  const { aboutSpan, backFromCity, backToSearch, cats, cities, cityLabel, cityList, close, countriesLabel, cq, cqRef, entraideStats, events, faces, faq, group, groups, guide, hasCities, hasEntraide, hasEvents, hasQuotes, hero3, heroCols, heroStat, how, howCols, isCity, isGroup, isGuide, isSearch, lockedTabs, marquee, narrow, narrowNav, noResults, onCq, onQ, openCity, openLogin, openSearch, openSignup, otherCities, parcoursPts, q, qRef, quotes, sheetRadius, showCountries, showHeroStat, showLogin, tabs, textOrder, wide } = props;
  return (
    <div className="lp-root">

<div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>

<header style={{ position: "sticky", top: "0", zIndex: "20", background: "rgba(251,252,251,.94)", backdropFilter: "blur(10px)" }}>
  <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
    <a href="/" style={{ display: "flex", alignItems: "center", gap: "9px", flexShrink: "0" }}><span style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="25" height="25" viewBox="-6 -18 60 60"><g transform="rotate(-35 24 12)"><path d="M0 0H10V14H34V24H0Z" fill="#fff" /><path d="M14 0H48V24H38V10H14Z" fill="#E0733A" /></g></svg></span>{wide ? (<><span style={{ fontSize: "18px", fontWeight: "600", color: "#0F5C48", letterSpacing: "-0.4px" }}>Diaspory<span style={{ color: "#E0733A" }}>plus</span></span></>) : null}</a>
    {wide ? (<><div style={{ flex: "1", maxWidth: "440px", height: "46px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", padding: "0 5px 0 18px", gap: "10px" }}>
        <button onClick={openSearch} style={{ flex: "1", minWidth: "0", border: "none", background: "none", padding: "0", font: "inherit", fontSize: "13.5px", color: "#8A958F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left", cursor: "pointer", height: "100%" }}>Guides, communautés, villes…</button>
        <span style={{ width: "1px", height: "22px", background: "#E6EBE9" }}></span>
        <button onClick={openCity} style={{ border: "none", background: "none", padding: "0 4px", font: "inherit", fontSize: "13.5px", fontWeight: "600", color: "#16211D", whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", height: "100%" }}>{cityLabel}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg></button>
        <span onClick={openSearch} style={{ cursor: "pointer", width: "36px", height: "36px", borderRadius: "999px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></span>
      </div></>) : null}
    <span style={{ flex: "1" }}></span>
    {narrowNav ? (<><button onClick={openSearch} title="Rechercher" style={{ width: "42px", height: "42px", borderRadius: "999px", border: "none", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: "0" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></button></>) : null}
    {wide ? (<><span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "600", whiteSpace: "nowrap" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>Français</span></>) : null}
    {showLogin ? (<><a href="/connexion" onClick={openLogin} style={{ height: "42px", padding: "0 14px", borderRadius: "999px", fontSize: "14px", fontWeight: "700", color: "#16211D", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-1">Se connecter</a></>) : null}
    <a href="/connexion" onClick={openSignup} style={{ height: "42px", padding: "0 20px", borderRadius: "999px", background: "#16211D", color: "#fff", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: "0" }} className="lp-h-2">Rejoindre</a>
  </div>
</header>

<section>
  <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "48px 20px 64px", display: "grid", gridTemplateColumns: heroCols, gap: "32px", alignItems: "center" }}>
    {hero3 ? (<><div style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "flex-start" }}>
      <div style={{ position: "relative", width: "230px", height: "190px", marginLeft: "12px" }}>
        <div style={{ position: "absolute", inset: "0", borderRadius: "48% 52% 44% 56% / 55% 45% 55% 45%", background: "#CFE3DA", transform: "rotate(-6deg) translate(-8px,6px)" }}></div>
        <ImageLanding id="v4-hero-a" credit="Photo by Sthembile Nobathana on Unsplash" creditHref="https://unsplash.com/@creative_buzz_co" src="/landing/1711743658461-38c875d37c8e-600.jpg" placeholder="Photo : membres réunis" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", borderRadius: "46% 54% 50% 50% / 52% 48% 52% 48%", overflow: "hidden" }}></ImageLanding>
        <span style={{ position: "absolute", left: "-14px", bottom: "-6px", background: "#fff", border: "1.5px solid #16785E", color: "#0F5C48", fontFamily: "Caveat,cursive", fontSize: "19px", fontWeight: "700", padding: "2px 12px", borderRadius: "999px", transform: "rotate(-8deg)" }}>près de chez vous</span>
      </div>
      <div style={{ position: "relative", width: "210px", height: "180px", marginLeft: "56px" }}>
        <div style={{ position: "absolute", inset: "0", borderRadius: "56% 44% 52% 48% / 45% 55% 45% 55%", background: "#FBE3D4", transform: "rotate(8deg) translate(10px,4px)" }}></div>
        <ImageLanding id="v4-hero-b" credit="Photo by Dwayne joe on Unsplash" creditHref="https://unsplash.com/@spliff_dj_joe" src="/landing/1744846579749-77b636d7718d-600.jpg" placeholder="Photo : accueil à l’arrivée" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", borderRadius: "52% 48% 46% 54% / 50% 52% 48% 50%", overflow: "hidden" }}></ImageLanding>
      </div>
    </div></>) : null}
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "22px" }}>
      <h1 style={{ margin: "0", fontSize: "clamp(32px,4.4vw,50px)", lineHeight: "1.12", fontWeight: "800", letterSpacing: "-1.6px", textWrap: "balance" }}>La communauté des <span style={{ display: "inline-flex", width: ".8em", height: ".8em", borderRadius: "999px", background: "#E3F0EB", verticalAlign: "-0.06em", alignItems: "center", justifyContent: "center" }}><svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="2.4" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5" /></svg></span> diasporas africaines. Où chaque <span style={{ display: "inline-flex", width: ".8em", height: ".8em", borderRadius: "999px", background: "#FBE3D4", verticalAlign: "-0.06em", alignItems: "center", justifyContent: "center" }}><svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="#E0733A" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10" /></svg></span> arrivée devient un chemin <span style={{ color: "#16785E" }}>partagé.</span></h1>
      <p style={{ margin: "0", maxWidth: "520px", fontSize: "16px", lineHeight: "1.65", color: "#5D6B66", textWrap: "pretty" }}>Logement, études, travail, démarches : des milliers de membres déjà installés en France partagent ce qui a marché pour eux. Suivez votre parcours, posez vos questions, rencontrez les vôtres près de chez vous.</p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/connexion" onClick={openSignup} style={{ height: "52px", padding: "0 26px", borderRadius: "999px", background: "#16785E", color: "#fff", fontSize: "15px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-2">Rejoindre gratuitement</a>
        <a href="#how" style={{ height: "52px", padding: "0 22px", borderRadius: "999px", background: "#EEF2F0", color: "#16211D", fontSize: "15px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-3">Voir comment ça marche</a>
      </div>
      {showHeroStat ? (<><div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#5D6B66" }}><span style={{ display: "flex", paddingLeft: "8px" }}>{(faces ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><span style={{ width: "30px", height: "30px", borderRadius: "999px", background: "#CFE3DA center/cover no-repeat", backgroundImage: f, border: "2px solid #fff", marginLeft: "-8px" }}></span></Fragment>
))}</span>{heroStat}</div></>) : null}
      {narrow ? (<><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", width: "100%", marginTop: "8px" }}>
          <ImageLanding id="v4-hero-m1" credit="Photo by Sthembile Nobathana on Unsplash" creditHref="https://unsplash.com/@creative_buzz_co" src="/landing/1711743658461-38c875d37c8e-600.jpg" shape="rounded" radius="28" placeholder="Membres réunis" style={{ width: "100%", minWidth: "0", aspectRatio: "1" }}></ImageLanding>
          <ImageLanding id="v4-hero-m2" credit="Photo by Gylain Omer on Unsplash" creditHref="https://unsplash.com/@gullin_omer" src="/landing/1785502682845-d540abc600ec-600.jpg" shape="rounded" radius="28" placeholder="Rencontre du jeudi" style={{ width: "100%", minWidth: "0", aspectRatio: "1", marginTop: "28px" }}></ImageLanding>
        </div></>) : null}
    </div>
    {hero3 ? (<><div style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "flex-end" }}>
      <div style={{ position: "relative", width: "220px", height: "180px", marginRight: "16px" }}>
        <div style={{ position: "absolute", inset: "0", borderRadius: "50% 50% 46% 54% / 52% 48% 52% 48%", background: "#E8EEEC", transform: "rotate(7deg) translate(8px,-4px)" }}></div>
        <ImageLanding id="v4-hero-c" credit="Photo by Gylain Omer on Unsplash" creditHref="https://unsplash.com/@gullin_omer" src="/landing/1785502682845-d540abc600ec-600.jpg" placeholder="Photo : rencontre du jeudi" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", borderRadius: "48% 52% 54% 46% / 50% 46% 54% 50%", overflow: "hidden" }}></ImageLanding>
        <span style={{ position: "absolute", right: "-10px", bottom: "-4px", background: "#fff", border: "1.5px solid #16785E", color: "#0F5C48", fontFamily: "Caveat,cursive", fontSize: "19px", fontWeight: "700", padding: "2px 12px", borderRadius: "999px", transform: "rotate(6deg)" }}>tous les jeudis</span>
      </div>
      <div style={{ position: "relative", width: "240px", height: "200px", marginRight: "48px" }}>
        <div style={{ position: "absolute", inset: "0", borderRadius: "46% 54% 50% 50% / 55% 45% 55% 45%", background: "#CFE3DA", transform: "rotate(-7deg) translate(-10px,6px)" }}></div>
        <ImageLanding id="v4-hero-d" credit="Photo by Taylor Turtle on Unsplash" creditHref="https://unsplash.com/@tailorturtle" src="/landing/1593889026462-18faa8d91e53-600.jpg" placeholder="Photo : parrainage" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", borderRadius: "54% 46% 48% 52% / 48% 52% 48% 52%", overflow: "hidden" }}></ImageLanding>
        <span style={{ position: "absolute", right: "-24px", top: "16px", background: "#fff", border: "1.5px solid #E0733A", color: "#B4581F", fontFamily: "Caveat,cursive", fontSize: "19px", fontWeight: "700", padding: "2px 12px", borderRadius: "999px", transform: "rotate(8deg)" }}>ma parraine</span>
      </div>
    </div></>) : null}
  </div>
</section>

{showCountries ? (<><section style={{ borderTop: "1px solid #EEF2F0", borderBottom: "1px solid #EEF2F0", background: "#fff", overflow: "hidden" }}>
  <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "22px 20px", display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
    <span style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66", whiteSpace: "nowrap" }}>{countriesLabel}</span>
    <div style={{ flex: "1", minWidth: "240px", overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>{marquee}</div>
  </div>
</section></>) : null}

{hasEvents ? (<><section>
  <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "72px 20px" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "22px", flexWrap: "wrap" }}><h2 style={{ margin: "0", fontSize: "clamp(22px,2.4vw,28px)", fontWeight: "800", letterSpacing: "-0.7px", flex: "1" }}>Rencontres à venir près de chez vous</h2><a href="/connexion" style={{ fontSize: "14px", fontWeight: "700" }}>Voir tout l’agenda</a></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,230px),1fr))", gap: "20px" }}>
      {(events ?? []).map((e, eIndex) => (
<Fragment key={eIndex}><a href="/connexion" style={{ display: "flex", flexDirection: "column", gap: "10px", color: "#16211D" }} className="lp-h-4">
          <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: "18px", overflow: "hidden" }}><ImageLanding id={e.slot} src={e.src} credit={e.credit} creditHref={e.href} shape="rounded" radius="18" placeholder="Photo de l’événement" style={{ width: "100%", height: "100%" }}></ImageLanding><span style={{ position: "absolute", left: "10px", top: "10px", background: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{e.tag}</span></div>
          <div style={{ fontSize: "15.5px", fontWeight: "700", lineHeight: "1.35" }}>{e.title}</div>
          <div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "-4px" }}>{e.when}</div>
          <div style={{ fontSize: "12.5px", color: "#8A958F", marginTop: "-6px" }}>par {e.by}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: "700" }}><span style={{ display: "flex", paddingLeft: "6px" }}>{(faces ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><span style={{ width: "22px", height: "22px", borderRadius: "999px", background: "#CFE3DA center/cover no-repeat", backgroundImage: f, border: "2px solid #fff", marginLeft: "-6px" }}></span></Fragment>
))}</span>{e.n} participants</div>
        </a></Fragment>
))}
    </div>
  </div>
</section></>) : null}

<section style={{ background: "#fff" }}>
  <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "96px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "56px", alignItems: "center" }}>
    <div style={{ position: "relative" }}>
      <ImageLanding id="v4-parcours" credit="Photo by Divaris Shirichena on Unsplash" creditHref="https://unsplash.com/@divaris" src="/landing/1686213011642-b25f94b95b96-1000.jpg" shape="rounded" radius="32" placeholder="Photo : étudiante" style={{ width: "100%", aspectRatio: "4/5", maxHeight: "620px" }}></ImageLanding>
      
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <span style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: "700", color: "#E0733A" }}>étape par étape</span>
      <h2 style={{ margin: "-8px 0 0", fontSize: "clamp(28px,3.4vw,40px)", fontWeight: "800", letterSpacing: "-1.2px", lineHeight: "1.1" }}>Votre installation, découpée en étapes claires</h2>
      <p style={{ margin: "0", fontSize: "15.5px", lineHeight: "1.7", color: "#5D6B66" }}>Choisissez votre projet — études, travail, famille, régularisation — et recevez un parcours avec des échéances calculées à partir de votre date d’arrivée.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
        {(parcoursPts ?? []).map((p, pIndex) => (
<Fragment key={pIndex}><div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}><span style={{ width: "40px", height: "40px", borderRadius: "14px", background: "#E3F0EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={p.d} /></svg></span><div><div style={{ fontSize: "15px", fontWeight: "700" }}>{p.t}</div><div style={{ fontSize: "13.5px", color: "#5D6B66", lineHeight: "1.55", marginTop: "2px" }}>{p.s}</div></div></div></Fragment>
))}
      </div>
      <a href="/connexion" onClick={openSignup} style={{ alignSelf: "flex-start", height: "50px", padding: "0 24px", borderRadius: "999px", background: "#16785E", color: "#fff", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", marginTop: "6px", whiteSpace: "nowrap" }} className="lp-h-2">Créer mon parcours</a>
    </div>
  </div>
</section>

<section>
  <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "96px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "56px", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", order: textOrder }}>
      <span style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: "700", color: "#16785E" }}>l’entraide</span>
      <h2 style={{ margin: "-8px 0 0", fontSize: "clamp(28px,3.4vw,40px)", fontWeight: "800", letterSpacing: "-1.2px", lineHeight: "1.1" }}>Une question ? Ceux qui sont passés par là répondent</h2>
      <p style={{ margin: "0", fontSize: "15.5px", lineHeight: "1.7", color: "#5D6B66" }}>Caution, préfecture, banque, CAF : posez votre question à la communauté de votre ville. Les réponses jugées utiles remontent, les guides vérifiés sont proposés automatiquement.</p>
      {hasEntraide ? (<><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px", marginTop: "4px" }}>
        {(entraideStats ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "18px", padding: "16px" }}><div style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "-0.6px", color: "#0F5C48" }}>{s.v}</div><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "2px", lineHeight: "1.4" }}>{s.l}</div></div></Fragment>
))}
      </div></>) : null}
      <a href="/connexion" onClick={openSignup} style={{ alignSelf: "flex-start", height: "50px", padding: "0 24px", borderRadius: "999px", background: "#16211D", color: "#fff", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", marginTop: "6px", whiteSpace: "nowrap" }} className="lp-h-2">Poser une question</a>
    </div>
    <div style={{ position: "relative" }}>
      <ImageLanding id="v4-entraide" credit="Photo by LinkedIn Sales Solutions on Unsplash" creditHref="https://unsplash.com/@linkedinsalesnavigator" src="/landing/1507537417841-81e85feb9bd2-1000.jpg" shape="rounded" radius="32" placeholder="Photo : membre sur son ordinateur" style={{ width: "100%", aspectRatio: "4/5", maxHeight: "620px" }}></ImageLanding>
      
    </div>
  </div>
</section>

<section style={{ background: "#fff" }}>
  <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "88px 20px" }}>
    <h2 style={{ margin: "0 0 24px", fontSize: "clamp(22px,2.4vw,28px)", fontWeight: "800", letterSpacing: "-0.7px" }}>Explorer selon votre besoin</h2>
    <div style={{ display: "flex", gap: "14px", overflowX: "auto", padding: "4px 2px 14px", marginRight: "-20px", scrollbarWidth: "none" }}>
      {(cats ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><a href="/connexion" style={{ flex: "0 0 170px", height: "150px", borderRadius: "22px", background: "#fff", border: "1px solid #E6EBE9", borderBottom: `4px solid ${c.color}`, padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#16211D", marginTop: c.offset }} className="lp-h-5">
          <span style={{ fontSize: "15px", fontWeight: "700", lineHeight: "1.3" }}>{c.t}</span>
          <span style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7M9 7h8v8" /></svg><span style={{ width: "42px", height: "42px", borderRadius: "14px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={c.d} /></svg></span></span>
        </a></Fragment>
))}
    </div>
  </div>
</section>

<section>
  <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "96px 20px" }}>
    <h2 id="how" style={{ margin: "0 0 48px", textAlign: "center", fontSize: "clamp(26px,3vw,34px)", fontWeight: "800", letterSpacing: "-1px", scrollMarginTop: "90px" }}>Comment ça marche</h2>
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: howCols, gap: "28px 48px" }}>
      {wide ? (<><svg style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1000 520" preserveAspectRatio="none" fill="none" stroke="#9FB3AB" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round"><path d="M430 90 C 520 30, 470 140, 540 90" /><path d="M770 200 C 780 330, 720 380, 600 400" /></svg></>) : null}
      {(how ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><div style={{ position: "relative", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "24px", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start", gridColumn: s.col, maxWidth: s.mw, justifySelf: "center", width: "100%" }}>
          <span style={{ width: "48px", height: "48px", borderRadius: "16px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.fg} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={s.d} /></svg></span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><span style={{ fontSize: "16px", fontWeight: "700" }}>{s.t}</span><span style={{ fontSize: "14px", lineHeight: "1.55", color: "#5D6B66" }}>{s.p}</span><a href="/connexion" style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "4px" }}>{s.cta}</a></div>
        </div></Fragment>
))}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "28px", color: "#E0733A" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5" /></svg><span style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: "700", lineHeight: "1.1", maxWidth: "260px" }}>ceux qui sont passés par là vous ouvrent la route</span></div>
  </div>
</section>

{hasCities ? (<><section style={{ background: "#fff" }}>
  <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "96px 20px" }}>
    <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", marginBottom: "28px", flexWrap: "wrap" }}><div style={{ flex: "1", minWidth: "260px" }}><h2 style={{ margin: "0", fontSize: "clamp(26px,3vw,34px)", fontWeight: "800", letterSpacing: "-1px" }}>Une communauté dans votre ville</h2><p style={{ margin: "8px 0 0", fontSize: "15px", color: "#5D6B66" }}>Bons plans, produits du pays, budgets réels : chaque ville a sa fiche, écrite par ceux qui y vivent.</p></div><a href="/connexion" style={{ fontSize: "14px", fontWeight: "700" }}>Toutes les villes</a></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "20px" }}>
      {(cities ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><a href="/connexion" style={{ position: "relative", display: "block", borderRadius: "28px", overflow: "hidden", aspectRatio: "4/3", color: "#fff" }} className="lp-h-6">
          <ImageLanding id={c.slot} src={c.src} credit={c.credit} creditHref={c.href} shape="rect" placeholder="Photo de la ville" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}></ImageLanding>
          <span style={{ position: "absolute", inset: "0", background: "linear-gradient(180deg,rgba(22,33,29,0) 40%,rgba(22,33,29,.78))", pointerEvents: "none" }}></span>
          <span style={{ position: "absolute", left: "22px", right: "22px", bottom: "20px", display: "flex", alignItems: "flex-end", gap: "12px", pointerEvents: "none" }}><span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.6px" }}>{c.n}</span><span style={{ display: "block", fontSize: "13.5px", opacity: ".88", marginTop: "2px" }}>{c.s}</span></span><span style={{ background: "#fff", color: "#0F5C48", fontSize: "12.5px", fontWeight: "700", padding: "8px 14px", borderRadius: "999px", whiteSpace: "nowrap" }}>Voir la fiche</span></span>
        </a></Fragment>
))}
    </div>
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "18px" }}>
      {(otherCities ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><a href="/connexion" style={{ height: "40px", padding: "0 16px", borderRadius: "999px", background: "#F2F5F4", color: "#16211D", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }} className="lp-h-3">{c.n}<span style={{ fontWeight: "600", color: "#8A958F" }}>{c.m}</span></a></Fragment>
))}
    </div>
  </div>
</section></>) : null}

<section>
  <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "96px 20px 88px" }}>
    <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: "12%", marginBottom: "10px" }}><span style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: "700", color: "#E0733A", transform: "rotate(-3deg)" }}>vous n’êtes pas seul·e ↓</span></div>
    <div style={{ position: "relative", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "32px", padding: "clamp(48px,7vw,80px) 24px", overflow: "hidden", textAlign: "center" }}>
      <div style={{ position: "absolute", left: "-40px", top: "-30px", width: "160px", height: "200px", borderRadius: "50%", background: "#CFE3DA", transform: "rotate(-20deg)" }}></div>
      <div style={{ position: "absolute", right: "-30px", top: "-40px", width: "180px", height: "140px", borderRadius: "50%", background: "#FBE3D4", transform: "rotate(18deg)" }}></div>
      {wide ? (<><img src="/landing/1492462543947-040389c4a66c-200.jpg" alt="" style={{ position: "absolute", left: "12%", top: "22%", width: "64px", height: "64px", border: "3px solid #16785E", borderRadius: "999px", objectFit: "cover" }} />
        <img src="/landing/1528980917907-8df7f48f6f2a-200.jpg" alt="" style={{ position: "absolute", right: "15%", top: "18%", width: "70px", height: "70px", border: "3px solid #E0733A", borderRadius: "999px", objectFit: "cover" }} />
        <img src="/landing/1630163671229-07fdcf23ba71-200.jpg" alt="" style={{ position: "absolute", right: "11%", bottom: "20%", width: "84px", height: "84px", border: "3px solid #2FA37D", borderRadius: "999px", objectFit: "cover" }} />
        <span style={{ position: "absolute", left: "16%", bottom: "24%", width: "52px", height: "52px", borderRadius: "999px", background: "#E3F0EB", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg></span></>) : null}
      <div style={{ position: "relative", maxWidth: "500px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(26px,3vw,36px)", fontWeight: "800", letterSpacing: "-1px" }}>Rejoindre la communauté</h2>
        <p style={{ margin: "0", fontSize: "15.5px", lineHeight: "1.65", color: "#5D6B66", textWrap: "pretty" }}>On s’y inscrit pour préparer son départ, trouver un logement, comprendre une démarche ou simplement retrouver des gens qui parlent comme chez soi. L’inscription est gratuite.</p>
        <a href="/connexion" onClick={openSignup} style={{ height: "50px", padding: "0 24px", borderRadius: "999px", background: "#16211D", color: "#fff", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", marginTop: "4px", whiteSpace: "nowrap" }} className="lp-h-2">Créer mon compte gratuitement</a>
      </div>
    </div>
  </div>
</section>

{hasQuotes ? (<><section style={{ background: "#fff" }}>
  <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "96px 20px" }}>
    <h2 style={{ margin: "0 0 32px", fontSize: "clamp(26px,3vw,34px)", fontWeight: "800", letterSpacing: "-1px", textAlign: "center" }}>Ils racontent leur arrivée</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "20px" }}>
      {(quotes ?? []).map((q, qIndex) => (
<Fragment key={qIndex}><div style={{ background: q.bg, borderRadius: "28px", padding: "26px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={q.accent} strokeWidth="2" strokeLinecap="round"><path d="M7 7h4v4c0 3-2 5-4 5M14 7h4v4c0 3-2 5-4 5" /></svg>
          <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", flex: "1", textWrap: "pretty" }}>{q.t}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ width: "48px", height: "48px", borderRadius: "999px", background: "#CFE3DA center/cover no-repeat", backgroundImage: q.img, flexShrink: "0" }}></span><div><div style={{ fontSize: "14px", fontWeight: "700" }}>{q.n}</div><div style={{ fontSize: "12.5px", color: "#5D6B66" }}>{q.r}</div></div></div>
        </div></Fragment>
))}
    </div>
  </div>
</section></>) : null}

<section>
  <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "88px 20px" }}>
    <div style={{ background: "#0F5C48", color: "#fff", borderRadius: "36px", overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))" }}>
      <div style={{ padding: "clamp(32px,5vw,64px)", display: "flex", flexDirection: "column", gap: "18px", justifyContent: "center" }}>
        <span style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: "700", color: "#F0C3A4" }}>le parrainage</span>
        <h2 style={{ margin: "-8px 0 0", fontSize: "clamp(28px,3.4vw,40px)", fontWeight: "800", letterSpacing: "-1.2px", lineHeight: "1.1" }}>Un parrain qui connaît déjà la route</h2>
        <p style={{ margin: "0", fontSize: "15.5px", lineHeight: "1.7", color: "#CFE3DA" }}>Un membre installé dans votre ville vous accompagne pendant vos premiers mois : visites, papiers, bonnes adresses. Une fois arrivé·e, c’est à votre tour.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
          <a href="/connexion" style={{ height: "50px", padding: "0 22px", borderRadius: "999px", background: "#fff", color: "#0F5C48", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-7">Trouver un parrain</a>
          <a href="/connexion" style={{ height: "50px", padding: "0 22px", borderRadius: "999px", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-8">Devenir parrain</a>
        </div>
      </div>
      <ImageLanding id="v4-parrain" credit="Photo by Brian Kungu on Unsplash" creditHref="https://unsplash.com/@oldceltic" src="/landing/1768244016470-271b210a8407-1000.jpg" shape="rect" placeholder="Photo : parrain et filleul" style={{ width: "100%", minHeight: "360px", height: "100%" }}></ImageLanding>
    </div>
  </div>
</section>



<section style={{ background: "#fff" }}>
  <div style={{ maxWidth: "820px", margin: "0 auto", padding: "96px 20px" }}>
    <h2 style={{ margin: "0 0 28px", fontSize: "clamp(26px,3vw,34px)", fontWeight: "800", letterSpacing: "-1px", textAlign: "center" }}>Questions fréquentes</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {(faq ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><div style={{ borderRadius: "20px", background: f.bg, border: "1px solid #E6EBE9", overflow: "hidden" }}>
          <button onClick={f.toggle} style={{ width: "100%", minHeight: "60px", padding: "16px 20px", border: "none", background: "transparent", font: "inherit", fontSize: "15.5px", fontWeight: "700", color: "#16211D", display: "flex", alignItems: "center", gap: "12px", textAlign: "left", cursor: "pointer" }}><span style={{ flex: "1" }}>{f.q}</span><span style={{ width: "32px", height: "32px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", transform: `rotate(${f.rot})` }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span></button>
          {f.open ? (<><div style={{ padding: "0 20px 18px", fontSize: "14.5px", lineHeight: "1.65", color: "#5D6B66", maxWidth: "680px" }}>{f.a}</div></>) : null}
        </div></Fragment>
))}
    </div>
  </div>
</section>

<section>
  <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "88px 20px" }}>
    <div style={{ position: "relative", borderRadius: "36px", overflow: "hidden", minHeight: "420px", display: "flex", alignItems: "flex-end" }}>
      <ImageLanding id="v4-final" credit="Photo by Romain Girot on Unsplash" creditHref="https://unsplash.com/@romaingirot" src="/landing/1569087306794-db9947393580-1600.jpg" shape="rect" placeholder="Photo : quais au bord de l’eau" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}></ImageLanding>
      <span style={{ position: "absolute", inset: "0", background: "linear-gradient(90deg,rgba(15,92,72,.92),rgba(15,92,72,.55) 55%,rgba(15,92,72,.1))", pointerEvents: "none" }}></span>
      <div style={{ position: "relative", padding: "clamp(28px,5vw,64px)", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "16px", color: "#fff" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(28px,3.6vw,44px)", fontWeight: "800", letterSpacing: "-1.3px", lineHeight: "1.08" }}>Votre prochaine étape commence ici</h2>
        <p style={{ margin: "0", fontSize: "15.5px", lineHeight: "1.65", color: "#E3F0EB" }}>Inscription gratuite en deux minutes. Votre parcours, votre ville et votre réseau vous attendent.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}><a href="/connexion" onClick={openSignup} style={{ height: "52px", padding: "0 26px", borderRadius: "999px", background: "#E0733A", color: "#fff", fontSize: "15px", fontWeight: "700", display: "flex", alignItems: "center", whiteSpace: "nowrap" }} className="lp-h-9">Rejoindre gratuitement</a></div>
      </div>
    </div>
  </div>
</section>

<footer style={{ padding: "0 12px 12px" }}>
  <div style={{ maxWidth: "1400px", margin: "0 auto", background: "#16211D", color: "#fff", borderRadius: "36px", padding: "clamp(40px,5vw,64px) clamp(20px,6vw,96px) 36px" }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center", justifyContent: "space-between", paddingBottom: "40px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.4px", flexWrap: "wrap" }}><span style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="25" height="25" viewBox="-6 -18 60 60"><g transform="rotate(-35 24 12)"><path d="M0 0H10V14H34V24H0Z" fill="#fff" /><path d="M14 0H48V24H38V10H14Z" fill="#E0733A" /></g></svg></span>Diaspory<span style={{ color: "#F0C3A4" }}>plus</span> <span style={{ color: "#7FC4A8" }}>La communauté des diasporas</span></div>
      <a href="/connexion" style={{ fontSize: "18px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }} className="lp-h-10">Commencez votre parcours <span style={{ color: "#8A958F" }}>→</span></a>
    </div>
    
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,.12)", fontSize: "12.5px", color: "#8A958F" }}><a href="/p/cgu" style={{ color: "#8A958F" }} className="lp-h-6">Conditions d’utilisation</a><a href="/p/confidentialite" style={{ color: "#8A958F" }} className="lp-h-6">Confidentialité</a><a href="/p/cookies" style={{ color: "#8A958F" }} className="lp-h-6">Cookies</a><span>Portraits : <a href="https://unsplash.com/@mubarak4show" style={{ color: "#8A958F" }} className="lp-h-6">Mubarak Showole</a>, <a href="https://unsplash.com/@goodfacesagency" style={{ color: "#8A958F" }} className="lp-h-6">Good Faces</a>, <a href="https://unsplash.com/@hyingchou" style={{ color: "#8A958F" }} className="lp-h-6">Yingchou Han</a>, <a href="https://unsplash.com/@dre0316" style={{ color: "#8A958F" }} className="lp-h-6">Andre Hunter</a>, <a href="https://unsplash.com/@abstralofficial" style={{ color: "#8A958F" }} className="lp-h-6">Abstral Official</a>, <a href="https://unsplash.com/@lgnwvr" style={{ color: "#8A958F" }} className="lp-h-6">Logan Weaver</a> sur <a href="https://unsplash.com" style={{ color: "#8A958F" }} className="lp-h-6">Unsplash</a></span><span style={{ flex: "1" }}></span><span>© 2026 DiasporyPlus</span></div>
  </div>
</footer>

{isSearch ? (<><div style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(22,33,29,.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "clamp(0px,6vh,72px) clamp(0px,3vw,24px) 0" }}>
    <div onClick={close} style={{ position: "absolute", inset: "0" }}></div>
    <div style={{ position: "relative", width: "min(720px,100%)", maxHeight: "min(720px,100vh)", background: "#fff", borderRadius: sheetRadius, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px", display: "flex", gap: "8px", alignItems: "center", borderBottom: "1px solid #EEF2F0" }}>
        <div style={{ flex: "1", minWidth: "0", height: "48px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 6px 0 16px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input value={q} onChange={onQ} ref={qRef} placeholder="Visale, préfecture, Béninois…" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", fontSize: "15px", color: "#16211D", outline: "none", height: "100%" }} />
          <button onClick={openCity} style={{ height: "36px", padding: "0 12px", borderRadius: "999px", border: "1px solid #E6EBE9", background: "#fff", font: "inherit", fontSize: "13px", fontWeight: "700", color: "#16211D", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="2" strokeLinecap="round"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /></svg>{cityLabel}</button>
        </div>
        <button onClick={close} style={{ width: "44px", height: "44px", borderRadius: "999px", border: "none", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
      </div>
      <div style={{ display: "flex", gap: "6px", padding: "12px 16px 4px", flexWrap: "wrap" }}>
        {(tabs ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><button onClick={t.on} style={{ height: "36px", padding: "0 14px", borderRadius: "999px", border: `1px solid ${t.bd}`, background: t.bg, color: t.fg, font: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>{t.label}</button></Fragment>
))}
      </div>
      <div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "8px 8px 16px" }}>
        {(groups ?? []).map((g, gIndex) => (
<Fragment key={gIndex}><div style={{ padding: "12px 10px 4px", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>{g.title}</div>
          {(g.items ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><button onClick={r.open} style={{ width: "100%", border: "none", background: "transparent", font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "16px", color: "#16211D" }} className="lp-h-11">
              <img src={r.img} alt="" style={{ width: "48px", height: "48px", borderRadius: r.radius, objectFit: "cover", flexShrink: "0", background: "#E3ECE8" }} />
              <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "14.5px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span><span style={{ display: "block", fontSize: "12.5px", color: "#5D6B66", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sub}</span></span>
              <span style={{ background: r.tagBg, color: r.tagFg, fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px" }}>{r.tag}</span>
            </button></Fragment>
))}</Fragment>
))}
        {noResults ? (<><div style={{ padding: "40px 20px", textAlign: "center" }}><div style={{ fontSize: "15px", fontWeight: "700" }}>Aucun résultat pour « {q} »</div><div style={{ fontSize: "13.5px", color: "#5D6B66", marginTop: "6px" }}>Essayez un autre mot ou une autre ville. Inscrit·e, vous pouvez poser la question à la communauté.</div><button onClick={openSignup} style={{ marginTop: "14px", height: "44px", padding: "0 18px", borderRadius: "14px", border: "none", background: "#16785E", color: "#fff", font: "inherit", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}>Poser ma question</button></div></>) : null}
      </div>
    </div>
  </div></>) : null}

{isCity ? (<><div style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(22,33,29,.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "clamp(0px,8vh,96px) clamp(0px,3vw,24px) 0" }}>
    <div onClick={backFromCity} style={{ position: "absolute", inset: "0" }}></div>
    <div style={{ position: "relative", width: "min(460px,100%)", maxHeight: "min(640px,100vh)", background: "#fff", borderRadius: sheetRadius, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 12px", display: "flex", alignItems: "center" }}><span style={{ flex: "1", fontSize: "19px", fontWeight: "800", letterSpacing: "-0.4px" }}>Choisir une ville</span><button onClick={backFromCity} style={{ width: "40px", height: "40px", borderRadius: "999px", border: "none", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
      <div style={{ padding: "0 18px 10px" }}><div style={{ height: "46px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 16px" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input value={cq} onChange={onCq} ref={cqRef} placeholder="Rechercher une ville" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", fontSize: "14.5px", outline: "none", height: "100%" }} /></div></div>
      <div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "4px 8px 16px" }}>
        {(cityList ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><button onClick={c.pick} style={{ width: "100%", border: "none", background: c.bg, font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "14px", color: "#16211D" }} className="lp-h-11">
            <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#E3F0EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="1.9" strokeLinecap="round"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg></span>
            <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "14.5px", fontWeight: "700" }}>{c.n}</span><span style={{ display: "block", fontSize: "12.5px", color: "#5D6B66" }}>{c.s}</span></span>
            {c.on ? (<><span style={{ width: "24px", height: "24px", borderRadius: "999px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></>) : null}
          </button></Fragment>
))}
      </div>
    </div>
  </div></>) : null}

{isGuide ? (<><div style={{ position: "fixed", inset: "0", zIndex: "80", background: "#FBFCFB", overflowY: "auto" }}>
    <div style={{ position: "sticky", top: "0", zIndex: "2", background: "rgba(251,252,251,.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid #EEF2F0" }}><div style={{ maxWidth: "760px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: "10px" }}><button onClick={backToSearch} style={{ width: "42px", height: "42px", borderRadius: "999px", border: "none", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700", color: "#5D6B66" }}>Guide · lecture libre</span><button onClick={close} style={{ width: "42px", height: "42px", borderRadius: "999px", border: "none", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div></div>
    <article style={{ maxWidth: "760px", margin: "0 auto", padding: "28px 20px 24px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{(guide.tags ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "12px", fontWeight: "700", padding: "5px 11px", borderRadius: "999px" }}>{t}</span></Fragment>
))}</div>
      <h1 style={{ margin: "14px 0 0", fontSize: "clamp(28px,4vw,38px)", fontWeight: "800", letterSpacing: "-1.2px", lineHeight: "1.12" }}>{guide.title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}><img src={guide.authorImg} alt="" style={{ width: "36px", height: "36px", borderRadius: "999px", objectFit: "cover" }} /><span style={{ fontSize: "14px", fontWeight: "700" }}>{guide.author}</span><span style={{ fontSize: "13px", color: "#8A958F" }}>{guide.meta}</span><span style={{ fontSize: "13px", fontWeight: "700", color: "#0F5C48", background: "#E3F0EB", padding: "5px 11px", borderRadius: "999px" }}>{guide.updated}</span></div>
      <img src={guide.cover} alt="" style={{ width: "100%", aspectRatio: "16/8", objectFit: "cover", borderRadius: "22px", marginTop: "22px", background: "#E3ECE8" }} />
      {(guide.sections ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><h2 style={{ margin: "28px 0 0", fontSize: "20px", fontWeight: "700", letterSpacing: "-0.3px" }}>{s.h}</h2><p style={{ margin: "10px 0 0", fontSize: "16px", lineHeight: "1.75", textWrap: "pretty" }}>{s.p}</p></Fragment>
))}
      <div style={{ display: "flex", gap: "8px", marginTop: "28px", flexWrap: "wrap" }}>
        <button onClick={openSignup} style={{ height: "46px", padding: "0 16px", borderRadius: "14px", border: "none", background: "#F2F5F4", font: "inherit", fontSize: "13.5px", fontWeight: "700", color: "#16211D", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>Utile · {guide.useful}</button>
        <button onClick={openSignup} style={{ height: "46px", padding: "0 16px", borderRadius: "14px", border: "none", background: "#F2F5F4", font: "inherit", fontSize: "13.5px", fontWeight: "700", color: "#16211D", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>Commenter · {guide.comments}</button>
        <button onClick={openSignup} style={{ height: "46px", padding: "0 16px", borderRadius: "14px", border: "none", background: "#F2F5F4", font: "inherit", fontSize: "13.5px", fontWeight: "700", color: "#16211D", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>Enregistrer</button>
        <button onClick={openSignup} style={{ height: "46px", padding: "0 16px", borderRadius: "14px", border: "none", background: "#F2F5F4", font: "inherit", fontSize: "13.5px", fontWeight: "700", color: "#16211D", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>Proposer une correction</button>
      </div>
    </article>
    <div style={{ position: "sticky", bottom: "0", padding: "12px", background: "linear-gradient(180deg,rgba(251,252,251,0),#FBFCFB 30%)" }}><div style={{ maxWidth: "760px", margin: "0 auto", background: "#16211D", color: "#fff", borderRadius: "22px", padding: "14px 14px 14px 20px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}><span style={{ flex: "1", minWidth: "200px", fontSize: "14px", lineHeight: "1.45" }}><strong>Inscrivez-vous gratuitement</strong> pour commenter, enregistrer ce guide, poser vos questions à l’auteur et suivre votre parcours.</span><button onClick={openSignup} style={{ height: "46px", padding: "0 20px", borderRadius: "14px", border: "none", background: "#16785E", color: "#fff", font: "inherit", fontSize: "14px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>Créer mon compte</button><button onClick={openLogin} style={{ height: "46px", padding: "0 14px", borderRadius: "14px", border: "none", background: "rgba(255,255,255,.1)", color: "#fff", font: "inherit", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>Se connecter</button></div></div>
  </div></>) : null}

{isGroup ? (<><div style={{ position: "fixed", inset: "0", zIndex: "80", background: "#FBFCFB", overflowY: "auto" }}>
    <div style={{ position: "sticky", top: "0", zIndex: "2", background: "rgba(251,252,251,.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid #EEF2F0" }}><div style={{ maxWidth: "900px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: "10px" }}><button onClick={backToSearch} style={{ width: "42px", height: "42px", borderRadius: "999px", border: "none", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700", color: "#5D6B66" }}>Communauté</span><button onClick={close} style={{ width: "42px", height: "42px", borderRadius: "999px", border: "none", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div></div>
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ position: "relative", borderRadius: "28px", overflow: "hidden", aspectRatio: "16/6", minHeight: "180px", background: "#E3ECE8" }}><img src={group.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /><span style={{ position: "absolute", inset: "0", background: "linear-gradient(180deg,rgba(22,33,29,0) 30%,rgba(22,33,29,.72))" }}></span><div style={{ position: "absolute", left: "22px", right: "22px", bottom: "18px", color: "#fff", display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}><div style={{ flex: "1", minWidth: "200px" }}><div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}><span style={{ background: "#fff", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{group.vis}</span><span style={{ background: "rgba(255,255,255,.18)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{group.kind}</span></div><div style={{ fontSize: "clamp(24px,3.4vw,32px)", fontWeight: "800", letterSpacing: "-0.8px" }}>{group.name}</div><div style={{ fontSize: "13.5px", opacity: ".9", marginTop: "2px" }}>{group.sub}</div></div><button onClick={openSignup} style={{ height: "46px", padding: "0 20px", borderRadius: "14px", border: "none", background: "#16785E", color: "#fff", font: "inherit", fontSize: "14px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>Rejoindre</button></div></div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", display: "flex", alignItems: "center", gap: "2px", padding: "0 10px", overflowX: "auto" }}>
        <span style={{ height: "52px", display: "flex", alignItems: "center", padding: "0 12px", fontSize: "13.5px", fontWeight: "700", color: "#0F5C48", borderBottom: "2.5px solid #16785E", whiteSpace: "nowrap" }}>À propos</span>
        {(lockedTabs ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><button onClick={openSignup} style={{ height: "52px", display: "flex", alignItems: "center", gap: "6px", padding: "0 12px", font: "inherit", fontSize: "13.5px", fontWeight: "500", color: "#8A958F", border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>{t}</button></Fragment>
))}
      </div>
      {group.isPublic ? (<><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: "16px", alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "12px", gridColumn: `span ${aboutSpan}` }}>
            <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>DESCRIPTION</div>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.7", textWrap: "pretty" }}>{group.desc}</p>
            {group.hasRules ? (<><div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginTop: "8px" }}>RÈGLES</div>
            {(group.rules ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><div style={{ display: "flex", gap: "10px", fontSize: "14px", lineHeight: "1.55" }}><span style={{ width: "22px", height: "22px", borderRadius: "999px", background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{r.n}</span>{r.t}</div></Fragment>
))}</>) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>{(group.stats ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><div><div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.4px" }}>{s.v}</div><div style={{ fontSize: "12px", color: "#5D6B66" }}>{s.l}</div></div></Fragment>
))}</div>
            <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>ANIMÉ PAR</div>{(group.admins ?? []).map((a, aIndex) => (
<Fragment key={aIndex}><div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}><img src={a.img} alt="" style={{ width: "36px", height: "36px", borderRadius: "999px", objectFit: "cover" }} /><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>{a.n}</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{a.r}</span></div></Fragment>
))}</div>
          </div>
        </div></>) : null}
      {group.isPrivate ? (<><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}><span style={{ width: "52px", height: "52px", borderRadius: "16px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", color: "#16211D" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg></span><div style={{ fontSize: "18px", fontWeight: "800" }}>Communauté réservée aux membres</div><div style={{ fontSize: "14px", color: "#5D6B66", maxWidth: "440px", lineHeight: "1.6" }}>Seules les communautés publiques des villes sont consultables sans compte. Inscrivez-vous pour découvrir celle-ci et demander à la rejoindre.</div></div></>) : null}
    </div>
    <div style={{ position: "sticky", bottom: "0", padding: "12px", background: "linear-gradient(180deg,rgba(251,252,251,0),#FBFCFB 30%)" }}><div style={{ maxWidth: "760px", margin: "0 auto", background: "#16211D", color: "#fff", borderRadius: "22px", padding: "14px 14px 14px 20px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}><span style={{ flex: "1", minWidth: "200px", fontSize: "14px", lineHeight: "1.45" }}><strong>Le fil, les événements, les membres et l’album</strong> sont réservés aux inscrits. L’inscription est gratuite.</span><button onClick={openSignup} style={{ height: "46px", padding: "0 20px", borderRadius: "14px", border: "none", background: "#16785E", color: "#fff", font: "inherit", fontSize: "14px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>Rejoindre gratuitement</button><button onClick={openLogin} style={{ height: "46px", padding: "0 14px", borderRadius: "14px", border: "none", background: "rgba(255,255,255,.1)", color: "#fff", font: "inherit", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>Se connecter</button></div></div>
  </div></>) : null}


</div>

    </div>
  );
}
