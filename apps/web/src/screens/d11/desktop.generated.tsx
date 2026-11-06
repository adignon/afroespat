// GÉNÉRÉ depuis docs/template/10 Administration.dc.html, section D11, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { BarreAdmin } from '@/components/admin/barre-admin';
import { RailAdmin } from '@/components/admin/rail-admin';
import { ContenuAlertes } from '@/components/admin/ecrans/alertes';
import type { AdministrationData } from '../administration/data';

export function D11Desktop(_props: AdministrationData) {
  return (
    <>

      <div style={{ display: "contents" }}>
<RailAdmin /><main id="contenu-admin" tabIndex={-1} data-admin-main="" style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", padding: "0 24px 24px 0" }}><BarreAdmin /><div style={{ flexGrow: "1", display: "flex", flexDirection: "column", gap: "14px", overflow: "visible" }}><ContenuAlertes /></div></main>
      </div>
    </>
  );
}
