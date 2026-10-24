'use client';

import { useEffect, useState } from 'react';
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  PAGE_BODY_MAX,
  adminAnnouncementSchema,
  adminAnnouncementsResponseSchema,
  adminPageSchema,
  adminPagesResponseSchema,
  announcementWriteSchema,
  okResponseSchema,
  pageCreateSchema,
  type AdminAnnouncement,
  type AdminPage,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { CorpsMarkdown } from '../../markdown-legal';
import { toutesLesVilles } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Colonnes, Etiquette, Fenetre, Lecture, Message, Onglets, Pastille, Titre, Vide, ZoneTexte, dateLongue, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D12 · PAGES VERSIONNÉES ET ANNONCES (15 §4.1, §4.2)                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * PAGES. La maquette montre « Politique de confidentialité · brouillon v4 », un extrait
 * de Markdown, « Versions : v1 v2 v3 » et « Publier la v4 ». Chaque élément est réel :
 * la liste vient de `GET /admin/pages`, l'éditeur enregistre un BROUILLON (`PUT`), un
 * aperçu rend le Markdown comme le verront les membres (même rendu que `/p/:slug`), et
 * « Publier la vN » (`POST …/publish`) met le brouillon en vigueur. Pour `cgu` et
 * `confidentialite`, publier REDEMANDE le consentement de tous les membres à leur prochain
 * chargement — l'avertissement de la maquette est conservé, et il est vrai.
 *
 * ⚠ Les textes juridiques sont du BROUILLON (« à faire valider par un juriste ») : le
 * porteur publiera le texte définitif ici, en version 1.
 *
 * ANNONCES. Titre, texte, ciblage (villes, pays, phases), période, aperçu du bandeau ;
 * l'annonce active la plus récente et ciblée s'affiche en tête de l'accueil des membres
 * (fermable, la fermeture est mémorisée côté client).
 */

type Onglet = 'pages' | 'annonces';

export function ContenuPagesAnnonces() {
  const [onglet, setOnglet] = useState<Onglet>('pages');
  return (
    <>
      <Titre titre="Pages et annonces" />
      <Onglets onglets={[{ id: 'pages', libelle: 'Pages' }, { id: 'annonces', libelle: 'Annonces' }]} actif={onglet} onChange={setOnglet} />
      {onglet === 'pages' ? <Pages /> : <Annonces />}
    </>
  );
}

// ─── Pages ───────────────────────────────────────────────────────────────────

function Pages() {
  const peut = useDroit('content');
  const liste = useCharge(() => staffApi.get('/pages', adminPagesResponseSchema), 'pages');
  const [sel, setSel] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);
  useEffect(() => {
    if (sel === null && liste.etat.phase === 'pret') setSel(liste.etat.donnees.items.find((p) => p.slug === 'cgu')?.id ?? liste.etat.donnees.items[0]?.id ?? null);
  }, [sel, liste.etat]);

  return (
    <Lecture etat={liste.etat} recharger={liste.recharger}>
      {(d) => (
        <Colonnes gabarit="minmax(0,300px) minmax(0,1fr)">
          <Carte style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {d.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSel(p.id)}
                aria-current={p.id === sel}
                style={{ textAlign: 'left', border: 'none', borderRadius: '12px', padding: '12px 14px', font: 'inherit', fontSize: '14px', fontWeight: p.id === sel ? 700 : 500, background: p.id === sel ? C.vertPale : 'transparent', color: C.encre, cursor: 'pointer' }}
              >
                {p.title}
                <span style={{ color: C.gris, fontWeight: 500 }}> · {p.liveVersion === null ? 'non publiée' : `v${p.liveVersion}`}</span>
                {p.draft === null ? null : <span style={{ color: C.terre, fontWeight: 700 }}> · brouillon</span>}
              </button>
            ))}
            <div style={{ padding: '8px 6px 4px' }}>
              <Bouton petit ton="contour" plein disabled={!peut} onClick={() => setCreer(true)}>
                + Nouvelle page
              </Bouton>
            </div>
          </Carte>
          {sel === null ? <Carte><Vide>Aucune page.</Vide></Carte> : <EditeurPage key={sel} id={sel} peut={peut} onChange={liste.recharger} />}
          <Creation ouverte={creer} onFermer={() => setCreer(false)} onFait={(id) => { setCreer(false); setSel(id); liste.recharger(); }} />
        </Colonnes>
      )}
    </Lecture>
  );
}

function Creation({ ouverte, onFermer, onFait }: { readonly ouverte: boolean; readonly onFermer: () => void; readonly onFait: (id: string) => void }) {
  const [slug, setSlug] = useState('');
  const [titre, setTitre] = useState('');
  const geste = useGeste();
  const creer = async () => {
    const corps = pageCreateSchema.safeParse({ slug: slug.trim(), title: titre.trim(), body: '## 1. Titre de la première section\n\nTexte.' });
    if (!corps.success) {
      geste.prevenir('L’identifiant s’écrit en minuscules, chiffres et tirets (p. ex. a-propos).');
      return;
    }
    let id = '';
    const ok = await geste.lancer(async () => {
      id = (await staffApi.post('/pages', adminPageSchema, { body: corps.data })).id;
    });
    if (ok) onFait(id);
  };
  return (
    <Fenetre ouverte={ouverte} titre="Nouvelle page" onFermer={onFermer}>
      <Champ libelle="Identifiant dans l’adresse (/p/…)" valeur={slug} onChange={setSlug} />
      <Champ libelle="Titre" valeur={titre} onChange={setTitre} />
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || slug.trim() === '' || titre.trim() === ''} onClick={() => void creer()}>
          Créer
        </Bouton>
      </div>
    </Fenetre>
  );
}

function EditeurPage({ id, peut, onChange }: { readonly id: string; readonly peut: boolean; readonly onChange: () => void }) {
  const { etat, recharger } = useCharge(() => staffApi.get(`/pages/${id}`, adminPageSchema), id);
  return (
    <Lecture etat={etat} recharger={recharger}>
      {(p) => <Formulaire p={p} peut={peut} recharger={() => { recharger(); onChange(); }} />}
    </Lecture>
  );
}

function Formulaire({ p, peut, recharger }: { readonly p: AdminPage; readonly peut: boolean; readonly recharger: () => void }) {
  const geste = useGeste();
  const depart = p.draft?.body ?? p.body ?? '';
  const [titre, setTitre] = useState(p.draft?.title ?? p.title);
  const [corps, setCorps] = useState(depart);
  const [apercu, setApercu] = useState(false);
  const sale = p.draft === null ? titre !== p.title || corps !== (p.body ?? '') : titre !== p.draft.title || corps !== (p.draft.body ?? '');
  const prochaine = (p.draft?.version ?? Math.max(0, ...p.versions.map((v) => v.version)) + 1);

  const enregistrer = async (): Promise<boolean> => {
    const ok = await geste.lancer(() => staffApi.put(`/pages/${p.id}`, adminPageSchema, { body: { title: titre.trim(), body: corps } }), 'Brouillon enregistré.');
    if (ok) recharger();
    return ok;
  };
  const publier = async () => {
    if ((sale || p.draft === null) && !(await enregistrer())) return;
    const ok = await geste.lancer(() => staffApi.post(`/pages/${p.id}/publish`, adminPageSchema, { body: {} }), `Version ${prochaine} publiée.`);
    if (ok) recharger();
  };
  const supprimer = async () => {
    const ok = await geste.lancer(() => staffApi.del(`/pages/${p.id}`, okResponseSchema), 'Page supprimée.');
    if (ok) recharger();
  };

  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: '18px', fontWeight: 800, minWidth: '200px' }}>
          {p.title} · {p.draft === null ? (p.liveVersion === null ? 'non publiée' : `v${p.liveVersion}`) : `brouillon v${p.draft.version}`}
        </div>
        <Pastille>
          Versions : {p.versions.length === 0 ? 'aucune' : p.versions.map((v) => `v${v.version}`).reverse().join(' ')}
        </Pastille>
      </div>
      <div style={{ fontSize: '12.5px', color: C.gris }}>/p/{p.slug}{p.publishedAt === null ? '' : ` · en vigueur depuis le ${dateLongue(p.publishedAt)}`}</div>
      <Champ libelle="Titre" valeur={titre} onChange={setTitre} disabled={!peut} maxLength={200} />
      <Onglets onglets={[{ id: 'e', libelle: 'Markdown' }, { id: 'a', libelle: 'Aperçu' }]} actif={apercu ? 'a' : 'e'} onChange={(x) => setApercu(x === 'a')} />
      {apercu ? (
        <div style={{ border: `1px solid ${C.trait}`, borderRadius: '16px', padding: '8px 20px 20px' }}>
          <CorpsMarkdown corps={corps} />
        </div>
      ) : (
        <ZoneTexte libelle="Corps (Markdown : ## titres, - listes, **gras**, [liens](/p/cgu))" valeur={corps} onChange={setCorps} lignes={14} mono maxLength={PAGE_BODY_MAX} disabled={!peut} />
      )}
      {p.asksConsent ? <Bandeau ton="attention">Publier cette version redemandera le consentement de tous les membres, à leur prochain chargement de l’application.</Bandeau> : null}
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton ton="contour" disabled={!peut || !sale || geste.occupe || corps.trim() === ''} onClick={() => void enregistrer()}>
          Enregistrer le brouillon
        </Bouton>
        <Bouton ton="principal" disabled={!peut || geste.occupe || corps.trim() === '' || (!sale && p.draft === null)} onClick={() => void publier()}>
          Publier la v{prochaine}
        </Bouton>
        {p.publishedAt === null ? (
          <Bouton disabled={!peut || geste.occupe} onClick={() => void supprimer()}>
            Supprimer la page
          </Bouton>
        ) : null}
      </div>
    </Carte>
  );
}

// ─── Annonces ────────────────────────────────────────────────────────────────

const PHASES = [
  { id: 'PRE_DEPARTURE', libelle: 'Avant le départ' },
  { id: 'RECENT_ARRIVAL', libelle: 'Arrivé·e récemment' },
  { id: 'SETTLED', libelle: 'Installé·e' },
];
const ETATS = { active: 'En cours', upcoming: 'À venir', ended: 'Terminée' } as const;

function versLocal(iso: string | null | undefined): string {
  if (iso === null || iso === undefined) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Annonces() {
  const peut = useDroit('content');
  const liste = useCharge(() => staffApi.get('/announcements?limit=50', adminAnnouncementsResponseSchema), 'annonces');
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (sel === null && liste.etat.phase === 'pret') setSel(liste.etat.donnees.items[0]?.id ?? 'nouvelle');
  }, [sel, liste.etat]);
  return (
    <Lecture etat={liste.etat} recharger={liste.recharger}>
      {(d) => (
        <Colonnes gabarit="minmax(0,300px) minmax(0,1fr)">
          <Carte style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {d.items.map((a) => (
              <button key={a.id} type="button" onClick={() => setSel(a.id)} style={{ textAlign: 'left', border: 'none', borderRadius: '12px', padding: '12px 14px', font: 'inherit', fontSize: '14px', fontWeight: a.id === sel ? 700 : 500, background: a.id === sel ? C.vertPale : 'transparent', cursor: 'pointer' }}>
                {a.title}
                <span style={{ color: a.state === 'active' ? C.vertFonce : C.gris, fontWeight: 600 }}> · {ETATS[a.state]}</span>
              </button>
            ))}
            <div style={{ padding: '8px 6px 4px' }}>
              <Bouton petit ton="contour" plein disabled={!peut} onClick={() => setSel('nouvelle')}>
                + Nouvelle annonce
              </Bouton>
            </div>
          </Carte>
          <FormulaireAnnonce key={sel ?? 'rien'} annonce={d.items.find((a) => a.id === sel) ?? null} peut={peut} onFait={(id) => { if (id !== null) setSel(id); else setSel(null); liste.recharger(); }} />
        </Colonnes>
      )}
    </Lecture>
  );
}

function FormulaireAnnonce({ annonce, peut, onFait }: { readonly annonce: AdminAnnouncement | null; readonly peut: boolean; readonly onFait: (id: string | null) => void }) {
  const geste = useGeste();
  const villes = useCharge(() => toutesLesVilles(), 'villes');
  const [titre, setTitre] = useState(annonce?.title ?? '');
  const [texte, setTexte] = useState(annonce?.body ?? '');
  const [villesIds, setVillesIds] = useState<readonly string[]>(annonce?.target?.cityIds ?? []);
  const [phases, setPhases] = useState<readonly string[]>(annonce?.target?.phases ?? []);
  const [debut, setDebut] = useState(versLocal(annonce?.startsAt ?? new Date().toISOString()));
  const [fin, setFin] = useState(versLocal(annonce?.endsAt));
  const bascule = (liste: readonly string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

  const corps = {
    title: titre.trim(),
    body: texte.trim(),
    target: villesIds.length === 0 && phases.length === 0 ? null : { ...(villesIds.length === 0 ? {} : { cityIds: villesIds }), ...(phases.length === 0 ? {} : { phases }) },
    startsAt: debut === '' ? '' : new Date(debut).toISOString(),
    endsAt: fin === '' ? null : new Date(fin).toISOString(),
  };
  const valide = announcementWriteSchema.safeParse(corps);

  const enregistrer = async () => {
    if (!valide.success) return;
    let id: string | null = annonce?.id ?? null;
    const ok = await geste.lancer(async () => {
      if (annonce === null) id = (await staffApi.post('/announcements', adminAnnouncementSchema, { body: valide.data })).id;
      else await staffApi.put(`/announcements/${annonce.id}`, adminAnnouncementSchema, { body: valide.data });
    }, 'Annonce enregistrée.');
    if (ok) onFait(id);
  };
  const supprimer = async () => {
    if (annonce === null) return;
    const ok = await geste.lancer(() => staffApi.del(`/announcements/${annonce.id}`, okResponseSchema), 'Annonce supprimée.');
    if (ok) onFait(null);
  };
  const nomsVilles = villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive) : [];

  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Etiquette>Annonce · bandeau</Etiquette>
      <Champ libelle="Titre" valeur={titre} onChange={setTitre} disabled={!peut} maxLength={ANNOUNCEMENT_TITLE_MAX} />
      <ZoneTexte libelle="Texte" valeur={texte} onChange={setTexte} lignes={3} disabled={!peut} maxLength={ANNOUNCEMENT_BODY_MAX} />
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Ciblage · vide = tous les membres</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {PHASES.map((ph) => (
            <button key={ph.id} type="button" disabled={!peut} aria-pressed={phases.includes(ph.id)} onClick={() => { setPhases((l) => bascule(l, ph.id)); }} style={{ height: '34px', padding: '0 14px', borderRadius: '999px', border: phases.includes(ph.id) ? 'none' : `1px solid ${C.trait}`, background: phases.includes(ph.id) ? C.vert : '#fff', color: phases.includes(ph.id) ? '#fff' : C.encre, font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
              {ph.libelle}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto' }}>
          {nomsVilles.map((v) => (
            <button key={v.id} type="button" disabled={!peut} aria-pressed={villesIds.includes(v.id)} onClick={() => setVillesIds((l) => bascule(l, v.id))} style={{ height: '30px', padding: '0 12px', borderRadius: '999px', border: villesIds.includes(v.id) ? 'none' : `1px solid ${C.trait}`, background: villesIds.includes(v.id) ? C.vert : '#fff', color: villesIds.includes(v.id) ? '#fff' : C.encre, font: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <Champ libelle="Début" valeur={debut} onChange={setDebut} type="datetime-local" disabled={!peut} />
        <Champ libelle="Fin (facultative)" valeur={fin} onChange={setFin} type="datetime-local" disabled={!peut} />
      </div>
      <div style={{ background: C.vertPale, color: C.vertFonce, borderRadius: '14px', padding: '10px 14px', fontSize: '13.5px', fontWeight: 700 }}>
        Aperçu : {titre === '' ? 'Titre de l’annonce' : titre}
        {texte === '' ? '' : ` — ${texte}`}
      </div>
      {!valide.success && (titre !== '' || texte !== '') ? <Bandeau ton="attention">{valide.error.issues[0]?.message ?? 'Annonce incomplète.'}</Bandeau> : null}
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton ton="principal" disabled={!peut || !valide.success || geste.occupe} onClick={() => void enregistrer()}>
          {annonce === null ? 'Publier l’annonce' : 'Enregistrer'}
        </Bouton>
        {annonce === null ? null : (
          <Bouton disabled={!peut || geste.occupe} onClick={() => void supprimer()}>
            Supprimer
          </Bouton>
        )}
      </div>
    </Carte>
  );
}
