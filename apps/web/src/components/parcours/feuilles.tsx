'use client';

/**
 * AJOUT HORS MAQUETTE — LES FEUILLES DU MODULE PARCOURS, AVEC DE VRAIS CHAMPS.
 *
 * La maquette dessine « Je suis bloqué·e » (3 volets), « Partager un jalon »,
 * « Inviter dans l'équipe », « Exporter », « Arrêter » et « Mes parcours » comme des
 * images de formulaires : aucun champ, et « Publier » / « Partager » sans geste. Ces
 * feuilles les rendent réels, dans le châssis de `FenetreEcrire` (voile
 * `rgba(22,33,29,.55)`, panneau de 440 px, bord `#DDE3E0`, rayon 28, retrait 24, croix
 * de 40 px) — le même que K08 et D08.
 *
 * ── LES DEUX RÈGLES DURES QUE CE FICHIER PORTE ──────────────────────────────
 *
 * §3.5 — « Je suis bloqué·e » est un flux en QUATRE temps : le clic crée un BROUILLON
 * (rien n'est publié), le texte est relu et réécrit, la portée est choisie, et seule
 * l'étape « Aperçu » offre « Publier » — dont le texte envoyé est CELUI DU CHAMP, jamais
 * le gabarit. Annuler passe le brouillon en `CANCELLED`.
 *
 * §3.6 — « Partager un jalon » : le champ est VIDE (aucun texte pré-rédigé), l'aperçu
 * montre l'encart « Étape franchie · N sur M », « Plus tard » est définitif pour l'étape.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BLOCKER_TEXT_MAX,
  BLOCKER_TEXT_MIN,
  JOURNEY_MAX_MEMBERS,
  MILESTONE_TEXT_MAX,
  TEMPLATE_ERROR_MESSAGE_MAX,
  TEMPLATE_ERROR_MESSAGE_MIN,
  myConnectionsResponseSchema,
  type BlockerDraftResponse,
  type JourneyFullResponse,
  type JourneyListItem,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';
import { LevelInvitation } from '@/components/level-invitation';
import { Modal } from '@/components/modal';
import {
  cancelBlocker,
  createBlockerDraft,
  dismissShare,
  inviteMember,
  listJourneys,
  publishBlocker,
  readJourney,
  reportTemplateError,
  shareMilestone,
  updateJourney,
} from '@/screens/parcours/api';
import { Avis, Bouton, C, Champ, Etiquette, Icone, ICONES, Pastille, ZoneTexte } from './ui';
import { fermerFeuille, useFeuille } from './feuilles-store';
import { signalerMaj, useGeste, useIdParcours } from './donnees';

/** Le châssis commun : voile, panneau, en-tête à croix. */
function Panneau({
  titreId,
  titre,
  children,
  onFermer,
}: {
  readonly titreId: string;
  readonly titre: string;
  readonly children: ReactNode;
  readonly onFermer: () => void;
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)' }} data-modal-overlay="" />
      <div
        data-modal-panel=""
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '440px',
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          border: '1px solid #DDE3E0',
          borderRadius: '28px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 id={titreId} style={{ margin: 0, flex: 1, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {titre}
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
            onClick={onFermer}
            style={{ width: '40px', height: '40px', borderRadius: '999px', background: C.fond, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, color: C.texte }}
          >
            <Icone d={ICONES.croix} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ═══ JE SUIS BLOQUÉ·E (§3.5) ═══════════════════════════════════════════════

const CIBLES: Record<string, string> = {
  HELP: 'une demande d’entraide',
  HOUSING: 'une recherche de logement',
  JOBS: 'votre profil de recherche d’emploi',
  MENTORSHIP: 'une demande de parrainage',
};

function ContenuBlocage({ stepId, onFermer }: { readonly stepId: string | undefined; readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const [volet, setVolet] = useState(0);
  const [brouillon, setBrouillon] = useState<BlockerDraftResponse['blocker'] | null>(null);
  const [parcours, setParcours] = useState<JourneyFullResponse | null>(null);
  const [texte, setTexte] = useState('');
  const [prive, setPrive] = useState(false);
  const [titre, setTitre] = useState('');
  const [parrain, setParrain] = useState('');
  const [secteurs, setSecteurs] = useState('');
  const [contrats, setContrats] = useState('');
  const [fait, setFait] = useState<{ lien: string | null; libelle: string } | null>(null);
  const geste = useGeste();

  // §3.5, premier temps : le clic crée le BROUILLON — rien n'est publié.
  useEffect(() => {
    if (idParcours === null) return;
    let annule = false;
    void geste
      .executer(async () => {
        const complet = await readJourney(idParcours);
        const cible = stepId ?? complet.journey.currentStepId;
        if (cible === null) {
          geste.signaler('Toutes les étapes de ce parcours sont franchies : il n’y a rien à débloquer.');
          return;
        }
        const { blocker } = await createBlockerDraft(idParcours, cible);
        if (annule) return;
        setParcours(complet);
        setBrouillon(blocker);
        setTexte(blocker.draftText);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
    // Une seule création à l'ouverture : `geste` est stable.
  }, [idParcours, stepId]);

  const etape = parcours?.steps.find((s) => s.id === brouillon?.journeyStepId);
  const cible = brouillon?.target ?? 'HELP';
  const texteValide = texte.trim().length >= BLOCKER_TEXT_MIN && texte.trim().length <= BLOCKER_TEXT_MAX;
  const titreRequis = !prive && (cible === 'HELP' || cible === 'HOUSING' || cible === 'JOBS');
  const titreValide = !titreRequis || (titre.trim().length >= 10 && titre.trim().length <= 120);
  const parrainValide = prive || cible !== 'MENTORSHIP' || parrain.trim().length >= 2;

  const annuler = () => {
    if (brouillon !== null && fait === null) {
      void cancelBlocker(brouillon.id).catch(() => undefined);
    }
    onFermer();
  };

  const publier = () => {
    if (brouillon === null) return;
    void geste.executer(async () => {
      const liste = (valeur: string) =>
        valeur
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length >= 2);
      const reponse = await publishBlocker(brouillon.id, {
        // §3.5 : LE TEXTE PUBLIÉ EST CELUI DU CHAMP, tel que le membre l'a écrit.
        text: texte.trim(),
        isPrivate: prive,
        ...(titreRequis ? { title: titre.trim() } : {}),
        ...(!prive && cible === 'MENTORSHIP' ? { mentorHandle: parrain.trim().replace(/^@/, '') } : {}),
        ...(!prive && cible === 'JOBS'
          ? { sectors: liste(secteurs), contractTypes: liste(contrats) }
          : {}),
      });
      const ref = reponse.blocker;
      const type = ref.publishedRefType;
      setFait({
        libelle: prive
          ? 'Votre message a été envoyé à votre équipe, dans la discussion du parcours.'
          : `Votre demande est publiée : ${CIBLES[cible] ?? 'votre demande'}.`,
        lien: prive
          ? idParcours === null
            ? null
            : `/parcours/${idParcours}/discussion`
          : type === 'help_request'
            ? `/entraide/${ref.publishedRefId}`
            : type === 'housing_listing'
              ? `/services/logement/${ref.publishedRefId}`
              : type === 'job_seeker_profile'
                ? '/services/emploi'
                : '/parrainage',
      });
      signalerMaj();
    });
  };

  if (fait !== null) {
    return (
      <>
        <Avis texte={fait.libelle} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Bouton ton="calme" plein onClick={onFermer}>
            Fermer
          </Bouton>
          {fait.lien === null ? null : (
            <Link
              href={fait.lien}
              onClick={onFermer}
              style={{ flex: 1, height: '48px', borderRadius: '14px', background: C.vert, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}
            >
              Voir
            </Link>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ fontSize: '12.5px', color: C.gris }}>
        {etape === undefined ? 'Préparation du brouillon…' : `Étape ${String(etape.position)} · ${etape.title}`}
        {brouillon === null ? null : ` · volet ${String(volet + 1)} sur 3`}
      </div>

      {volet === 0 ? (
        <>
          <ZoneTexte
            id="bloque-texte"
            etiquette="Votre message"
            valeur={texte}
            onChange={setTexte}
            lignes={7}
            maxLength={BLOCKER_TEXT_MAX}
            aide={`Complétez le texte pré-rempli : c’est CE texte qui sera publié, rien d’autre. Entre ${String(BLOCKER_TEXT_MIN)} et ${String(BLOCKER_TEXT_MAX)} caractères.`}
          />
          <Avis texte={geste.erreur} ton="erreur" />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Bouton ton="calme" onClick={annuler}>
              Annuler
            </Bouton>
            <Bouton plein disabled={brouillon === null || !texteValide} onClick={() => setVolet(1)}>
              Suivant
            </Bouton>
          </div>
        </>
      ) : null}

      {volet === 1 ? (
        <>
          <Etiquette>QUI PEUT LE VOIR ?</Etiquette>
          {[
            [false, 'Public', `Publié dans la section concernée : ${CIBLES[cible] ?? 'une demande'}.`],
            [true, 'Mon équipe seulement', 'Envoyé aux accompagnants et au parrain, dans la discussion du parcours. Rien de public.'],
          ].map(([valeur, libelle, aide]) => (
            <label
              key={String(libelle)}
              style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '14px', border: prive === valeur ? `2px solid ${C.vert}` : `1px solid ${C.bord}`, background: prive === valeur ? C.vertPale : '#fff', cursor: 'pointer' }}
            >
              <input type="radio" name="portee" checked={prive === valeur} onChange={() => setPrive(valeur as boolean)} style={{ accentColor: C.vert, marginTop: '3px' }} />
              <span>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{libelle as string}</span>
                <span style={{ display: 'block', fontSize: '12.5px', color: C.gris, lineHeight: 1.45 }}>{aide as string}</span>
              </span>
            </label>
          ))}
          {titreRequis ? (
            <Champ
              id="bloque-titre"
              etiquette={cible === 'JOBS' ? 'Votre accroche' : 'Titre de la publication'}
              valeur={titre}
              maxLength={120}
              onChange={setTitre}
              aide="Entre 10 et 120 caractères. Il ne reprend pas le nom personnel de votre parcours."
            />
          ) : null}
          {!prive && cible === 'JOBS' ? (
            <>
              <Champ id="bloque-secteurs" etiquette="Secteurs (séparés par des virgules)" valeur={secteurs} onChange={setSecteurs} />
              <Champ id="bloque-contrats" etiquette="Types de contrat (séparés par des virgules)" valeur={contrats} onChange={setContrats} />
            </>
          ) : null}
          {!prive && cible === 'MENTORSHIP' ? (
            <Champ id="bloque-parrain" etiquette="Pseudo du parrain sollicité" valeur={parrain} onChange={setParrain} placeholder="@pseudo" aide="Vous choisissez la personne : rien n’est envoyé à quelqu’un d’autre." />
          ) : null}
          <Avis texte={geste.erreur} ton="erreur" />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Bouton ton="calme" onClick={() => setVolet(0)}>
              Retour
            </Bouton>
            <Bouton plein disabled={!titreValide || !parrainValide} onClick={() => setVolet(2)}>
              Voir l’aperçu
            </Bouton>
          </div>
        </>
      ) : null}

      {volet === 2 ? (
        <>
          <Etiquette>APERÇU</Etiquette>
          <div style={{ border: `1px solid ${C.bord}`, borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {titreRequis ? <div style={{ fontSize: '14.5px', fontWeight: 800 }}>{titre.trim()}</div> : null}
            <div style={{ fontSize: '13.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{texte.trim()}</div>
            <div>
              <Pastille>{prive ? 'MON ÉQUIPE SEULEMENT' : 'PUBLIC'}</Pastille>
            </div>
          </div>
          <Avis texte={geste.erreur} ton="erreur" />
          <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Bouton ton="calme" onClick={() => setVolet(1)}>
              Retour
            </Bouton>
            <Bouton plein disabled={geste.occupe} onClick={publier}>
              {geste.occupe ? 'Publication…' : 'Publier'}
            </Bouton>
          </div>
        </>
      ) : null}
    </>
  );
}

// ═══ PARTAGER UN JALON (§3.6) ═══════════════════════════════════════════════

function ContenuPartage({ stepId, onFermer }: { readonly stepId: string | undefined; readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const [parcours, setParcours] = useState<JourneyFullResponse | null>(null);
  const [texte, setTexte] = useState('');
  const [fait, setFait] = useState(false);
  const geste = useGeste();

  useEffect(() => {
    if (idParcours === null) return;
    void readJourney(idParcours).then(setParcours, () => undefined);
  }, [idParcours]);

  const etape =
    parcours?.steps.find((s) => s.id === stepId) ??
    [...(parcours?.steps ?? [])].reverse().find((s) => s.status === 'DONE' && s.isMajorMilestone);

  const publier = () => {
    if (idParcours === null || etape === undefined) return;
    void geste.executer(async () => {
      await shareMilestone(idParcours, etape.id, { text: texte.trim() });
      setFait(true);
    });
  };
  const plusTard = () => {
    if (idParcours !== null && etape !== undefined) void dismissShare(idParcours, etape.id).catch(() => undefined);
    onFermer();
  };

  if (fait) {
    return (
      <>
        <Avis texte="Votre victoire est publiée dans le fil." />
        <Bouton ton="calme" plein onClick={onFermer}>
          Fermer
        </Bouton>
      </>
    );
  }
  return (
    <>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
        Racontez ce qui vous a aidé : cela encourage ceux qui préparent leur départ. Le champ est vide, c’est
        vous qui écrivez.
      </div>
      <div style={{ background: C.vertPale, border: `1px solid ${C.vertPale2}`, borderRadius: '14px', padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: C.vertFonce }}>
        Étape franchie · {parcours?.journey.doneCount ?? '…'} sur {parcours?.journey.totalCount ?? '…'}
        {etape === undefined ? '' : ` — ${etape.title}`}
      </div>
      <ZoneTexte id="partage-texte" etiquette="Votre message" valeur={texte} onChange={setTexte} maxLength={MILESTONE_TEXT_MAX} lignes={5} />
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Bouton ton="calme" onClick={plusTard}>
          Plus tard
        </Bouton>
        <Bouton plein disabled={geste.occupe || texte.trim().length < 1 || etape === undefined} onClick={publier}>
          {geste.occupe ? 'Publication…' : 'Publier'}
        </Bouton>
      </div>
    </>
  );
}

// ═══ INVITER DANS L'ÉQUIPE (§3.4) ═══════════════════════════════════════════

type Contact = { readonly handle: string; readonly displayName: string };

function ContenuInviter({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const [pseudo, setPseudo] = useState('');
  const [role, setRole] = useState<'OBSERVER' | 'SUPPORTER'>('SUPPORTER');
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [invites, setInvites] = useState<readonly string[]>([]);
  const geste = useGeste();

  useEffect(() => {
    void memberApi.get('/me/connections', myConnectionsResponseSchema).then(
      (page) => setContacts(page.items.map((c) => ({ handle: c.handle, displayName: c.displayName }))),
      () => undefined,
    );
  }, []);

  const inviter = (handle: string) => {
    if (idParcours === null) return;
    void geste.executer(
      async () => {
        await inviteMember(idParcours, { userHandle: handle.replace(/^@/, ''), role });
        setInvites((l) => [...l, handle]);
        setPseudo('');
      },
      { majPanneau: true },
    );
  };

  return (
    <>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
        Jusqu’à {JOURNEY_MAX_MEMBERS} personnes. Elles reçoivent une invitation et acceptent ou refusent.
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <legend style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', padding: 0 }}>Son rôle</legend>
        {(
          [
            ['OBSERVER', 'Observateur', 'Voit la progression.'],
            ['SUPPORTER', 'Accompagnant', 'Peut échanger et recevoir vos demandes privées.'],
          ] as const
        ).map(([valeur, libelle, aide]) => (
          <label key={valeur} style={{ display: 'flex', gap: '10px', padding: '10px 14px', borderRadius: '14px', border: role === valeur ? `2px solid ${C.vert}` : `1px solid ${C.bord}`, background: role === valeur ? C.vertPale : '#fff', cursor: 'pointer' }}>
            <input type="radio" name="role" checked={role === valeur} onChange={() => setRole(valeur)} style={{ accentColor: C.vert, marginTop: '3px' }} />
            <span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{libelle}</span>
              <span style={{ display: 'block', fontSize: '12.5px', color: C.gris }}>{aide}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Champ id="inviter-pseudo" etiquette="Pseudo" valeur={pseudo} onChange={setPseudo} placeholder="@pseudo" />
        </div>
        <Bouton disabled={geste.occupe || pseudo.replace(/^@/, '').trim().length < 3} onClick={() => inviter(pseudo.trim())}>
          Inviter
        </Bouton>
      </div>
      {contacts.length === 0 ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Etiquette>MES CONTACTS</Etiquette>
          {contacts.slice(0, 6).map((c) => (
            <div key={c.handle} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600 }}>
                {c.displayName === '' ? `@${c.handle}` : c.displayName}
              </span>
              {invites.includes(c.handle) ? (
                <Pastille>INVITÉ·E</Pastille>
              ) : (
                <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => inviter(c.handle)}>
                  Inviter
                </Bouton>
              )}
            </div>
          ))}
        </div>
      )}
      {invites.length === 0 ? null : <Avis texte={`Invitation envoyée à ${invites.map((h) => `@${h.replace(/^@/, '')}`).join(', ')}.`} />}
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
      <Bouton ton="calme" plein onClick={onFermer}>
        Terminé
      </Bouton>
    </>
  );
}

// ═══ ARRÊTER (§3.9) ═════════════════════════════════════════════════════════

function ContenuArreter({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const router = useRouter();
  const [parcours, setParcours] = useState<JourneyFullResponse | null>(null);
  const geste = useGeste();
  useEffect(() => {
    if (idParcours === null) return;
    void readJourney(idParcours).then(setParcours, () => undefined);
  }, [idParcours]);

  const arreter = () => {
    if (idParcours === null) return;
    void geste.executer(async () => {
      await updateJourney(idParcours, { status: 'ABANDONED' });
      signalerMaj();
      onFermer();
      router.push('/parcours');
    });
  };
  return (
    <>
      <div style={{ fontSize: '13.5px', lineHeight: 1.55 }}>
        Votre projet a évolué, c’est normal. Vos {parcours?.journey.doneCount ?? ''} étapes franchies restent dans
        votre historique et vous pourrez créer un autre parcours.
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Bouton ton="calme" plein onClick={onFermer}>
          Garder
        </Bouton>
        <Bouton plein disabled={geste.occupe} onClick={arreter}>
          Arrêter
        </Bouton>
      </div>
    </>
  );
}

// ═══ EXPORTER (J07) ═════════════════════════════════════════════════════════

function ContenuExporter({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  return (
    <>
      <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: C.gris }}>
        Votre parcours — étapes, durées réelles et journal — s’ouvre dans une page prête à imprimer. Choisissez
        « Enregistrer au format PDF » dans la fenêtre d’impression. Vos notes ne sont pas incluses.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Bouton ton="calme" onClick={onFermer}>
          Annuler
        </Bouton>
        {idParcours === null ? null : (
          <Link
            href={`/parcours/${idParcours}/export`}
            onClick={onFermer}
            style={{ flex: 1, height: '48px', borderRadius: '14px', background: C.vert, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}
          >
            Exporter
          </Link>
        )}
      </div>
    </>
  );
}

// ═══ MES PARCOURS (J01M) ════════════════════════════════════════════════════

function ContenuSelecteur({ onFermer }: { readonly onFermer: () => void }) {
  const [liste, setListe] = useState<readonly JourneyListItem[] | null>(null);
  useEffect(() => {
    void listJourneys().then((r) => setListe(r.items), () => setListe([]));
  }, []);
  return (
    <>
      {liste === null ? <div role="status" style={{ color: C.gris }}>Chargement…</div> : null}
      {(liste ?? []).map((p) => (
        <Link
          key={p.id}
          href={`/parcours/${p.id}`}
          onClick={onFermer}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '16px', border: `1px solid ${C.bord}`, textDecoration: 'none', color: C.texte }}
        >
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{p.title}</span>
            <span style={{ display: 'block', fontSize: '12px', color: C.gris }}>
              {p.template.nameFr} · {p.destinationCity.name}
            </span>
          </span>
          <span style={{ fontSize: '14px', fontWeight: 800 }}>{Math.round(p.progressPct)}%</span>
        </Link>
      ))}
      <Link
        href="/parcours/nouveau"
        onClick={onFermer}
        style={{ height: '44px', borderRadius: '16px', border: `1.5px dashed #9FB3AB`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: C.vertFonce, textDecoration: 'none' }}
      >
        <Icone d={ICONES.plus} taille={15} /> Nouveau parcours
      </Link>
    </>
  );
}

// ═══ SIGNALER UNE ERREUR DANS CE MODÈLE (§2.4) ══════════════════════════════

function ContenuSignaler({ stepId, onFermer }: { readonly stepId: string | undefined; readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const [message, setMessage] = useState('');
  const [fait, setFait] = useState(false);
  const geste = useGeste();
  const envoyer = () => {
    if (idParcours === null) return;
    void geste.executer(async () => {
      await reportTemplateError(idParcours, { message: message.trim(), ...(stepId === undefined ? {} : { stepId }) });
      setFait(true);
    });
  };
  if (fait) {
    return (
      <>
        <Avis texte="Merci : l’équipe relira votre signalement et vous dira ce qu’elle en a fait." />
        <Bouton ton="calme" plein onClick={onFermer}>
          Fermer
        </Bouton>
      </>
    );
  }
  return (
    <>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
        Une information vous paraît fausse ou périmée ? Dites-nous laquelle. Cela corrige le modèle pour
        tout le monde, pas seulement pour vous.
      </div>
      <ZoneTexte id="signaler-message" etiquette="Qu’est-ce qui est inexact ?" valeur={message} onChange={setMessage} maxLength={TEMPLATE_ERROR_MESSAGE_MAX} lignes={5} aide={`Au moins ${String(TEMPLATE_ERROR_MESSAGE_MIN)} caractères.`} />
      <Avis texte={geste.erreur} ton="erreur" />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Bouton ton="calme" onClick={onFermer}>
          Annuler
        </Bouton>
        <Bouton plein disabled={geste.occupe || message.trim().length < TEMPLATE_ERROR_MESSAGE_MIN} onClick={envoyer}>
          Envoyer
        </Bouton>
      </div>
    </>
  );
}

// ═══ LE MONTAGE ═════════════════════════════════════════════════════════════

const TITRES: Record<string, string> = {
  blocage: 'Je suis bloqué·e',
  partage: 'Partager un jalon',
  inviter: 'Inviter dans l’équipe',
  arreter: 'Arrêter ce parcours ?',
  exporter: 'Exporter mon parcours',
  selecteur: 'Mes parcours',
  signaler: 'Signaler une erreur dans ce modèle',
};

/** Montée UNE fois par page de parcours (voir `EcranParcoursDonnees`). */
export function FeuillesParcours() {
  const feuille = useFeuille();
  const onFermer = useCallback(() => fermerFeuille(), []);
  if (feuille === null) return null;
  const titreId = `parcours-feuille-${feuille.nom}`;
  const contenu = (() => {
    switch (feuille.nom) {
      case 'blocage':
        return <ContenuBlocage stepId={feuille.stepId} onFermer={onFermer} />;
      case 'partage':
        return <ContenuPartage stepId={feuille.stepId} onFermer={onFermer} />;
      case 'inviter':
        return <ContenuInviter onFermer={onFermer} />;
      case 'arreter':
        return <ContenuArreter onFermer={onFermer} />;
      case 'exporter':
        return <ContenuExporter onFermer={onFermer} />;
      case 'selecteur':
        return <ContenuSelecteur onFermer={onFermer} />;
      case 'signaler':
        return <ContenuSignaler stepId={feuille.stepId} onFermer={onFermer} />;
    }
  })();
  return (
    <Modal
      open
      onClose={onFermer}
      titleId={titreId}
      name={feuille.nom.toUpperCase()}
      mobile={
        <Panneau titreId={titreId} titre={TITRES[feuille.nom] ?? ''} onFermer={onFermer}>
          {contenu}
        </Panneau>
      }
    />
  );
}
