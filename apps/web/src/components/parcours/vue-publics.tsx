'use client';

/**
 * AJOUT HORS MAQUETTE — J09 « PARCOURS PUBLICS » : FILTRES ENVOYÉS, ACTIONS RÉELLES.
 *
 * Les trois filtres de la planche (type, ville, avancement) étaient des `<span>` : rien
 * n'était envoyé. Ici chacun devient un paramètre de `GET /journeys/public`
 * (`templateCode`, `cityId`, `progressNear`) et la liste est redemandée au serveur —
 * qui exclut les parcours en pause, arrêtés ou bloqués (§3.7, règle dure) et ne rend
 * JAMAIS le titre personnel. Les villes proposées sont celles des résultats de la
 * première lecture, les types ceux de `GET /journey-templates`.
 *
 * « Écrire » ouvre la fenêtre de premier message (`POST /conversations/direct`, la
 * même que sur un profil) ; « Proposer comme parrain » n'apparaît que si JE suis un
 * parrain disponible (`GET /mentors/:monPseudo`) et ouvre la même fenêtre avec une
 * proposition à compléter — il n'existe pas de route « offre de parrainage » : le
 * parrainage part du filleul (08 §2.2), donc l'offre est un message.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import type { PublicJourney } from '@app/shared';
import { memberApi, displayMessageFor, fetchMe } from '@/lib/api/index';
import { conversationAvec, ouvrirConversation, prenomDe } from '@/components/ecrire';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { notifyError } from '@/components/notifications';
import { getPublicJourney, listJourneyTemplates, listPublicJourneysFiltered, updateJourney, listJourneys } from '@/screens/parcours/api';
import { duree, typeCourt } from '@/screens/parcours/appels';
import { Avis, Attente, Bouton, C, Etiquette, Pastille, carte } from './ui';
import { signalerMaj, useGeste, useIdParcours } from './donnees';
import { CadreActif } from './cadre-actif';

function Avatar({ nom }: { readonly nom: string }) {
  return (
    <span style={{ width: '42px', height: '42px', borderRadius: '999px', background: C.vert, color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {nom.split(/\s+/).slice(0, 2).map((m) => m[0] ?? '').join('').toUpperCase()}
    </span>
  );
}

const nomDe = (p: PublicJourney) => (p.member.displayName === null || p.member.displayName.trim() === '' ? `@${p.member.handle}` : p.member.displayName);

/** Écrire à un membre, ou lui proposer un parrainage — même fenêtre. */
export function useEcrire() {
  const router = useRouter();
  const [cible, setCible] = useState<{ handle: string; nom: string } | null>(null);
  const [enVol, setEnVol] = useState(false);

  const ouvrir = useCallback(
    (handle: string, nom: string) => {
      void conversationAvec(handle).then(
        (id) => (id === null ? setCible({ handle, nom }) : router.push(`/messages/${id}`)),
        () => setCible({ handle, nom }),
      );
    },
    [router],
  );
  const fenetre = (
    <FenetreEcrire
      ouverte={cible !== null}
      prenom={cible === null ? '' : prenomDe(cible.nom, cible.handle)}
      occupe={enVol}
      onFermer={() => setCible(null)}
      onEnvoyer={(message) => {
        if (cible === null) return;
        setEnVol(true);
        ouvrirConversation(cible.handle, message).then(
          (id) => {
            setCible(null);
            router.push(`/messages/${id}`);
          },
          (cause: unknown) => notifyError(displayMessageFor(cause)),
        ).finally(() => setEnVol(false));
      }}
    />
  );
  return { ouvrir, fenetre };
}

function useSuisParrain(): boolean {
  const [oui, setOui] = useState(false);
  useEffect(() => {
    fetchMe().then(
      (me) => memberApi.get(`/mentors/${me.user.handle}`, z.unknown()).then(() => setOui(true), () => setOui(false)),
      () => setOui(false),
    );
  }, []);
  return oui;
}

function CarteMini({ p, onEcrire, parrain }: { readonly p: PublicJourney; readonly onEcrire: (h: string, n: string) => void; readonly parrain: boolean }) {
  const type = typeCourt(p.template.code, p.template.nameFr);
  return (
    <article style={{ ...carte(16), display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Link href={`/parcours/publics/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: C.texte }}>
        <Avatar nom={nomDe(p)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700 }}>{nomDe(p)}</span>
          <span style={{ display: 'block', fontSize: '12.5px', color: C.gris }}>{type} · {p.destinationCity.name}</span>
        </span>
        <span style={{ fontSize: '14px', fontWeight: 800 }}>{Math.round(p.progressPct)}%</span>
      </Link>
      <div style={{ height: '6px', borderRadius: '999px', background: C.barre, overflow: 'hidden' }}>
        <div style={{ width: `${p.progressPct}%`, height: '100%', background: p.status === 'COMPLETED' ? C.vert : C.orange }} />
      </div>
      {p.completedSteps.length === 0 ? null : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {p.completedSteps.slice(-4).map((s) => (
            <Pastille key={s.id}>{s.title}{s.durationDays === null ? '' : ` · ${duree(s.durationDays)}`}</Pastille>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton compact ton="calme" onClick={() => onEcrire(p.member.handle, nomDe(p))}>Écrire</Bouton>
        {parrain ? <Bouton compact ton="calme" onClick={() => onEcrire(p.member.handle, nomDe(p))} label={`Proposer à ${nomDe(p)} de devenir son parrain`}>Proposer comme parrain</Bouton> : null}
      </div>
    </article>
  );
}

function Select({ id, libelle, valeur, onChange, options }: { readonly id: string; readonly libelle: string; readonly valeur: string; readonly onChange: (v: string) => void; readonly options: readonly (readonly [string, string])[] }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
      {libelle}
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)} style={{ height: '40px', borderRadius: '12px', border: `1px solid ${C.bord}`, background: '#fff', padding: '0 10px', font: 'inherit', fontSize: '13.5px', fontWeight: 600 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function VuePublicsInterne({ compact }: { readonly compact: boolean }) {
  const [items, setItems] = useState<readonly PublicJourney[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [types, setTypes] = useState<readonly (readonly [string, string])[]>([]);
  const [villes, setVilles] = useState<readonly (readonly [string, string])[]>([]);
  const [type, setType] = useState('');
  const [ville, setVille] = useState('');
  const [avancement, setAvancement] = useState('');
  const [prive, setPrive] = useState<string | null>(null);
  const ecrire = useEcrire();
  const parrain = useSuisParrain();
  const geste = useGeste();

  useEffect(() => {
    void listJourneyTemplates().then((r) => setTypes(r.items.filter((m) => m.createsJourney).map((m) => [m.code, m.nameFr] as const)), () => undefined);
    void listJourneys().then((r) => { const actif = r.items.find((p) => p.isOwner && p.status === 'ACTIVE'); setPrive(actif !== undefined && actif.visibility !== 'PUBLIC' ? actif.id : null); }, () => undefined);
  }, []);

  useEffect(() => {
    let annule = false;
    setItems(null);
    listPublicJourneysFiltered({
      ...(type === '' ? {} : { templateCode: type }),
      ...(ville === '' ? {} : { cityId: ville }),
      ...(avancement === '' ? {} : { progressNear: Number(avancement) }),
    }).then(
      (r) => {
        if (annule) return;
        setItems(r.items);
        setEchec(null);
        // Les villes proposées : celles de la première lecture non filtrée.
        setVilles((avant) => {
          if (avant.length > 0) return avant;
          const vues = new Map<string, string>();
          for (const p of r.items) vues.set(p.destinationCity.id, p.destinationCity.name);
          return [...vues.entries()];
        });
      },
      (cause: unknown) => { if (!annule) setEchec(displayMessageFor(cause)); },
    );
    return () => { annule = true; };
  }, [type, ville, avancement]);

  const rendrePublic = () => {
    if (prive === null) return;
    void geste.executer(async () => { await updateJourney(prive, { visibility: 'PUBLIC' }); setPrive(null); signalerMaj(); });
  };

  const corps = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={carte(compact ? 16 : 24)}>
        <h1 style={{ margin: 0, fontSize: compact ? '20px' : '26px', fontWeight: 800, letterSpacing: '-0.8px' }}>Parcours publics</h1>
        <div style={{ fontSize: '14px', color: C.gris, marginTop: '4px' }}>
          Des membres qui ont choisi de montrer leur progression : étapes franchies et durée réelle, jamais leurs notes ni leur équipe.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
          <Select id="filtre-type" libelle="Type de parcours" valeur={type} onChange={setType} options={[['', 'Tous les types'], ...types]} />
          <Select id="filtre-ville" libelle="Ville" valeur={ville} onChange={setVille} options={[['', 'Toutes les villes'], ...villes]} />
          <Select id="filtre-avancement" libelle="Avancement" valeur={avancement} onChange={setAvancement} options={[['', 'Proche du mien'], ['0', 'Au début'], ['25', 'Vers 25 %'], ['50', 'À mi-parcours'], ['75', 'Vers 75 %'], ['100', 'Aboutis']]} />
        </div>
      </div>
      {prive === null ? null : (
        <div style={{ ...carte(16), background: C.vertPale, border: `1px solid ${C.vertPale2}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Etiquette>VOTRE PARCOURS EST PRIVÉ</Etiquette>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>Rendre mon parcours public ?</div>
          <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>Cela encourage ceux qui suivent le même chemin. Seules vos étapes franchies et leur durée sont visibles.</div>
          <div><Bouton compact disabled={geste.occupe} onClick={rendrePublic}>Rendre public</Bouton></div>
          <Avis texte={geste.erreur} ton="erreur" />
        </div>
      )}
      {items === null && echec === null ? <Attente texte="Chargement des parcours publics…" /> : null}
      <Avis texte={echec} ton="erreur" />
      {items !== null && items.length === 0 ? (
        <div style={{ ...carte(20), color: C.gris, fontSize: '14px' }}>Aucun parcours public ne correspond à ces filtres pour l’instant.</div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '12px' }}>
        {(items ?? []).map((p) => <CarteMini key={p.id} p={p} onEcrire={ecrire.ouvrir} parrain={parrain} />)}
      </div>
      {ecrire.fenetre}
    </div>
  );
  return compact ? <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div> : corps;
}

function VueFichePubliqueInterne({ compact }: { readonly compact: boolean }) {
  const id = useIdParcours();
  const [p, setP] = useState<(PublicJourney & { currentStep: { title: string; position: number } | null }) | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const ecrire = useEcrire();
  const parrain = useSuisParrain();
  const nom = useMemo(() => (p === null ? '' : nomDe(p)), [p]);

  useEffect(() => {
    if (id === null) return;
    getPublicJourney(id).then((r) => setP(r.journey), (cause: unknown) => setEchec(displayMessageFor(cause)));
  }, [id]);

  return (
    <div style={{ padding: compact ? '12px 16px 90px' : 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Link href="/parcours/publics" style={{ fontSize: '13px', fontWeight: 700, color: C.vertFonce }}>← Parcours publics</Link>
      {p === null && echec === null ? <Attente /> : null}
      <Avis texte={echec} ton="erreur" />
      {p === null ? null : (
        <>
          <div style={{ ...carte(20), display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar nom={nom} />
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Parcours de {prenomDe(nom, p.member.handle)}</h1>
                <div style={{ fontSize: '13px', color: C.gris }}>Parcours {p.template.nameFr} · {p.destinationCity.name} · depuis {p.originCountry.nameFr}</div>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 800 }}>{Math.round(p.progressPct)}%</span>
            </div>
            {p.currentStep === null ? null : <div style={{ fontSize: '13.5px', color: C.orange, fontWeight: 700 }}>En cours : étape {p.currentStep.position} · {p.currentStep.title}</div>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Bouton compact onClick={() => ecrire.ouvrir(p.member.handle, nom)}>Écrire</Bouton>
              {parrain ? <Bouton compact ton="calme" onClick={() => ecrire.ouvrir(p.member.handle, nom)}>Proposer comme parrain</Bouton> : null}
            </div>
          </div>
          <div style={{ ...carte(20), display: 'flex', flexDirection: 'column' }}>
            <Etiquette>ÉTAPES FRANCHIES</Etiquette>
            {p.completedSteps.length === 0 ? <div style={{ fontSize: '14px', color: C.gris, padding: '10px 0' }}>Pas encore d’étape franchie.</div> : null}
            {p.completedSteps.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #F0F3F2' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: C.vert }} />
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{s.title}</span>
                <span style={{ fontSize: '12.5px', color: C.grisClair }}>{s.durationDays === null ? '' : duree(s.durationDays)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {ecrire.fenetre}
    </div>
  );
}

export function VuePublics(props: Parameters<typeof VuePublicsInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VuePublicsInterne {...props} />
    </CadreActif>
  );
}

export function VueFichePublique(props: Parameters<typeof VueFichePubliqueInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueFichePubliqueInterne {...props} />
    </CadreActif>
  );
}
