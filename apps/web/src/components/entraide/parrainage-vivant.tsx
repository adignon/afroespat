'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MENTORSHIP_MESSAGE_MAX,
  MENTOR_BIO_MAX,
  MENTOR_DEFAULT_MAX_MENTEES,
  MENTOR_MAX_MAX_MENTEES,
  mentorProfileResponseSchema,
  mentorProfileSchema,
  myMentorProfileResponseSchema,
  MENTORSHIP_MESSAGE_MIN,
  createMentorshipSchema,
  journeyTemplatesResponseSchema,
  journeysListResponseSchema,
  mentorsResponseSchema,
  mentorshipAcceptedSchema,
  mentorshipCreatedSchema,
  myMentorshipsResponseSchema,
  MENTORSHIP_REVIEW_COMMENT_MAX,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  placesLanguagesResponseSchema,
  type MentorCard,
  type MyMentorProfileResponse,
  type MyMentorshipsResponse,
} from '@app/shared';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { fetchMe, memberApi, voidResponse } from '@/lib/api/index';
import { useVersionEntraide } from '@/lib/entraide-recharge';
import { Alerte, BOUTON_DISCRET, BOUTON_PLEIN, CHAMP, Compteur, EtatListe, Feuille, LIBELLE, Pastille, Segments, eteint, initiales } from './atomes';
import { useGeste } from './geste';

/**
 * AJOUT HORS MAQUETTE — les gestes du PARRAINAGE (H05 à H08).
 *
 * La maquette dessine la fiche d'un parrain, sa liste, « Mes parrainages » et
 * « Devenir parrain » comme des images : aucun bouton n'écrivait. Les composants de
 * ce fichier en reprennent le dessin (mêmes rayons, mêmes teintes) et branchent les
 * huit routes d'écriture du module (`POST /mentorships`, `/accept`, `/decline`,
 * `/end`, `/extend`, `/review`, `PUT` et `DELETE /me/mentor-profile`).
 *
 * LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE : on grise « Envoyer » tant que le message n'a
 * pas les 50 caractères de §2.2 (`MENTORSHIP_MESSAGE_MIN`, source unique), mais
 * `MENTOR_FULL`, `PENDING_REQUEST_EXISTS` et `BLOCKED_RELATIONSHIP` sont ceux du
 * serveur, avec leur phrase — le front ne devine pas qu'une demande est déjà en
 * attente.
 */

// ── H06 : « Demander comme parrain » et sa feuille ───────────────────────────

export function BoutonDemander({
  handle,
  nom,
  complet,
  libelle,
  style,
}: {
  readonly handle: string;
  readonly nom: string;
  /** « Complet » (§2.1) : on prévient, mais le serveur refuse de toute façon. */
  readonly complet: boolean;
  readonly libelle: string;
  readonly style: CSSProperties;
}) {
  const router = useRouter();
  const { lancer, occupe, fenetre } = useGeste();
  const [ouverte, setOuverte] = useState(false);
  const [message, setMessage] = useState('');
  const [parcours, setParcours] = useState('');
  const [mesParcours, setMesParcours] = useState<readonly { id: string; title: string }[]>([]);
  const [refus, setRefus] = useState<string | null>(null);

  useEffect(() => {
    if (!ouverte) return;
    let vivant = true;
    void memberApi
      .get('/journeys', journeysListResponseSchema)
      .then((r) => {
        if (vivant) setMesParcours(r.items.map((j) => ({ id: j.id, title: j.title })));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [ouverte]);

  const brouillon = {
    mentorHandle: handle,
    message: message.trim(),
    ...(parcours === '' ? {} : { journeyId: parcours }),
  };
  const verdict = createMentorshipSchema.safeParse(brouillon);

  const envoyer = async (): Promise<void> => {
    setRefus(null);
    if (!verdict.success || occupe) return;
    const ok = await lancer(
      () => memberApi.post('/mentorships', mentorshipCreatedSchema, { body: verdict.data }),
      { succes: 'Votre demande est envoyée. Réponse sous 7 jours.', recharger: false },
    );
    if (ok) {
      setOuverte(false);
      router.push('/parrainage/mes-parrainages');
    } else {
      setRefus('La demande n’est pas partie : voir le message affiché.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        data-demander-parrain=""
        style={eteint(style, complet)}
        aria-disabled={complet}
      >
        {complet ? 'Complet pour le moment' : libelle}
      </button>
      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        nom="DEMANDE-PARRAIN"
        titre={`Demander ${nom} comme parrain`}
        actions={
          <>
            <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>
              Annuler
            </button>
            <button
              type="button"
              disabled={!verdict.success || occupe}
              onClick={() => void envoyer()}
              style={{ ...eteint(BOUTON_PLEIN, !verdict.success || occupe), flex: 1 }}
            >
              {occupe ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: '13px', color: '#5D6B66', lineHeight: 1.5 }}>
          Présentez-vous et dites ce que vous cherchez : {nom} accepte ou refuse sans avoir à
          se justifier, et la demande expire au bout de 7 jours. Un parrainage est gratuit.
        </div>
        <div>
          <label htmlFor="parrain-message" style={LIBELLE}>
            Votre message
          </label>
          <textarea
            id="parrain-message"
            value={message}
            rows={6}
            maxLength={MENTORSHIP_MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Bonjour, je prépare mon arrivée à Lyon pour mes études et je cherche quelqu’un qui connaît les démarches…"
            style={{ ...CHAMP, resize: 'vertical' }}
          />
          <Compteur n={message.trim().length} min={MENTORSHIP_MESSAGE_MIN} max={MENTORSHIP_MESSAGE_MAX} />
        </div>
        {mesParcours.length === 0 ? null : (
          <div>
            <label htmlFor="parrain-parcours" style={LIBELLE}>
              Un de vos parcours (facultatif)
            </label>
            <select id="parrain-parcours" value={parcours} onChange={(e) => setParcours(e.target.value)} style={CHAMP}>
              <option value="">Aucun</option>
              {mesParcours.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {refus === null ? null : <Alerte>{refus}</Alerte>}
      </Feuille>
      {fenetre}
    </>
  );
}

// ── H05 : la liste des parrains, filtrable ───────────────────────────────────

const MODELES = journeyTemplatesResponseSchema;

const SELECT_PASTILLE: CSSProperties = {
  padding: '8px 13px',
  borderRadius: '999px',
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  background: '#fff',
  color: '#16211D',
  border: '1px solid #E6EBE9',
  maxWidth: '100%',
  cursor: 'pointer',
};

function Filtre({
  libelle,
  valeur,
  options,
  onChoisir,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly options: readonly { readonly id: string; readonly nom: string }[];
  readonly onChoisir: (id: string) => void;
}) {
  const actif = valeur !== '';
  return (
    <select
      aria-label={libelle}
      value={valeur}
      onChange={(e) => onChoisir(e.target.value)}
      style={{
        ...SELECT_PASTILLE,
        background: actif ? '#16785E' : '#fff',
        color: actif ? '#fff' : '#16211D',
        borderColor: actif ? '#16785E' : '#E6EBE9',
      }}
    >
      <option value="">{libelle}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nom}
        </option>
      ))}
    </select>
  );
}

export function ListeParrains({ variante }: { readonly variante: 'bureau' | 'mobile' }) {
  const [ville, setVille] = useState('');
  const [langue, setLangue] = useState('');
  const [modele, setModele] = useState('');
  const [pays, setPays] = useState('');
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [langues, setLangues] = useState<readonly { id: string; nom: string }[]>([]);
  const [payss, setPayss] = useState<readonly { id: string; nom: string }[]>([]);
  const [modeles, setModeles] = useState<readonly { id: string; code: string; nom: string }[]>([]);
  const [etat, setEtat] = useState<{ phase: 'attente' | 'echec' | 'pret'; items: readonly MentorCard[] }>({ phase: 'attente', items: [] });
  const [essai, setEssai] = useState(0);

  // Les référentiels des filtres, une fois. Un échec laisse le filtre sans options.
  useEffect(() => {
    let vivant = true;
    void Promise.allSettled([
      memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema),
      memberApi.get('/places/languages?limit=100', placesLanguagesResponseSchema),
      memberApi.get('/places/countries?limit=100', placesCountriesResponseSchema),
      memberApi.get('/journey-templates', MODELES),
      fetchMe(),
    ]).then(([v, l, p, m, moi]) => {
      if (!vivant) return;
      if (v.status === 'fulfilled') setVilles(v.value.items.map((c) => ({ id: c.id, nom: c.name })));
      if (l.status === 'fulfilled') setLangues(l.value.items.map((c) => ({ id: c.id, nom: c.nameFr })));
      if (p.status === 'fulfilled') setPayss(p.value.items.map((c) => ({ id: c.id, nom: c.nameFr })));
      if (m.status === 'fulfilled') setModeles(m.value.items.filter((t) => t.createsJourney).map((t) => ({ id: t.id, code: t.code, nom: t.nameFr })));
      // La ville du membre est le filtre de départ (la planche l'allume : « Lyon »).
      if (moi.status === 'fulfilled' && moi.value.user.cityId !== null) {
        const maVille = moi.value.user.cityId;
        setVille((c) => (c === '' ? maVille : c));
      }
    });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    let vivant = true;
    setEtat((e) => ({ phase: 'attente', items: e.items }));
    const requete = new URLSearchParams({ limit: '50' });
    if (ville !== '') requete.set('cityId', ville);
    if (langue !== '') requete.set('languageId', langue);
    if (pays !== '') requete.set('countryId', pays);
    if (modele !== '') requete.set('templateCode', modele);
    void memberApi
      .get(`/mentors?${requete.toString()}`, mentorsResponseSchema)
      .then((r) => {
        if (vivant) setEtat({ phase: 'pret', items: r.items });
      })
      .catch(() => {
        if (vivant) setEtat({ phase: 'echec', items: [] });
      });
    return () => {
      vivant = false;
    };
  }, [ville, langue, pays, modele, essai]);

  const noms = new Map(modeles.map((m) => [m.id, m.nom]));
  const mobile = variante === 'mobile';
  const aucunFiltre = ville === '' && langue === '' && pays === '' && modele === '';

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }} data-filtres-parrains="">
        <Filtre libelle="Ville" valeur={ville} options={villes} onChoisir={setVille} />
        <Filtre libelle="Langue" valeur={langue} options={langues} onChoisir={setLangue} />
        <Filtre libelle={mobile ? 'Parcours' : 'Type de parcours'} valeur={modele} options={modeles.map((m) => ({ id: m.code, nom: m.nom }))} onChoisir={setModele} />
        {mobile ? null : <Filtre libelle="Pays" valeur={pays} options={payss} onChoisir={setPays} />}
        {aucunFiltre ? null : (
          <button
            type="button"
            onClick={() => {
              setVille('');
              setLangue('');
              setPays('');
              setModele('');
            }}
            style={{ ...SELECT_PASTILLE, border: 'none', background: 'transparent', color: '#5D6B66' }}
          >
            Tout effacer
          </button>
        )}
      </div>
      {etat.phase === 'pret' && etat.items.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
          {etat.items.map((m) => (
            <CarteParrain key={m.userId} m={m} noms={noms} mobile={mobile} />
          ))}
        </div>
      ) : (
        <EtatListe
          etat={etat.phase === 'pret' ? 'vide' : etat.phase}
          onReessayer={() => setEssai((n) => n + 1)}
          vide={
            <>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>
                Aucun parrain ne correspond
              </div>
              <div style={{ marginTop: '4px' }}>
                {aucunFiltre
                  ? 'Il n’y a pas encore de parrain inscrit. Revenez bientôt.'
                  : 'Élargissez les filtres : la liste suit la ville, la langue, le parcours et le pays.'}
              </div>
            </>
          }
        />
      )}
    </>
  );
}

function CarteParrain({
  m,
  noms,
  mobile,
}: {
  readonly m: MentorCard;
  readonly noms: ReadonlyMap<string, string>;
  readonly mobile: boolean;
}) {
  const libre = m.availability === 'AVAILABLE';
  const types = m.journeyTemplateIds.flatMap((id) => {
    const n = noms.get(id);
    return n === undefined ? [] : [n];
  });
  const note = m.avgRating === null ? null : m.avgRating.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const pastille: CSSProperties = { background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' };
  const bouton: CSSProperties = { ...BOUTON_PLEIN, height: '38px', padding: '0 16px' };

  const dispo = (
    <span style={{ background: libre ? '#E3F0EB' : '#F2F5F4', color: libre ? '#0F5C48' : '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
      {libre ? 'Disponible' : 'Complet'}
    </span>
  );
  const corps = (
    <>
      <Link href={`/parrainage/${m.handle}`} data-nom-profil="" style={{ color: 'inherit', textDecoration: 'none', fontSize: '15px', fontWeight: 700 }}>
        {m.displayName}
      </Link>
      <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '2px' }}>{m.city?.name ?? '—'}</div>
      {types.length === 0 ? null : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', justifyContent: mobile ? 'flex-start' : 'center' }}>
          {types.map((t) => (
            <span key={t} style={pastille}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap', justifyContent: mobile ? 'flex-start' : 'center' }}>
        <strong style={{ fontSize: '12.5px' }}>
          {m.completedCount} parrainage{m.completedCount > 1 ? 's' : ''} mené{m.completedCount > 1 ? 's' : ''}
          {note === null ? '' : ` · ${note}`}
        </strong>
        <BoutonDemander handle={m.handle} nom={m.displayName} complet={!libre} libelle="Demander" style={bouton} />
      </div>
    </>
  );

  if (mobile) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '20px', padding: '14px', display: 'flex', gap: '12px', flexShrink: 0 }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '999px', background: '#16785E1F', color: '#16785E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 800, flexShrink: 0 }}>
          {initiales(m.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{dispo}</div>
          <div style={{ marginTop: '6px' }}>{corps}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '10px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ position: 'relative', height: '120px', borderRadius: '16px', background: '#16785E1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'repeating-linear-gradient(135deg,#DCE6E1 0 10px,#D2DED8 10px 20px)', border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: '#16785E' }}>
          {initiales(m.displayName)}
        </div>
        <span style={{ position: 'absolute', top: '10px', right: '10px' }}>{dispo}</span>
      </div>
      <div style={{ padding: '14px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>{corps}</div>
    </div>
  );
}

// ── H07 : mes parrainages, par état ──────────────────────────────────────────

type Parrainage = MyMentorshipsResponse['items'][number];

const jours = (iso: string): number => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const dateFr = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(iso));

export function MesParrainagesVivants({ variante }: { readonly variante: 'bureau' | 'mobile' }) {
  const mobile = variante === 'mobile';
  const [role, setRole] = useState<'mentee' | 'mentor'>('mentee');
  const version = useVersionEntraide();
  const [etat, setEtat] = useState<{ phase: 'attente' | 'echec' | 'pret'; items: readonly Parrainage[] }>({ phase: 'attente', items: [] });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let vivant = true;
    void memberApi
      .get(`/me/mentorships?role=${role}&state=all`, myMentorshipsResponseSchema)
      .then((r) => {
        if (vivant) setEtat({ phase: 'pret', items: r.items });
      })
      .catch(() => {
        if (vivant) setEtat((e) => ({ phase: 'echec', items: e.items }));
      });
    return () => {
      vivant = false;
    };
  }, [role, version, essai]);

  const actifs = etat.items.filter((p) => p.status === 'ACTIVE');
  const attente = etat.items.filter((p) => p.status === 'REQUESTED');
  const termines = etat.items.filter((p) => p.status === 'ENDED' || p.status === 'DECLINED' || p.status === 'CANCELLED');

  const titre = (texte: string): ReactNode => (
    <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F', marginTop: '6px' }}>{texte}</div>
  );

  return (
    <>
      <Segments
        valeur={role}
        onChoisir={setRole}
        options={[
          { cle: 'mentee', libelle: mobile ? 'Filleul·e' : 'Comme filleul·e' },
          { cle: 'mentor', libelle: mobile ? 'Parrain' : 'Comme parrain' },
        ]}
      />
      {etat.phase !== 'pret' && etat.items.length === 0 ? (
        <EtatListe etat={etat.phase === 'echec' ? 'echec' : 'attente'} vide={null} onReessayer={() => setEssai((n) => n + 1)} />
      ) : etat.items.length === 0 ? (
        <EtatListe
          etat="vide"
          onReessayer={() => undefined}
          vide={
            role === 'mentee' ? (
              <>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>Aucun parrainage pour l’instant</div>
                <div style={{ marginTop: '4px' }}>Un membre installé peut vous accompagner pendant 3 mois.</div>
                <Link href="/parrainage" style={{ ...BOUTON_PLEIN, margin: '12px auto 0', width: 'fit-content', textDecoration: 'none' }}>Trouver un parrain</Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>Aucune demande reçue</div>
                <div style={{ marginTop: '4px' }}>Activez votre profil de parrain pour apparaître dans la liste.</div>
                <Link href="/parrainage/devenir" style={{ ...BOUTON_PLEIN, margin: '12px auto 0', width: 'fit-content', textDecoration: 'none' }}>Devenir parrain</Link>
              </>
            )
          }
        />
      ) : null}
      {actifs.map((p) => (
        <CarteParrainage key={p.id} p={p} mobile={mobile} />
      ))}
      {termines.length === 0 ? null : titre('TERMINÉS')}
      {termines.map((p) => (
        <CarteParrainage key={p.id} p={p} mobile={mobile} />
      ))}
      {attente.length === 0 ? null : titre('DEMANDES EN ATTENTE')}
      {attente.map((p) => (
        <CarteParrainage key={p.id} p={p} mobile={mobile} />
      ))}
    </>
  );
}

function CarteParrainage({ p, mobile }: { readonly p: Parrainage; readonly mobile: boolean }) {
  const { lancer, occupe, fenetre } = useGeste();
  const [fin, setFin] = useState(false);
  const [note, setNote] = useState(false);
  const nom = p.other?.displayName ?? 'Membre';
  const bouton: CSSProperties = { ...BOUTON_DISCRET, height: '38px' };
  const termine = p.status === 'ENDED' || p.status === 'DECLINED' || p.status === 'CANCELLED';

  let sous: ReactNode = null;
  if (p.status === 'ACTIVE') {
    sous = p.endsAt === null ? null : <strong style={{ fontSize: '12.5px' }}>Fin dans {jours(p.endsAt)} jours{p.extended ? ' · prolongé' : ''}</strong>;
  } else if (p.status === 'REQUESTED') {
    const recue = p.role === 'mentor';
    sous = (
      <span style={{ fontSize: '12px', color: '#8A958F' }}>
        {recue ? 'Demande reçue' : 'Demande envoyée'}
        {p.expiresAt === null ? '' : ` · ${jours(p.expiresAt)} jour${jours(p.expiresAt) > 1 ? 's' : ''} restants`}
      </span>
    );
  } else if (p.status === 'ENDED') {
    sous = (
      <span style={{ fontSize: '12px', color: '#8A958F' }}>
        Parrainage terminé{p.endedAt === null ? '' : ` le ${dateFr(p.endedAt)}`}
        {p.endReason === 'COMPLETED' ? '' : ' avant son terme'}
      </span>
    );
  } else {
    sous = <span style={{ fontSize: '12px', color: '#8A958F' }}>{p.status === 'DECLINED' ? 'Demande refusée' : 'Demande annulée ou expirée'}</span>;
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: mobile ? '20px' : '22px', padding: mobile ? '14px' : '18px', flexShrink: 0, opacity: termine && p.status !== 'ENDED' ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '999px', background: '#0F5C48', color: '#fff', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {initiales(nom)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {p.other === null ? (
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{nom}</span>
          ) : (
            <Link href={`/@${p.other.handle}`} data-nom-profil="" style={{ color: 'inherit', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
              {nom}
            </Link>
          )}
          <span style={{ display: 'block', fontSize: '12px', color: '#8A958F' }}>{p.role === 'mentee' ? 'Votre parrain' : 'Votre filleul·e'}</span>
        </span>
      </div>
      <div style={{ marginTop: '10px' }}>{sous}</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        {p.status === 'ACTIVE' ? (
          <>
            {p.conversationId === null ? null : (
              <Link href={`/messages/${p.conversationId}`} style={{ ...bouton, textDecoration: 'none' }}>
                Discussion
              </Link>
            )}
            <button
              type="button"
              disabled={!p.canExtend || occupe}
              onClick={() => {
                void lancer(() => memberApi.post(`/mentorships/${p.id}/extend`, extendedSchema), { succes: 'Parrainage prolongé de 90 jours.' });
              }}
              style={eteint(bouton, !p.canExtend || occupe)}
              title={p.canExtend ? undefined : 'Un parrainage ne se prolonge qu’une fois.'}
            >
              Prolonger
            </button>
            <button type="button" onClick={() => setFin(true)} style={{ ...bouton, background: '#fff', border: '1px solid #E6EBE9' }}>
              Terminer
            </button>
          </>
        ) : null}
        {p.status === 'REQUESTED' && p.role === 'mentor' ? (
          <>
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                void lancer(() => memberApi.post(`/mentorships/${p.id}/accept`, mentorshipAcceptedSchema), { succes: 'Parrainage accepté : une conversation est ouverte.' });
              }}
              style={eteint({ ...BOUTON_PLEIN, height: '38px' }, occupe)}
            >
              Accepter
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                void lancer(() => memberApi.post(`/mentorships/${p.id}/decline`, z.unknown()), { succes: 'Demande refusée.' });
              }}
              style={eteint(bouton, occupe)}
            >
              Refuser
            </button>
          </>
        ) : null}
        {p.status === 'REQUESTED' && p.role === 'mentee' ? (
          <button type="button" onClick={() => setFin(true)} style={bouton}>
            Retirer ma demande
          </button>
        ) : null}
        {p.status === 'ENDED' && p.canReview ? (
          <button type="button" onClick={() => setNote(true)} style={{ ...BOUTON_PLEIN, height: '38px' }}>
            Évaluer
          </button>
        ) : null}
      </div>
      {p.status === 'ENDED' && p.myReview !== null ? (
        <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#5D6B66' }}>
          Votre évaluation : {'★'.repeat(p.myReview.rating)}
          {p.theirReview === null ? ' · en attente de celle de l’autre membre' : ` · reçue : ${'★'.repeat(p.theirReview.rating)}`}
        </div>
      ) : null}
      <FenetreConfirmation
        ouverte={fin}
        nom="TERMINER-PARRAINAGE"
        titre={p.status === 'REQUESTED' ? 'Retirer cette demande ?' : 'Terminer ce parrainage ?'}
        question={p.status === 'REQUESTED' ? 'Vous pourrez en faire une autre.' : `${nom} sera prévenu·e, sans motif affiché.`}
        {...(p.status === 'REQUESTED' ? {} : { precision: 'Une fin avant terme ne crédite pas la réputation du parrain et ne crée pas de contact.' })}
        libelleConfirmer={p.status === 'REQUESTED' ? 'Retirer' : 'Terminer'}
        onAnnuler={() => setFin(false)}
        occupe={occupe}
        onConfirmer={() => {
          void lancer(() => memberApi.post(`/mentorships/${p.id}/end`, z.unknown()), {
            succes: p.status === 'REQUESTED' ? 'Demande retirée.' : 'Parrainage terminé.',
          }).then((ok) => {
            if (ok) setFin(false);
          });
        }}
      />
      <FeuilleEvaluation p={p} ouverte={note} onFermer={() => setNote(false)} nom={nom} />
      {fenetre}
    </div>
  );
}

const extendedSchema = z.object({ endsAt: z.string() }).passthrough();

function FeuilleEvaluation({
  p,
  ouverte,
  onFermer,
  nom,
}: {
  readonly p: Parrainage;
  readonly ouverte: boolean;
  readonly onFermer: () => void;
  readonly nom: string;
}) {
  const { lancer, occupe, fenetre } = useGeste();
  const [etoiles, setEtoiles] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  return (
    <>
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        nom="EVALUER-PARRAINAGE"
        titre={`Évaluer ${nom}`}
        actions={
          <>
            <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>Annuler</button>
            <button
              type="button"
              disabled={etoiles === 0 || occupe}
              style={{ ...eteint(BOUTON_PLEIN, etoiles === 0 || occupe), flex: 1 }}
              onClick={() => {
                void lancer(
                  () => memberApi.post(`/mentorships/${p.id}/review`, z.unknown(), { body: { rating: etoiles, ...(commentaire.trim() === '' ? {} : { comment: commentaire.trim() }) } }),
                  { succes: 'Merci : votre évaluation est déposée.' },
                ).then((ok) => {
                  if (ok) onFermer();
                });
              }}
            >
              Déposer
            </button>
          </>
        }
      >
        <div style={{ fontSize: '13px', color: '#5D6B66', lineHeight: 1.5 }}>
          Elle ne sera visible qu’une fois les deux évaluations déposées, ou après 14 jours.
        </div>
        <div role="radiogroup" aria-label="Note" style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={etoiles === n}
              aria-label={`${String(n)} sur 5`}
              onClick={() => setEtoiles(n)}
              style={{ width: '44px', height: '44px', borderRadius: '14px', border: `1.5px solid ${etoiles >= n ? '#E0733A' : '#E6EBE9'}`, background: etoiles >= n ? '#FFFBF8' : '#fff', color: '#E0733A', fontSize: '20px', cursor: 'pointer' }}
            >
              {etoiles >= n ? '★' : '☆'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="eval-commentaire" style={LIBELLE}>Un mot (facultatif)</label>
          <textarea id="eval-commentaire" rows={4} maxLength={MENTORSHIP_REVIEW_COMMENT_MAX} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} style={{ ...CHAMP, resize: 'vertical' }} />
        </div>
      </Feuille>
      {fenetre}
    </>
  );
}

// ── H08 : devenir parrain ────────────────────────────────────────────────────

export function FormulaireParrain({ variante }: { readonly variante: 'bureau' | 'mobile' }) {
  const mobile = variante === 'mobile';
  const { lancer, occupe, fenetre } = useGeste();
  const version = useVersionEntraide();
  const [moi, setMoi] = useState<MyMentorProfileResponse | null>(null);
  const [echec, setEchec] = useState(false);
  const [modeles, setModeles] = useState<readonly { id: string; nom: string }[]>([]);
  const [bio, setBio] = useState('');
  const [choix, setChoix] = useState<readonly string[]>([]);
  const [max, setMax] = useState<number>(MENTOR_DEFAULT_MAX_MENTEES);
  const [dispo, setDispo] = useState(true);
  const [arret, setArret] = useState(false);
  const [initialise, setInitialise] = useState(false);

  useEffect(() => {
    let vivant = true;
    void Promise.allSettled([
      memberApi.get('/me/mentor-profile', myMentorProfileResponseSchema),
      memberApi.get('/journey-templates', journeyTemplatesResponseSchema),
    ]).then(([p, m]) => {
      if (!vivant) return;
      if (p.status === 'rejected') {
        setEchec(true);
        return;
      }
      setEchec(false);
      setMoi(p.value);
      if (m.status === 'fulfilled') setModeles(m.value.items.filter((t) => t.createsJourney).map((t) => ({ id: t.id, nom: t.nameFr })));
      // Le formulaire reprend le profil existant, UNE fois : relire après un
      // enregistrement ne doit pas écraser ce que le membre est en train de taper.
      if (!initialise && p.value.profile !== null) {
        setBio(p.value.profile.bio ?? '');
        setChoix(p.value.profile.journeyTemplateIds);
        setMax(p.value.profile.maxMentees);
        setDispo(p.value.profile.isAvailable);
        setInitialise(true);
      }
    });
    return () => {
      vivant = false;
    };
    // `initialise` ne relance pas la lecture : il ne sert qu'à ne pas réécrire le formulaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const brouillon = { ...(bio.trim() === '' ? {} : { bio: bio.trim() }), journeyTemplateIds: choix, maxMentees: max, isAvailable: dispo };
  const verdict = mentorProfileSchema.safeParse(brouillon);
  const profil = moi?.profile ?? null;
  const eligible = moi?.eligibility.eligible ?? false;

  const condition = (ok: boolean, texte: string, lien?: { href: string; libelle: string }): ReactNode => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <span
        aria-hidden="true"
        style={{ width: '22px', height: '22px', borderRadius: '999px', background: ok ? '#16785E' : '#F2F5F4', color: ok ? '#fff' : '#8A958F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}
      >
        {ok ? '✓' : '·'}
      </span>
      <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: ok ? '#16211D' : '#5D6B66' }}>
        {texte}
        <span className="sr-only">{ok ? ' : remplie' : ' : manquante'}</span>
      </span>
      {ok || lien === undefined ? null : (
        <Link href={lien.href} style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F5C48' }}>
          {lien.libelle}
        </Link>
      )}
    </div>
  );

  if (echec) return <EtatListe etat="echec" vide={null} onReessayer={() => window.location.reload()} />;
  if (moi === null) return <EtatListe etat="attente" vide={null} onReessayer={() => undefined} />;

  const enregistrer = (): void => {
    if (!verdict.success || occupe) return;
    void lancer(() => memberApi.put('/me/mentor-profile', mentorProfileResponseSchema, { body: verdict.data }), {
      succes: profil === null ? 'Votre profil de parrain est actif.' : 'Votre profil est enregistré.',
    });
  };

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: mobile ? '20px' : '22px', padding: mobile ? '16px' : '20px', flexShrink: 0 }}>
        <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F', marginBottom: '4px' }}>CONDITIONS</div>
        {condition(moi.eligibility.identity, 'Identité vérifiée', { href: '/compte/verification', libelle: 'Vérifier' })}
        {condition(moi.eligibility.phone, 'Numéro français vérifié', { href: '/compte/verification', libelle: 'Vérifier' })}
        {condition(
          moi.eligibility.experience.ok,
          'Parcours abouti ou 12 mois d’installation',
          { href: '/parcours', libelle: 'Mes parcours' },
        )}
        {eligible ? null : (
          <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#B4581F', fontWeight: 700 }}>
            Il manque au moins une condition : le profil ne peut pas encore être activé.
          </div>
        )}
      </div>
      <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: mobile ? '20px' : '22px', padding: mobile ? '16px' : '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label htmlFor="parrain-bio" style={LIBELLE}>Votre présentation</label>
          <textarea
            id="parrain-bio"
            rows={4}
            value={bio}
            maxLength={MENTOR_BIO_MAX}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Arrivée comme étudiante en 2019, aujourd’hui comptable à Lyon…"
            style={{ ...CHAMP, resize: 'vertical' }}
          />
          <Compteur n={bio.trim().length} min={20} max={MENTOR_BIO_MAX} />
        </div>
        {modeles.length === 0 ? null : (
          <div>
            <div style={LIBELLE}>Parcours que vous connaissez</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Parcours que vous connaissez">
              {modeles.map((m) => (
                <Pastille key={m.id} actif={choix.includes(m.id)} onClick={() => setChoix((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id]))}>
                  {m.nom}
                </Pastille>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={LIBELLE}>Nombre de filleuls en même temps</div>
          <div style={{ display: 'flex', gap: '6px' }} role="group" aria-label="Nombre de filleuls en même temps">
            {Array.from({ length: MENTOR_MAX_MAX_MENTEES }, (_, i) => i + 1).map((n) => (
              <Pastille
                key={n}
                actif={max === n}
                eteinte={profil !== null && n < profil.activeMenteeCount}
                onClick={() => setMax(n)}
              >
                {n}
              </Pastille>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={dispo} onChange={(e) => setDispo(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#16785E' }} />
          <span>
            <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700 }}>Disponible maintenant</span>
            <span style={{ display: 'block', fontSize: '12px', color: '#5D6B66' }}>Vous apparaissez dans la liste des parrains.</span>
          </span>
        </label>
        {verdict.success || bio.trim() === '' ? null : <Alerte>Votre présentation doit faire au moins 20 caractères.</Alerte>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={enregistrer}
            disabled={!verdict.success || !eligible || occupe}
            data-activer-profil=""
            style={{ ...eteint(BOUTON_PLEIN, !verdict.success || !eligible || occupe), flex: 1, height: mobile ? '44px' : '50px' }}
          >
            {profil === null ? 'Activer mon profil de parrain' : 'Enregistrer mon profil'}
          </button>
          {profil !== null && profil.isAvailable ? (
            <button type="button" onClick={() => setArret(true)} style={{ ...BOUTON_DISCRET, height: mobile ? '44px' : '50px' }}>
              Cesser d’être parrain
            </button>
          ) : null}
        </div>
        {profil !== null && !profil.isAvailable ? (
          <div style={{ fontSize: '12.5px', color: '#5D6B66' }}>Votre profil est désactivé : il n’apparaît plus dans la liste. Enregistrez avec « Disponible » pour le rallumer.</div>
        ) : null}
      </div>
      <FenetreConfirmation
        ouverte={arret}
        nom="CESSER-PARRAIN"
        titre="Cesser d’être parrain ?"
        question="Votre profil disparaît de la liste."
        precision="Vos parrainages en cours continuent jusqu’à leur terme."
        libelleConfirmer="Cesser"
        onAnnuler={() => setArret(false)}
        occupe={occupe}
        onConfirmer={() => {
          void lancer(() => memberApi.del('/me/mentor-profile', voidResponse), { succes: 'Votre profil de parrain est désactivé.' }).then((ok) => {
            if (ok) {
              setArret(false);
              setDispo(false);
            }
          });
        }}
      />
      {fenetre}
    </>
  );
}
