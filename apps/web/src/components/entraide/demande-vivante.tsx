'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  HELP_LIMITS,
  HELP_REQUEST_TYPES,
  HELP_TYPE_LABELS,
  helpDetailResponseSchema,
  helpPrivateReplyResponseSchema,
  helpResponseCreatedSchema,
} from '@app/shared';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { MenuRond } from '@/components/menu-rond';
import { memberApi, voidResponse } from '@/lib/api/index';
import type { ActionDemande, ActionReponse } from '@/screens/entraide/actions-types';
import {
  Alerte,
  BOUTON_DISCRET,
  BOUTON_ECLAT,
  BOUTON_PLEIN,
  CHAMP,
  Compteur,
  Feuille,
  LIBELLE,
  Pastille,
  eteint,
} from './atomes';
import { useGeste } from './geste';

/**
 * AJOUT HORS MAQUETTE — les gestes de H02 (une demande d'entraide en détail).
 *
 * La planche H02 dessine UNE demande avec trois états qu'elle juxtapose sur la même
 * page : la vue de l'auteur (« Modifier », « Résolu sans réponse », la pastille
 * « Ça m'a aidé » détourée), la vue d'un autre membre (« Écrire une réponse… »,
 * « Répondre », « En privé ») et le bandeau « Après résolution ». Aucun ne faisait
 * rien. Ils sont ici posés SOUS CONDITION — chacun ne s'affiche que pour celui à qui
 * il s'adresse — dans le dessin exact de la planche (mêmes rayons, mêmes teintes).
 *
 * ── LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE ──────────────────────────────────
 *
 * Les drapeaux (`peutModifier`, `peutRouvrir`, `peutMarquer`, `estAuteur`) sont ceux
 * de `GET /help/:id`. Aucun niveau n'est testé : « Répondre en privé » en L0 part au
 * serveur, qui répond `403 LEVEL_REQUIRED`, et `useGeste` ouvre la fenêtre de niveau.
 */

const PASTILLE_STYLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
};

// ── En-tête : pastilles et menu ──────────────────────────────────────────────

/**
 * Le « ··· » d'une demande : l'auteur modifie ou supprime, un autre membre signale.
 * Il garde le dessin que la planche donne au rond (passé en `rondStyle`).
 */
export function MenuDemande({
  action,
  rondStyle,
  trait = '#16211D',
}: {
  readonly action: ActionDemande;
  readonly rondStyle: CSSProperties;
  readonly trait?: string;
}) {
  const router = useRouter();
  const { lancer, fenetre } = useGeste();
  const [signal, setSignal] = useState(false);
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);

  // « Modifier » d'une carte de « Mes demandes » arrive ici avec `?modifier=1` : la
  // feuille s'ouvre d'elle-même, une fois la demande chargée et si le serveur l'autorise.
  useEffect(() => {
    if (action.peutModifier && new URLSearchParams(window.location.search).get('modifier') === '1') {
      setEdition(true);
    }
  }, [action.peutModifier]);

  const entrees: { label: string; onClick: () => void }[] = action.estAuteur
    ? [
        ...(action.peutModifier ? [{ label: 'Modifier', onClick: () => setEdition(true) }] : []),
        { label: 'Supprimer', onClick: () => setSuppression(true) },
      ]
    : [{ label: 'Signaler cette demande', onClick: () => setSignal(true) }];

  return (
    <>
      <MenuRond entrees={entrees} libelle="Plus d’options" rondStyle={rondStyle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={trait} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h.01M12 12h.01M19 12h.01" />
        </svg>
      </MenuRond>
      <FenetreSignalement sujet={signal ? action.signalement : null} onFermer={() => setSignal(false)} />
      <FeuilleEdition action={action} ouverte={edition} onFermer={() => setEdition(false)} />
      <FenetreConfirmation
        ouverte={suppression}
        nom="SUPPRIMER-DEMANDE"
        titre={action.kind === 'OFFER' ? 'Supprimer cette offre ?' : 'Supprimer cette demande ?'}
        question="Elle disparaîtra du fil, et ses réponses avec elle."
        precision="Les contacts et la réputation déjà créés chez les autres membres sont conservés."
        libelleConfirmer="Supprimer"
        onAnnuler={() => setSuppression(false)}
        onConfirmer={() => {
          void lancer(() => memberApi.del(`/help/${action.id}`, voidResponse), {
            succes: 'Votre demande est supprimée.',
            recharger: false,
          }).then((ok) => {
            if (ok) router.push('/entraide/mes-demandes');
          });
        }}
      />
      {fenetre}
    </>
  );
}

export function EnteteDemande({
  action,
  sansMenu = false,
}: {
  readonly action: ActionDemande;
  readonly sansMenu?: boolean;
}) {
  const clos = action.statut !== 'OPEN';
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      {action.deParcours ? (
        <span style={{ ...PASTILLE_STYLE, background: '#E0733A', color: '#fff' }}>Depuis un parcours</span>
      ) : null}
      <span style={{ ...PASTILLE_STYLE, background: '#E3F0EB', color: '#0F5C48' }}>{action.categorie}</span>
      {action.kind === 'OFFER' ? (
        <span style={{ ...PASTILLE_STYLE, background: '#F2F5F4', color: '#5D6B66' }}>Offre</span>
      ) : null}
      {clos ? (
        <span style={{ ...PASTILLE_STYLE, background: '#EDF1EF', color: '#5D6B66' }}>
          {action.statut === 'ARCHIVED' ? 'Archivée' : action.kind === 'OFFER' ? 'Offre pourvue' : 'Résolue'}
        </span>
      ) : null}
      <span style={{ flex: 1 }} />
      {sansMenu ? null : (
        <MenuDemande
          action={action}
          rondStyle={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      )}
    </div>
  );
}

// ── Modifier sa demande ──────────────────────────────────────────────────────

function FeuilleEdition({
  action,
  ouverte,
  onFermer,
}: {
  readonly action: ActionDemande;
  readonly ouverte: boolean;
  readonly onFermer: () => void;
}) {
  const { lancer, occupe, fenetre } = useGeste();
  const [type, setType] = useState(action.type);
  const [title, setTitle] = useState(action.titre);
  const [body, setBody] = useState(action.corps);
  const [dueDate, setDueDate] = useState(action.echeance);
  const valide =
    title.trim().length >= HELP_LIMITS.titleMin &&
    title.trim().length <= HELP_LIMITS.titleMax &&
    body.trim().length >= HELP_LIMITS.bodyMin &&
    body.trim().length <= HELP_LIMITS.bodyMax;

  const enregistrer = async (): Promise<void> => {
    if (!valide || occupe) return;
    const ok = await lancer(
      () =>
        memberApi.patch(`/help/${action.id}`, helpDetailResponseSchema, {
          // `null` EFFACE l'échéance : une demande sans échéance existe (H04).
          body: { type, title: title.trim(), body: body.trim(), dueDate: dueDate === '' ? null : dueDate },
        }),
      { succes: 'Votre demande est modifiée.' },
    );
    if (ok) onFermer();
  };

  return (
    <>
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        nom="MODIFIER-DEMANDE"
        titre="Modifier ma demande"
        actions={
          <>
            <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={!valide || occupe}
              style={{ ...eteint(BOUTON_PLEIN, !valide || occupe), flex: 1 }}
            >
              Enregistrer
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {HELP_REQUEST_TYPES.map((t) => (
            <Pastille key={t} actif={type === t} onClick={() => setType(t)}>
              {HELP_TYPE_LABELS[t]}
            </Pastille>
          ))}
        </div>
        <div>
          <label style={LIBELLE} htmlFor="edit-titre">Titre</label>
          <input id="edit-titre" value={title} maxLength={HELP_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} style={CHAMP} />
          <Compteur n={title.trim().length} min={HELP_LIMITS.titleMin} max={HELP_LIMITS.titleMax} />
        </div>
        <div>
          <label style={LIBELLE} htmlFor="edit-corps">Description</label>
          <textarea id="edit-corps" rows={6} value={body} maxLength={HELP_LIMITS.bodyMax} onChange={(e) => setBody(e.target.value)} style={{ ...CHAMP, resize: 'vertical' }} />
          <Compteur n={body.trim().length} min={HELP_LIMITS.bodyMin} max={HELP_LIMITS.bodyMax} />
        </div>
        <div>
          <label style={LIBELLE} htmlFor="edit-echeance">Échéance (facultatif)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input id="edit-echeance" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={CHAMP} />
            {dueDate === '' ? null : (
              <button type="button" onClick={() => setDueDate('')} style={{ ...BOUTON_DISCRET, flexShrink: 0 }}>
                Sans échéance
              </button>
            )}
          </div>
        </div>
      </Feuille>
      {fenetre}
    </>
  );
}

// ── Actions de l'auteur ──────────────────────────────────────────────────────

export function ActionsAuteur({ action }: { readonly action: ActionDemande }) {
  const { lancer, occupe, fenetre } = useGeste();
  const [edition, setEdition] = useState(false);
  if (!action.estAuteur) return null;
  const offre = action.kind === 'OFFER';

  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
      {action.peutModifier ? (
        <button type="button" onClick={() => setEdition(true)} style={BOUTON_DISCRET}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
          Modifier
        </button>
      ) : null}
      {action.statut === 'OPEN' ? (
        <button
          type="button"
          disabled={occupe}
          onClick={() => {
            void lancer(() => memberApi.post(`/help/${action.id}/resolve`, helpDetailResponseSchema), {
              succes: offre ? 'Offre marquée comme pourvue.' : 'Demande marquée comme résolue.',
            });
          }}
          style={eteint({ ...BOUTON_DISCRET, background: '#fff', border: '1px solid #E6EBE9' }, occupe)}
        >
          {offre ? 'Offre pourvue' : 'Résolu sans réponse'}
        </button>
      ) : null}
      {action.peutRouvrir ? <BoutonRouvrir action={action} /> : null}
      <FeuilleEdition action={action} ouverte={edition} onFermer={() => setEdition(false)} />
      {fenetre}
    </div>
  );
}

function BoutonRouvrir({ action }: { readonly action: ActionDemande }) {
  const { lancer, occupe, fenetre } = useGeste();
  return (
    <>
      <button
        type="button"
        disabled={occupe}
        onClick={() => {
          void lancer(() => memberApi.post(`/help/${action.id}/reopen`, helpDetailResponseSchema), {
            succes: 'Votre demande est rouverte.',
          });
        }}
        style={eteint(BOUTON_ECLAT, occupe)}
      >
        Rouvrir
      </button>
      {fenetre}
    </>
  );
}

// ── Une réponse : marquer, modifier, supprimer, signaler ─────────────────────

export function ActionsReponse({ reponse }: { readonly reponse: ActionReponse }) {
  const { lancer, occupe, fenetre } = useGeste();
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [signal, setSignal] = useState(false);
  const [texte, setTexte] = useState(reponse.corps);
  const valide =
    texte.trim().length >= HELP_LIMITS.responseBodyMin && texte.trim().length <= HELP_LIMITS.responseBodyMax;

  const lien: CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontSize: '12px',
    fontWeight: 700,
    color: '#5D6B66',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
      {reponse.marquee ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#16785E', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '999px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
          Ça m’a aidé
        </span>
      ) : null}
      {reponse.peutMarquer ? (
        <button
          type="button"
          disabled={occupe}
          onClick={() => {
            void lancer(
              () => memberApi.post(`/help/${reponse.demandeId}/responses/${reponse.id}/helpful`, helpDetailResponseSchema),
              { succes: 'Réponse marquée « ça m’a aidé » : un contact est créé.' },
            );
          }}
          style={eteint(
            { font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1.5px solid #CFE3DA', background: '#fff', color: '#0F5C48', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px', cursor: 'pointer' },
            occupe,
          )}
        >
          Ça m’a aidé
        </button>
      ) : null}
      {reponse.peutModifier ? (
        <>
          <button type="button" style={lien} onClick={() => setEdition(true)}>Modifier</button>
          <button type="button" style={lien} onClick={() => setSuppression(true)}>Supprimer</button>
        </>
      ) : null}
      {reponse.estMienne ? null : (
        <button type="button" style={lien} onClick={() => setSignal(true)}>Signaler</button>
      )}
      <FenetreSignalement sujet={signal ? reponse.signalement : null} onFermer={() => setSignal(false)} />
      <Feuille
        ouverte={edition}
        onFermer={() => setEdition(false)}
        nom="MODIFIER-REPONSE"
        titre="Modifier ma réponse"
        actions={
          <>
            <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>Annuler</button>
            <button
              type="button"
              disabled={!valide || occupe}
              style={{ ...eteint(BOUTON_PLEIN, !valide || occupe), flex: 1 }}
              onClick={() => {
                void lancer(
                  () => memberApi.patch(`/help/${reponse.demandeId}/responses/${reponse.id}`, helpResponseCreatedSchema, { body: { body: texte.trim() } }),
                  { succes: 'Votre réponse est modifiée.' },
                ).then((ok) => {
                  if (ok) setEdition(false);
                });
              }}
            >
              Enregistrer
            </button>
          </>
        }
      >
        <textarea rows={6} value={texte} maxLength={HELP_LIMITS.responseBodyMax} onChange={(e) => setTexte(e.target.value)} aria-label="Ma réponse" style={{ ...CHAMP, resize: 'vertical' }} />
        <Compteur n={texte.trim().length} min={HELP_LIMITS.responseBodyMin} max={HELP_LIMITS.responseBodyMax} />
      </Feuille>
      <FenetreConfirmation
        ouverte={suppression}
        nom="SUPPRIMER-REPONSE"
        titre="Supprimer ma réponse ?"
        question="Elle disparaîtra de la demande."
        libelleConfirmer="Supprimer"
        onAnnuler={() => setSuppression(false)}
        onConfirmer={() => {
          void lancer(() => memberApi.del(`/help/${reponse.demandeId}/responses/${reponse.id}`, voidResponse), {
            succes: 'Votre réponse est supprimée.',
          }).then((ok) => {
            if (ok) setSuppression(false);
          });
        }}
      />
      {fenetre}
    </div>
  );
}

// ── Après résolution ─────────────────────────────────────────────────────────

export function ApresResolution({ action }: { readonly action: ActionDemande }) {
  const { lancer, occupe, fenetre } = useGeste();
  const [reporte, setReporte] = useState(false);
  const [franchie, setFranchie] = useState(false);
  if (!action.estAuteur || action.statut !== 'RESOLVED') return null;

  const proposer = action.parcours !== null && !action.parcours.fait && !franchie && !reporte;
  const parcours = action.parcours;
  return (
    <div style={{ background: '#E3F0EB', borderRadius: '22px', padding: '18px 20px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#0F5C48' }}>APRÈS RÉSOLUTION</div>
      <div style={{ fontSize: '14.5px', fontWeight: 700, marginTop: '6px' }}>
        {action.kind === 'OFFER'
          ? 'Offre pourvue.'
          : action.aidant === null
            ? 'Demande résolue sans réponse marquée.'
            : `Demande résolue — ${action.aidant} a été marquée « ça m'a aidé »`}
      </div>
      {proposer && parcours !== null ? (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '12px 14px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600 }}>Marquer l’étape {parcours.etape} comme franchie ?</span>
          <button
            type="button"
            disabled={occupe}
            style={eteint({ ...BOUTON_PLEIN, height: '38px' }, occupe)}
            onClick={() => {
              void lancer(
                () => memberApi.patch(`/journeys/${parcours.journeyId}/steps/${parcours.stepId}`, z.unknown(), { body: { status: 'DONE' } }),
                { succes: 'L’étape est marquée comme franchie.', recharger: false },
              ).then((ok) => {
                if (ok) setFranchie(true);
              });
            }}
          >
            Oui
          </button>
          <button type="button" onClick={() => setReporte(true)} style={{ ...BOUTON_DISCRET, height: '38px' }}>
            Plus tard
          </button>
        </div>
      ) : null}
      {action.peutRouvrir ? (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', color: '#0F5C48' }}>Un clic par erreur ? Vous pouvez rouvrir pendant 7 jours.</span>
          <BoutonRouvrir action={action} />
        </div>
      ) : null}
      {fenetre}
    </div>
  );
}

// ── Répondre (colonne de droite, ordinateur) ─────────────────────────────────

export function RepondreDemande({ action }: { readonly action: ActionDemande }) {
  const router = useRouter();
  const { lancer, occupe, fenetre } = useGeste();
  const [texte, setTexte] = useState('');
  const [touche, setTouche] = useState(false);
  if (action.estAuteur) return null;

  /** Le squelette (`id: ''`) dessine le cadre avant la donnée : rien n'y est envoyable. */
  const pret = action.id !== '';
  const clos = action.statut !== 'OPEN';
  const valide =
    pret && texte.trim().length >= HELP_LIMITS.responseBodyMin && texte.trim().length <= HELP_LIMITS.responseBodyMax;

  const repondre = async (): Promise<void> => {
    setTouche(true);
    if (!valide || occupe) return;
    const ok = await lancer(
      () => memberApi.post(`/help/${action.id}/responses`, helpResponseCreatedSchema, { body: { body: texte.trim() } }),
      { succes: 'Votre réponse est publiée.' },
    );
    if (ok) {
      setTexte('');
      setTouche(false);
    }
  };

  const enPrive = (): void => {
    void lancer(
      async () => {
        const r = await memberApi.post(`/help/${action.id}/private-reply`, helpPrivateReplyResponseSchema);
        router.push(`/messages/${r.conversationId}`);
      },
      { recharger: false },
    );
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>VOTRE RÉPONSE</div>
      {clos ? (
        <div style={{ marginTop: '10px', fontSize: '13px', color: '#5D6B66', lineHeight: 1.5 }}>
          Cette demande est clôturée : elle n’accepte plus de réponses publiques.
        </div>
      ) : (
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={4}
          maxLength={HELP_LIMITS.responseBodyMax}
          placeholder="Écrire une réponse…"
          aria-label="Écrire une réponse"
          style={{ ...CHAMP, marginTop: '10px', minHeight: '90px', border: '1.5px solid #16785E', resize: 'vertical', fontSize: '13.5px' }}
        />
      )}
      {touche && !valide ? (
        <div style={{ marginTop: '8px' }}>
          <Alerte>Votre réponse doit faire au moins {HELP_LIMITS.responseBodyMin} caractères.</Alerte>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {clos ? null : (
          <button
            type="button"
            disabled={occupe || !pret}
            onClick={() => void repondre()}
            style={eteint({ ...BOUTON_PLEIN, flex: 1, height: '40px' }, occupe || !valide)}
          >
            Répondre
          </button>
        )}
        <button type="button" disabled={occupe || !pret} onClick={enPrive} style={eteint({ ...BOUTON_DISCRET, height: '40px', flex: clos ? 1 : undefined }, occupe)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          En privé
        </button>
      </div>
      {fenetre}
    </div>
  );
}

// ── Répondre (barre du bas, téléphone) ───────────────────────────────────────

export function BarreReponse({ action }: { readonly action: ActionDemande }) {
  const router = useRouter();
  const { lancer, occupe, fenetre } = useGeste();
  const [texte, setTexte] = useState('');
  const pret = action.id !== '';
  const valide =
    pret && texte.trim().length >= HELP_LIMITS.responseBodyMin && texte.trim().length <= HELP_LIMITS.responseBodyMax;
  const clos = action.statut !== 'OPEN';

  return (
    <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #E6EBE9', padding: '12px 16px 28px', display: 'flex', gap: '8px', alignItems: 'center' }}>
      {action.estAuteur ? (
        <div style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ActionsAuteur action={action} />
        </div>
      ) : clos ? (
        <div style={{ flex: 1, fontSize: '13px', color: '#5D6B66' }}>Cette demande est clôturée.</div>
      ) : (
        <>
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Répondre…"
            aria-label="Répondre"
            maxLength={HELP_LIMITS.responseBodyMax}
            style={{ flex: 1, height: '44px', borderRadius: '999px', background: '#F2F5F4', padding: '0 16px', border: 'none', fontSize: '13.5px', fontFamily: 'inherit', color: '#16211D', outline: 'none', minWidth: 0 }}
          />
          <button
            type="button"
            disabled={occupe || !valide}
            onClick={() => {
              void lancer(
                () => memberApi.post(`/help/${action.id}/responses`, helpResponseCreatedSchema, { body: { body: texte.trim() } }),
                { succes: 'Votre réponse est publiée.' },
              ).then((ok) => {
                if (ok) setTexte('');
              });
            }}
            style={eteint({ ...BOUTON_PLEIN, height: '44px', padding: '0 14px' }, occupe || !valide)}
          >
            Envoyer
          </button>
        </>
      )}
      {action.estAuteur ? null : (
        <button
          type="button"
          aria-label="Répondre en privé"
          disabled={occupe || !pret}
          onClick={() => {
            void lancer(
              async () => {
                const r = await memberApi.post(`/help/${action.id}/private-reply`, helpPrivateReplyResponseSchema);
                router.push(`/messages/${r.conversationId}`);
              },
              { recharger: false },
            );
          }}
          style={{ width: '40px', height: '40px', borderRadius: '999px', background: '#EEF2F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </button>
      )}
      {fenetre}
    </div>
  );
}
