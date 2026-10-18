'use client';

/**
 * AJOUT HORS MAQUETTE — J06 « CHECKLIST DE DOCUMENTS » : COCHER, AJOUTER, RETIRER.
 *
 * Les six lignes de la maquette (trois cochées, trois à faire) étaient dessinées. Ici
 * chaque étape qui porte des documents les liste, et la checklist se modifie
 * (`PUT …/steps/:stepId/checklist`). Le texte imposé de §3.3 — « Cochez ce que vous
 * avez réuni. Les documents restent chez vous. » — vient de `meta.checklistNotice` :
 * aucun fichier n'est attaché, et aucun champ n'en accepte.
 */

import { Etiquette, C, carte } from './ui';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { EditeurChecklist } from './vue-etape';
import { signalerMaj } from './donnees';
import { CadreActif } from './cadre-actif';

function VueDocumentsInterne({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours, vue) => {
        const proprietaire = parcours.viewerRole === 'OWNER';
        const corps = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EnteteParcours parcours={parcours} compact={compact} />
            <div style={{ ...carte(16), fontSize: '13.5px', color: C.gris, lineHeight: 1.5 }}>{parcours.meta.checklistNotice}</div>
            {!proprietaire ? (
              <div style={{ ...carte(20), color: C.gris, fontSize: '14px' }}>La checklist de documents est personnelle : elle n’est visible que par le propriétaire du parcours.</div>
            ) : (
              parcours.steps.map((etape) => (
                <div key={etape.id} style={{ ...carte(compact ? 14 : 18), display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Etiquette>
                    ÉTAPE {etape.position} · {etape.title.toUpperCase()}
                  </Etiquette>
                  <EditeurChecklist
                    parcours={parcours}
                    etape={etape}
                    onParcours={(p) => {
                      vue.appliquer(p);
                      signalerMaj();
                    }}
                  />
                </div>
              ))
            )}
          </div>
        );
        return compact ? (
          <>
            <OngletsMobile id={vue.id} actif="/documents" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
          </>
        ) : (
          corps
        );
      }}
    />
  );
}

export function VueDocuments(props: Parameters<typeof VueDocumentsInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueDocumentsInterne {...props} />
    </CadreActif>
  );
}
