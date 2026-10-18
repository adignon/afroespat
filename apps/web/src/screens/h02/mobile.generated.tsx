// GÉNÉRÉ depuis docs/template/05 Entraide.dc.html, section H02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import { EnteteDemande } from '@/components/entraide/demande-vivante';
import { MenuDemande } from '@/components/entraide/demande-vivante';
import { ActionsReponse } from '@/components/entraide/demande-vivante';
import { ApresResolution } from '@/components/entraide/demande-vivante';
import { BarreReponse } from '@/components/entraide/demande-vivante';
import type { H02Data } from './data';

export function H02Mobile(props: H02Data) {
  const { action, demande, reponses } = props;

  return (
    <>

      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></span><span style={{ fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Demande</span><MenuDemande action={action} rondStyle={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0"  }} /></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ background: action.deParcours ? "#FFFBF8" : "#fff", border: action.deParcours ? "1.5px solid #E0733A" : "1px solid #E6EBE9", borderRadius: "20px", padding: "16px", flexShrink: "0" }}><EnteteDemande action={action} sansMenu />{demande.parcours ? (<><div style={{ fontSize: "12px", fontWeight: "700", color: "#B4581F", marginTop: "8px" }}>Étape {demande.parcours.etape}</div></>) : null}<h1 style={{ margin: "0", fontSize: "18px", fontWeight: "800", marginTop: "6px" }}>{demande.titre}</h1><p style={{ margin: "6px 0 0", fontSize: "13.5px", lineHeight: "1.55" }}>{demande.extrait}</p></div><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "0 14px", flexShrink: "0" }}>{(reponses ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><div style={{ display: "flex", gap: "12px", padding: "14px 0", borderBottom: "1px solid #F0F3F2" }}>{r.profil ? (<Link href={r.profil} data-avatar-profil="" aria-label={`Voir le profil de ${r.nom}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><span style={{ width: "36px", height: "36px", borderRadius: "999px", background: r.fond, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{r.initiales}</span></Link>) : (<span style={{ width: "36px", height: "36px", borderRadius: "999px", background: r.fond, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{r.initiales}</span>)}<div style={{ flex: "1", minWidth: "0" }}><div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13.5px", fontWeight: "700" }}>{r.profil ? (<Link href={r.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{r.nom}</Link>) : r.nom}<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg><span style={{ fontSize: "11.5px", color: "#8A958F", fontWeight: "500" }}>{r.age}</span></div><div style={{ fontSize: "13.5px", lineHeight: "1.55", marginTop: "4px" }}>{r.corps}</div><ActionsReponse reponse={r.action} /></div></div></Fragment>
))}</div><ApresResolution action={action} /></div><BarreReponse action={action} />
      </main>
    </>
  );
}
