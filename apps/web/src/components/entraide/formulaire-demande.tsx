'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HELP_LIMITS,
  HELP_REQUEST_TYPES,
  HELP_TYPE_LABELS,
  HELP_USE_SERVICES_HINT,
  createHelpSchema,
  helpDetailResponseSchema,
  placesCitiesResponseSchema,
  type CreateHelp,
} from '@app/shared';
import { fetchMe, memberApi } from '@/lib/api/index';
import { Alerte, BOUTON_PLEIN, CHAMP, Compteur, LIBELLE, Pastille, Segments, eteint } from './atomes';
import { useGeste } from './geste';

/**
 * AJOUT HORS MAQUETTE — le composeur de H03, avec de VRAIS champs.
 *
 * La maquette dessine un composeur dont les champs sont des `<div>` portant un
 * exemple : on ne pouvait ni écrire, ni choisir une ville, ni envoyer. Ce
 * composant reprend leur dessin (champ de 48 px, pastilles de type, bandeaux de
 * règle) et y met ce qu'une image ne peut pas contenir.
 *
 * Ce que la planche de 390 px ne dessine pas et que 06 §2.2 exige y est AJOUTÉ,
 * dans le même dessin : le champ « Ville » (obligatoire) et le type « Autre ».
 *
 * ── LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE ──────────────────────────────────
 *
 * Les bornes sont celles de `createHelpSchema` / `HELP_LIMITS` (source unique) : on
 * grise « Publier » tant que le schéma partagé refuse la saisie, et on affiche son
 * premier motif. Mais le NIVEAU n'est jamais testé ici : une offre en L0 part au
 * serveur, qui répond `403 LEVEL_REQUIRED`, et `useGeste` ouvre la fenêtre qui
 * explique. De même `USE_SERVICES` (logement, emploi) et `CONTENT_BLOCKED`
 * arrivent du serveur avec leur phrase.
 *
 * ── LE CONTEXTE DE PARCOURS EST CONSERVÉ ──────────────────────────────────
 *
 * `?etape=<id>` (lien « Demander de l'aide » d'une étape) devient
 * `originJourneyStepId` : le serveur hérite l'échéance (§2.5) et la demande
 * s'affiche ensuite « Étape N · … · parcours … » dans toutes les listes.
 */
export function FormulaireDemande({
  variante,
  avertissement,
}: {
  readonly variante: 'bureau' | 'mobile';
  readonly avertissement: string;
}) {
  const router = useRouter();
  /** Les deux cadres (1440 et 390) sont dans le DOM : des `id` fixes seraient en double. */
  const uid = useId();
  const { lancer, occupe, fenetre } = useGeste();
  const [kind, setKind] = useState<'REQUEST' | 'OFFER'>('REQUEST');
  const [type, setType] = useState<(typeof HELP_REQUEST_TYPES)[number]>('PAPERWORK');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cityId, setCityId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [etape, setEtape] = useState<string | null>(null);
  const [villes, setVilles] = useState<readonly { id: string; name: string }[]>([]);
  const [touche, setTouche] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  useEffect(() => {
    const recherche = new URLSearchParams(window.location.search);
    const parametre = recherche.get('etape');
    if (parametre !== null && parametre !== '') setEtape(parametre);
    /**
     * `?titre=` — « POSER LA QUESTION » DEPUIS UNE RECHERCHE SANS RÉSULTAT (X01).
     * L'URL est publique : le titre est borné à `HELP_LIMITS.titleMax` et ne remplace
     * jamais ce que le membre a déjà écrit. Le schéma partagé tranche ensuite
     * (`titleMin`) comme pour n'importe quelle saisie.
     */
    const titre = recherche.get('titre')?.trim() ?? '';
    if (titre !== '') setTitle((deja) => (deja === '' ? titre.slice(0, HELP_LIMITS.titleMax) : deja));
  }, []);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      const [moi, liste] = await Promise.allSettled([
        fetchMe(),
        memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema),
      ]);
      if (!vivant) return;
      if (liste.status === 'fulfilled') {
        setVilles(liste.value.items.map((c) => ({ id: c.id, name: c.name })));
      }
      if (moi.status === 'fulfilled' && moi.value.user.cityId !== null) {
        const maVille = moi.value.user.cityId;
        setCityId((c) => (c === '' ? maVille : c));
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const brouillon = useMemo(
    () => ({
      kind,
      type,
      title,
      body,
      cityId,
      ...(dueDate === '' ? {} : { dueDate }),
      ...(etape === null ? {} : { originJourneyStepId: etape }),
    }),
    [kind, type, title, body, cityId, dueDate, etape],
  );
  const verdict = createHelpSchema.safeParse(brouillon);
  const motif = verdict.success
    ? null
    : title.trim().length < HELP_LIMITS.titleMin
      ? `Le titre doit faire au moins ${String(HELP_LIMITS.titleMin)} caractères.`
      : body.trim().length < HELP_LIMITS.bodyMin
        ? `Décrivez votre ${kind === 'REQUEST' ? 'demande' : 'offre'} en au moins ${String(HELP_LIMITS.bodyMin)} caractères.`
        : cityId === ''
          ? 'Choisissez une ville.'
          : 'Certaines informations sont incomplètes.';

  const publier = async (): Promise<void> => {
    setTouche(true);
    setRefus(null);
    if (!verdict.success || occupe) return;
    const donnees: CreateHelp = verdict.data;
    let detail: { request: { id: string } } | null = null;
    const ok = await lancer(
      async () => {
        detail = await memberApi.post('/help', helpDetailResponseSchema, { body: donnees });
      },
      { succes: kind === 'REQUEST' ? 'Votre demande est publiée.' : 'Votre offre est publiée.' },
    );
    if (ok && detail !== null) router.push(`/entraide/${(detail as { request: { id: string } }).request.id}`);
    else if (!ok) setRefus('Publication refusée : voir le message affiché.');
  };

  const mobile = variante === 'mobile';
  const champs = (
    <>
      <Segments
        valeur={kind}
        onChoisir={setKind}
        options={[
          { cle: 'REQUEST', libelle: 'Demande' },
          { cle: 'OFFER', libelle: 'Offre' },
        ]}
      />
      <div>
        {mobile ? null : <div style={LIBELLE}>Type</div>}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Type">
          {HELP_REQUEST_TYPES.map((t) => (
            <Pastille
              key={t}
              actif={type === t}
              onClick={() => {
                setType(t);
              }}
            >
              {HELP_TYPE_LABELS[t]}
            </Pastille>
          ))}
        </div>
      </div>
      <div>
        <label style={LIBELLE} htmlFor={`${uid}-titre`}>
          Titre
        </label>
        <input
          id={`${uid}-titre`}
          value={title}
          maxLength={HELP_LIMITS.titleMax}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="Accompagner un RDV préfecture jeudi"
          style={{ ...CHAMP, border: title === '' ? CHAMP.border : '1.5px solid #16785E' }}
        />
        <Compteur n={title.trim().length} min={HELP_LIMITS.titleMin} max={HELP_LIMITS.titleMax} />
      </div>
      <div>
        <label style={LIBELLE} htmlFor={`${uid}-corps`}>
          {kind === 'REQUEST' ? 'Votre demande' : 'Votre offre'}
        </label>
        <textarea
          id={`${uid}-corps`}
          value={body}
          rows={5}
          maxLength={HELP_LIMITS.bodyMax}
          onChange={(e) => {
            setBody(e.target.value);
          }}
          placeholder="Première convocation, je cherche quelqu’un qui connaît la procédure…"
          style={{ ...CHAMP, resize: 'vertical' }}
        />
        <Compteur n={body.trim().length} min={HELP_LIMITS.bodyMin} max={HELP_LIMITS.bodyMax} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={LIBELLE} htmlFor={`${uid}-ville`}>
            Ville
          </label>
          <select
            id={`${uid}-ville`}
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
            }}
            style={CHAMP}
          >
            <option value="">Choisir une ville</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={LIBELLE} htmlFor={`${uid}-echeance`}>
            Échéance (facultatif)
          </label>
          <input
            id={`${uid}-echeance`}
            type="date"
            value={dueDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setDueDate(e.target.value);
            }}
            style={CHAMP}
          />
        </div>
      </div>
      {etape === null ? null : (
        <div
          data-depuis-parcours=""
          style={{
            background: '#FFFBF8',
            border: '1.5px solid #E0733A',
            borderRadius: '14px',
            padding: '12px 14px',
            fontSize: '12.5px',
            color: '#B4581F',
            fontWeight: 700,
          }}
        >
          Depuis une étape de votre parcours · l’échéance de l’étape est reprise si vous n’en
          indiquez pas.
        </div>
      )}
      <div
        style={{
          background: '#F3F7F5',
          borderRadius: '14px',
          padding: '12px 14px',
          fontSize: '12.5px',
          color: '#0F5C48',
          fontWeight: 600,
        }}
      >
        {HELP_USE_SERVICES_HINT}
      </div>
      <div
        style={{
          background: '#FDF0E7',
          borderRadius: '14px',
          padding: '12px 14px',
          fontSize: '12.5px',
          color: '#B4581F',
          fontWeight: 700,
        }}
      >
        {avertissement}
      </div>
      {touche && motif !== null ? <Alerte>{motif}</Alerte> : null}
      {refus === null ? null : <span style={{ fontSize: '12px', color: '#5D6B66' }}>{refus}</span>}
    </>
  );

  const bouton = (
    <button
      type="button"
      onClick={() => {
        void publier();
      }}
      disabled={occupe}
      data-publier=""
      style={{
        ...eteint(BOUTON_PLEIN, occupe || !verdict.success),
        ...(mobile ? { flex: 1 } : { width: '100%', height: '50px' }),
      }}
    >
      {occupe ? 'Publication…' : mobile ? 'Publier' : 'Publier la demande'}
    </button>
  );

  if (mobile) {
    return (
      <>
        <div
          style={{
            flexGrow: 1,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {champs}
        </div>
        <div
          style={{
            flexShrink: 0,
            background: '#fff',
            borderTop: '1px solid #E6EBE9',
            padding: '12px 16px 28px',
            display: 'flex',
            gap: '8px',
          }}
        >
          {bouton}
        </div>
        {fenetre}
      </>
    );
  }
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: '22px',
        padding: '24px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {champs}
      {bouton}
      {fenetre}
    </div>
  );
}
