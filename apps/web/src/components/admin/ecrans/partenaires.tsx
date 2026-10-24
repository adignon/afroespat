'use client';

import { useState } from 'react';
import {
  PartnerCategory,
  adminAffiliateResponseSchema,
  adminPartnersResponseSchema,
  adminPlacementsResponseSchema,
  affiliateImportResultSchema,
  okResponseSchema,
  partnerCreateSchema,
  placementCreateSchema,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { toutesLesDefinitions } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Etiquette, Fenetre, Interrupteur, Lecture, Message, Selecteur, Titre, Vide, dateLongue, nombreFr, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D13 · PARTENAIRES ET ENCARTS (14 §5)                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le tableau des partenaires (catégorie, modèle de rémunération, contrat, clics,
 * conversions, revenus), celui des encarts par étape, l'import CSV des conversions : tout
 * vient de `GET /admin/billing/{partners,placements,affiliate}`. Rôles : CONTENT_ADMIN et
 * SUPER_ADMIN écrivent ; les autres lisent.
 *
 * RÈGLE DURE conservée : un seul encart ACTIF par étape et par combinaison de pays — le
 * serveur refuse le second (`PLACEMENT_EXISTS`), l'écran affiche ce refus tel quel.
 *
 * Il ne s'agit PAS de paiement : les partenaires sont de l'affiliation sortante (un clic,
 * une conversion importée). Aucun montant n'est prélevé auprès d'un membre ici ; les
 * « revenus » sont ce que le partenaire reverse à la plateforme.
 *
 * ⚠ ÉCART : la maquette croise les encarts par PAYS (Bénin · Sénégal · Côte d'Ivoire) en
 * colonnes. Le serveur porte pays d'origine et de destination facultatifs ; l'écran liste
 * les encarts avec leur étape plutôt que de dessiner une matrice que la donnée ne remplit
 * pas.
 */

const CATEGORIES: Record<string, string> = {
  INSURANCE: 'Assurance',
  AIRLINE: 'Compagnie aérienne',
  BANK: 'Banque',
  REMITTANCE: 'Transfert d’argent',
  HOUSING_GUARANTEE: 'Garant',
  TELECOM: 'Téléphonie',
  OTHER: 'Autre',
};
const MODELES = [{ valeur: 'CPA', libelle: 'CPA (par conversion)' }, { valeur: 'CPC', libelle: 'CPC (par clic)' }];
const euros = (c: number) => `${nombreFr(Math.round(c / 100))} €`;

export function ContenuPartenaires() {
  const peut = useDroit('content');
  const partenaires = useCharge(() => staffApi.get('/billing/partners?limit=50', adminPartnersResponseSchema), 'partenaires');
  const encarts = useCharge(() => staffApi.get('/billing/placements?limit=50', adminPlacementsResponseSchema), 'encarts');
  const stats = useCharge(() => staffApi.get('/billing/affiliate', adminAffiliateResponseSchema), 'affiliation');
  const geste = useGeste();
  const [nouveau, setNouveau] = useState(false);
  const [encart, setEncart] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);

  const parPartenaire = (id: string) => {
    const lignes = stats.etat.phase === 'pret' ? stats.etat.donnees.items.filter((i) => i.partnerId === id) : [];
    return { clics: lignes.reduce((t, l) => t + l.clicks, 0), conv: lignes.reduce((t, l) => t + l.conversions, 0), cents: lignes.reduce((t, l) => t + l.payoutCents, 0) };
  };
  const basculerPartenaire = async (id: string, actif: boolean) => {
    const ok = await geste.lancer(() => staffApi.patch(`/billing/partners/${id}`, okResponseSchema, { body: { isActive: actif } }));
    if (ok) {
      partenaires.recharger();
      encarts.recharger();
    }
  };
  const basculerEncart = async (id: string, actif: boolean) => {
    const ok = await geste.lancer(() => staffApi.patch(`/billing/placements/${id}`, okResponseSchema, { body: { isActive: actif } }));
    if (ok) encarts.recharger();
  };
  const importer = async (fichier: File | undefined) => {
    if (fichier === undefined) return;
    const texte = await fichier.text();
    const rows = texte
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !/^click/i.test(l))
      .map((l) => {
        const [clickId = '', conversionRef = '', payout = '0'] = l.split(/[;,]/).map((c) => c.trim());
        return { clickId, conversionRef, payoutCents: Math.round(Number(payout)) };
      });
    const ok = await geste.lancer(async () => {
      const r = await staffApi.post('/billing/affiliate/import', affiliateImportResultSchema, { body: { rows } });
      setBilan(`Import terminé : ${r.converted} conversion(s), ${r.alreadyKnown} déjà connue(s), ${r.unknown} inconnue(s).`);
    });
    if (ok) stats.recharger();
  };

  return (
    <>
      <Titre titre="Partenaires" action={<Bouton ton="principal" disabled={!peut} titre={peut ? undefined : 'Réservé : contenu'} onClick={() => setNouveau(true)}>+ Nouveau partenaire</Bouton>} />
      <Message message={geste.message} />
      {bilan === null ? null : <Bandeau role="status">{bilan}</Bandeau>}
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={partenaires.etat} recharger={partenaires.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucun partenaire.</Vide>
            ) : (
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Partenaire', 'Catégorie', 'Modèle', 'Contrat', 'Clics', 'Conv.', 'Revenus', 'Actif'].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((p) => {
                      const s = parPartenaire(p.id);
                      return (
                        <tr key={p.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{p.name}</td>
                          <td style={{ padding: '10px 14px' }}>{CATEGORIES[p.category] ?? p.category}</td>
                          <td style={{ padding: '10px 14px' }}>{p.payoutModel}</td>
                          <td style={{ padding: '10px 14px' }}>{p.contractEnd === null ? 'sans échéance' : `jusqu’au ${dateLongue(p.contractEnd)}`}</td>
                          <td style={{ padding: '10px 14px' }}>{nombreFr(s.clics)}</td>
                          <td style={{ padding: '10px 14px' }}>{nombreFr(s.conv)}</td>
                          <td style={{ padding: '10px 14px' }}>{euros(s.cents)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <Interrupteur actif={p.isActive} onChange={(v) => void basculerPartenaire(p.id, v)} libelle={`Actif : ${p.name}`} disabled={!peut || geste.occupe} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Lecture>
      </Carte>

      <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>Placements par étape</Etiquette>
        <Lecture etat={encarts.etat} recharger={encarts.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucun encart.</Vide>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.items.map((e) => (
                  <li key={e.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${C.traitLeger}`, padding: '10px 0' }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>{e.step?.nameFr ?? 'Section Logement'}</div>
                      <div style={{ fontSize: '12.5px', color: C.gris }}>{e.partner.name} · « {e.headline} » · {e.clicks} clic{e.clicks > 1 ? 's' : ''}</div>
                    </div>
                    <Interrupteur actif={e.isActive} onChange={(v) => void basculerEncart(e.id, v)} libelle={`Actif : ${e.headline}`} disabled={!peut || geste.occupe} />
                  </li>
                ))}
              </ul>
            )
          }
        </Lecture>
        <Bandeau>Un seul encart par étape et par pays : l’ajout est refusé si un placement actif existe.</Bandeau>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Bouton disabled={!peut} onClick={() => setEncart(true)}>+ Nouvel encart</Bouton>
          <label style={{ display: 'inline-flex', height: '44px', alignItems: 'center', padding: '0 18px', borderRadius: '14px', background: C.aplat, fontSize: '13.5px', fontWeight: 700, cursor: peut ? 'pointer' : 'default', opacity: peut ? 1 : 0.5 }}>
            Importer les conversions (CSV)
            <input type="file" accept=".csv,text/csv" disabled={!peut} onChange={(e) => void importer(e.target.files?.[0])} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ fontSize: '12px', color: C.grisClair }}>CSV : identifiant du clic, référence de conversion, rémunération en centimes — une ligne par conversion.</div>
      </Carte>

      <NouveauPartenaire ouverte={nouveau} onFermer={() => setNouveau(false)} onFait={() => { setNouveau(false); partenaires.recharger(); }} />
      <NouvelEncart ouverte={encart} partenaires={partenaires.etat.phase === 'pret' ? partenaires.etat.donnees.items : []} onFermer={() => setEncart(false)} onFait={() => { setEncart(false); encarts.recharger(); }} />
    </>
  );
}

function NouveauPartenaire({ ouverte, onFermer, onFait }: { readonly ouverte: boolean; readonly onFermer: () => void; readonly onFait: () => void }) {
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState<string>('OTHER');
  const [modele, setModele] = useState('CPA');
  const [url, setUrl] = useState('');
  const geste = useGeste();
  const creer = async () => {
    const corps = partnerCreateSchema.safeParse({ name: nom.trim(), category: categorie, payoutModel: modele, affiliateUrlTemplate: url.trim() });
    if (!corps.success) {
      await geste.lancer(() => Promise.reject(new Error(corps.error.issues[0]?.message ?? 'Partenaire incomplet.')));
      return;
    }
    const ok = await geste.lancer(() => staffApi.post('/billing/partners', okResponseSchema, { body: corps.data }));
    if (ok) {
      setNom('');
      setUrl('');
      onFait();
    }
  };
  return (
    <Fenetre ouverte={ouverte} titre="Nouveau partenaire" onFermer={onFermer}>
      <Champ libelle="Nom" valeur={nom} onChange={setNom} />
      <Selecteur libelle="Catégorie" valeur={categorie} onChange={setCategorie} options={PartnerCategory.map((c) => ({ valeur: c, libelle: CATEGORIES[c] ?? c }))} />
      <Selecteur libelle="Modèle de rémunération" valeur={modele} onChange={setModele} options={MODELES} />
      <Champ libelle="Gabarit d’adresse (https://…{click_id})" valeur={url} onChange={setUrl} />
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || nom.trim() === '' || url.trim() === ''} onClick={() => void creer()}>Créer</Bouton>
      </div>
    </Fenetre>
  );
}

function NouvelEncart({ ouverte, partenaires, onFermer, onFait }: { readonly ouverte: boolean; readonly partenaires: readonly { id: string; name: string; isActive: boolean }[]; readonly onFermer: () => void; readonly onFait: () => void }) {
  const defs = useCharge(() => (ouverte ? toutesLesDefinitions() : Promise.resolve([])), String(ouverte));
  const [partenaire, setPartenaire] = useState('');
  const [etape, setEtape] = useState('');
  const [titre, setTitre] = useState('');
  const [bouton, setBouton] = useState('Découvrir');
  const geste = useGeste();
  const creer = async () => {
    const corps = placementCreateSchema.safeParse({ partnerId: partenaire, stepDefinitionId: etape, headline: titre.trim(), ctaLabel: bouton.trim() });
    if (!corps.success) {
      await geste.lancer(() => Promise.reject(new Error(corps.error.issues[0]?.message ?? 'Encart incomplet.')));
      return;
    }
    const ok = await geste.lancer(() => staffApi.post('/billing/placements', okResponseSchema, { body: corps.data }));
    if (ok) {
      setTitre('');
      onFait();
    }
  };
  return (
    <Fenetre ouverte={ouverte} titre="Nouvel encart" onFermer={onFermer}>
      <Selecteur libelle="Partenaire" valeur={partenaire} onChange={setPartenaire} options={[{ valeur: '', libelle: 'Choisir…' }, ...partenaires.filter((p) => p.isActive).map((p) => ({ valeur: p.id, libelle: p.name }))]} />
      <Selecteur libelle="Étape" valeur={etape} onChange={setEtape} options={[{ valeur: '', libelle: 'Choisir…' }, ...(defs.etat.phase === 'pret' ? defs.etat.donnees.map((d) => ({ valeur: d.id, libelle: d.nameFr })) : [])]} />
      <Champ libelle="Titre de l’encart" valeur={titre} onChange={setTitre} />
      <Champ libelle="Texte du bouton" valeur={bouton} onChange={setBouton} />
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || partenaire === '' || etape === '' || titre.trim() === ''} onClick={() => void creer()}>Créer</Bouton>
      </div>
    </Fenetre>
  );
}
