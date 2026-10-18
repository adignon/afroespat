'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  HELP_LIMITS,
  HELP_TYPE_LABELS,
  helpDetailResponseSchema,
  helpMineResponseSchema,
  helpMyResponsesResponseSchema,
  helpPrivateReplyResponseSchema,
  helpResponseCreatedSchema,
  type HelpCard,
} from '@app/shared';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { memberApi, voidResponse } from '@/lib/api/index';
import { useVersionEntraide } from '@/lib/entraide-recharge';
import { ageCourt } from '@/screens/entraide/appels';
import {
  Compteur,
  BOUTON_DISCRET,
  BOUTON_PLEIN,
  CHAMP,
  EtatListe,
  Feuille,
  Segments,
  eteint,
} from './atomes';
import { useGeste } from './geste';

/**
 * AJOUT HORS MAQUETTE — « Mes demandes » (H09) et « Mes réponses » (H10).
 *
 * Les deux planches dessinent leurs cartes en dur (« Un lit et une table pour
 * l'installation », « Relire mon dossier CAF »…), servies à TOUS les membres : seuls
 * les deux compteurs du sous-titre étaient liés. Les listes se chargent maintenant
 * elles-mêmes (`GET /help/mine`, `GET /help/my-responses`), dans le dessin des cartes
 * de la planche, avec les gestes que les boutons dessinés promettaient (Voir,
 * Modifier, Clôturer, Rouvrir, Écrire à…).
 *
 * LES FILTRES SONT DES REQUÊTES : `?status=` part au serveur plutôt que de filtrer la
 * page reçue (une page filtrée localement montrerait un onglet vide alors que la
 * demande existe en page deux). « Expirées » de la planche est l'état ARCHIVED du
 * serveur (§2.2 : 45 jours sans réponse, ou 90 jours après résolution).
 */

const PASTILLE: CSSProperties = { fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' };

function carte(mobile: boolean, extra: CSSProperties = {}): CSSProperties {
  return {
    background: '#fff',
    border: '1px solid #E6EBE9',
    borderRadius: mobile ? '20px' : '22px',
    padding: mobile ? '14px' : '18px',
    flexShrink: 0,
    ...extra,
  };
}

function ligneEtape(d: HelpCard): string {
  const parties: string[] = [];
  if (d.journeyStep !== null) parties.push(`Étape ${String(d.journeyStep.stepNumber)} · ${d.journeyStep.stepName}`);
  if (d.dueDate !== null) {
    const j = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86_400_000);
    parties.push(j < 0 ? 'échéance dépassée' : j === 0 ? 'échéance aujourd’hui' : `échéance dans ${String(j)} jours`);
  } else if (d.journeyStep === null) {
    parties.push(d.responseCount === 0 ? 'Aucune réponse pour l’instant' : 'Sans échéance');
  }
  return parties.join(' · ');
}

// ── H09 ─────────────────────────────────────────────────────────────────────

type FiltreDemandes = 'ALL' | 'OPEN' | 'RESOLVED' | 'ARCHIVED';

export function MesDemandes({ variante }: { readonly variante: 'bureau' | 'mobile' }) {
  const mobile = variante === 'mobile';
  const version = useVersionEntraide();
  const [filtre, setFiltre] = useState<FiltreDemandes>('ALL');
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState<{ phase: 'attente' | 'echec' | 'pret'; items: readonly HelpCard[] }>({ phase: 'attente', items: [] });

  useEffect(() => {
    let vivant = true;
    const statut = filtre === 'ALL' ? '' : `&status=${filtre}`;
    void memberApi
      .get(`/help/mine?limit=50${statut}`, helpMineResponseSchema)
      .then((r) => {
        if (vivant) setEtat({ phase: 'pret', items: r.items });
      })
      .catch(() => {
        if (vivant) setEtat((e) => ({ phase: 'echec', items: e.items }));
      });
    return () => {
      vivant = false;
    };
  }, [filtre, version, essai]);

  return (
    <>
      <Segments
        valeur={filtre}
        onChoisir={setFiltre}
        options={[
          { cle: 'ALL', libelle: 'Toutes' },
          { cle: 'OPEN', libelle: 'Ouvertes' },
          { cle: 'RESOLVED', libelle: 'Résolues' },
          { cle: 'ARCHIVED', libelle: 'Expirées' },
        ]}
      />
      {etat.phase === 'pret' && etat.items.length > 0 ? (
        etat.items.map((d) => <CarteDemande key={d.id} d={d} mobile={mobile} />)
      ) : (
        <EtatListe
          etat={etat.phase === 'pret' ? 'vide' : etat.phase}
          onReessayer={() => setEssai((n) => n + 1)}
          vide={
            <>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>Aucune demande ici</div>
              <div style={{ marginTop: '4px' }}>Vous avez besoin d’un coup de main ?</div>
              <Link href="/entraide/nouveau" style={{ ...BOUTON_PLEIN, margin: '12px auto 0', width: 'fit-content', textDecoration: 'none' }}>
                Publier une demande
              </Link>
            </>
          }
        />
      )}
    </>
  );
}

function CarteDemande({ d, mobile }: { readonly d: HelpCard; readonly mobile: boolean }) {
  const { lancer, occupe, fenetre } = useGeste();
  const [suppression, setSuppression] = useState(false);
  const ouverte = d.status === 'OPEN';
  const bouton: CSSProperties = { ...BOUTON_DISCRET, height: '38px', textDecoration: 'none' };
  const resoluRecemment =
    d.status === 'RESOLVED' &&
    d.resolvedAt !== null &&
    Date.now() - new Date(d.resolvedAt).getTime() <= HELP_LIMITS.reopenWindowDays * 86_400_000;
  const ligne = ligneEtape(d);

  return (
    <div style={carte(mobile, d.fromJourney && ouverte ? { background: '#FFFBF8', border: '1.5px solid #E0733A' } : {})}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        {d.fromJourney ? <span style={{ ...PASTILLE, background: '#E0733A', color: '#fff' }}>Depuis un parcours</span> : null}
        <span style={{ ...PASTILLE, background: '#E3F0EB', color: '#0F5C48' }}>{HELP_TYPE_LABELS[d.type]}</span>
        <span style={{ ...PASTILLE, background: ouverte ? '#E3F0EB' : '#EDF1EF', color: ouverte ? '#0F5C48' : '#5D6B66' }}>
          {ouverte ? (d.kind === 'OFFER' ? 'Offre ouverte' : 'Ouverte') : d.status === 'ARCHIVED' ? 'Expirée' : d.kind === 'OFFER' ? 'Offre pourvue' : 'Résolue'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: '#8A958F' }}>{ageCourt(d.createdAt)}</span>
      </div>
      <Link href={`/entraide/${d.id}`} style={{ display: 'block', fontSize: '16px', fontWeight: 700, marginTop: '10px', color: 'inherit', textDecoration: 'none' }}>
        {d.title}
      </Link>
      {ligne === '' ? null : <div style={{ fontSize: '12.5px', color: d.journeyStep === null ? '#5D6B66' : '#B4581F', fontWeight: 600, marginTop: '4px' }}>{ligne}</div>}
      <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '6px' }}>
        {d.responseCount} réponse{d.responseCount > 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <Link href={`/entraide/${d.id}`} style={bouton}>
          {d.responseCount > 0 ? 'Voir les réponses' : 'Voir'}
        </Link>
        {ouverte ? (
          <>
            <Link href={`/entraide/${d.id}?modifier=1`} style={bouton}>
              Modifier
            </Link>
            <button
              type="button"
              disabled={occupe}
              style={eteint({ ...bouton, background: '#fff', border: '1px solid #E6EBE9' }, occupe)}
              onClick={() => {
                void lancer(() => memberApi.post(`/help/${d.id}/resolve`, helpDetailResponseSchema), {
                  succes: d.kind === 'OFFER' ? 'Offre marquée comme pourvue.' : 'Demande clôturée.',
                });
              }}
            >
              {d.kind === 'OFFER' ? 'Offre pourvue' : 'Clôturer'}
            </button>
          </>
        ) : null}
        {resoluRecemment ? (
          <button
            type="button"
            disabled={occupe}
            style={eteint({ ...bouton, background: '#fff', color: '#0F5C48', border: '1.5px solid #CFE3DA' }, occupe)}
            onClick={() => {
              void lancer(() => memberApi.post(`/help/${d.id}/reopen`, helpDetailResponseSchema), { succes: 'Votre demande est rouverte.' });
            }}
          >
            Rouvrir
          </button>
        ) : null}
        <button type="button" style={{ ...bouton, background: 'transparent', color: '#5D6B66' }} onClick={() => setSuppression(true)}>
          Supprimer
        </button>
      </div>
      <FenetreConfirmation
        ouverte={suppression}
        nom="SUPPRIMER-MA-DEMANDE"
        titre="Supprimer cette demande ?"
        question="Elle disparaîtra du fil, et ses réponses avec elle."
        precision="Les contacts et la réputation déjà créés chez les autres membres sont conservés."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onAnnuler={() => setSuppression(false)}
        onConfirmer={() => {
          void lancer(() => memberApi.del(`/help/${d.id}`, voidResponse), { succes: 'Votre demande est supprimée.' }).then((ok) => {
            if (ok) setSuppression(false);
          });
        }}
      />
      {fenetre}
    </div>
  );
}

// ── H10 ─────────────────────────────────────────────────────────────────────

type FiltreReponses = 'ALL' | 'USEFUL' | 'PENDING';
type MaReponse = z.infer<typeof helpMyResponsesResponseSchema>['items'][number];

export function MesReponses({ variante }: { readonly variante: 'bureau' | 'mobile' }) {
  const mobile = variante === 'mobile';
  const version = useVersionEntraide();
  const [filtre, setFiltre] = useState<FiltreReponses>('ALL');
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState<{ phase: 'attente' | 'echec' | 'pret'; items: readonly MaReponse[] }>({ phase: 'attente', items: [] });

  useEffect(() => {
    let vivant = true;
    void memberApi
      .get('/help/my-responses?limit=50', helpMyResponsesResponseSchema)
      .then((r) => {
        if (vivant) setEtat({ phase: 'pret', items: r.items });
      })
      .catch(() => {
        if (vivant) setEtat((e) => ({ phase: 'echec', items: e.items }));
      });
    return () => {
      vivant = false;
    };
  }, [version, essai]);

  const visibles = etat.items.filter((r) => (filtre === 'ALL' ? true : filtre === 'USEFUL' ? r.markedHelpful : !r.markedHelpful));
  return (
    <>
      <Segments
        valeur={filtre}
        onChoisir={setFiltre}
        options={[
          { cle: 'ALL', libelle: 'Toutes' },
          { cle: 'USEFUL', libelle: 'Utiles' },
          { cle: 'PENDING', libelle: 'En attente' },
        ]}
      />
      {etat.phase === 'pret' && visibles.length > 0 ? (
        visibles.map((r) => <CarteReponse key={r.id} r={r} mobile={mobile} />)
      ) : (
        <EtatListe
          etat={etat.phase === 'pret' ? 'vide' : etat.phase}
          onReessayer={() => setEssai((n) => n + 1)}
          vide={
            <>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>
                {etat.items.length === 0 ? 'Vous n’avez pas encore répondu' : 'Aucune réponse dans cet état'}
              </div>
              <div style={{ marginTop: '4px' }}>Les demandes qui vous correspondent sont dans « Vous pouvez aider ».</div>
              <Link href="/entraide/aider" style={{ ...BOUTON_PLEIN, margin: '12px auto 0', width: 'fit-content', textDecoration: 'none' }}>
                Voir les demandes
              </Link>
            </>
          }
        />
      )}
    </>
  );
}

function CarteReponse({ r, mobile }: { readonly r: MaReponse; readonly mobile: boolean }) {
  const router = useRouter();
  const { lancer, occupe, fenetre } = useGeste();
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [texte, setTexte] = useState(r.body);
  const auteur = r.request.author.displayName;
  const prenom = auteur.trim().split(/\s+/)[0] ?? auteur;
  const modifiable = !r.markedHelpful && r.request.status === 'OPEN';
  const bouton: CSSProperties = { ...BOUTON_DISCRET, height: '38px', textDecoration: 'none' };
  const valide = texte.trim().length >= HELP_LIMITS.responseBodyMin && texte.trim().length <= HELP_LIMITS.responseBodyMax;

  return (
    <div style={carte(mobile)}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...PASTILLE, background: '#E3F0EB', color: '#0F5C48' }}>{HELP_TYPE_LABELS[r.request.type]}</span>
        <span style={{ ...PASTILLE, background: r.markedHelpful ? '#16785E' : '#F2F5F4', color: r.markedHelpful ? '#fff' : '#5D6B66' }}>
          {r.markedHelpful ? 'Marquée utile' : 'En attente'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: '#8A958F' }}>{ageCourt(r.createdAt)}</span>
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '10px' }}>
        {auteur} · {r.request.title}
      </div>
      <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '4px' }}>Votre réponse : « {r.body} »</div>
      {r.markedHelpful ? (
        <div style={{ marginTop: '12px', background: '#E3F0EB', borderRadius: '14px', padding: '10px 12px', fontSize: '12.5px', color: '#0F5C48', fontWeight: 600 }}>
          {prenom} a marqué votre réponse « ça m’a aidé » · +1 entraide validée
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
        <Link href={`/entraide/${r.request.id}`} style={bouton}>Voir la demande</Link>
        {r.markedHelpful ? (
          <button
            type="button"
            disabled={occupe}
            style={eteint(bouton, occupe)}
            onClick={() => {
              void lancer(
                async () => {
                  const c = await memberApi.post(`/help/${r.request.id}/private-reply`, helpPrivateReplyResponseSchema);
                  router.push(`/messages/${c.conversationId}`);
                },
                { recharger: false },
              );
            }}
          >
            Écrire à {prenom}
          </button>
        ) : null}
        {modifiable ? (
          <>
            <button type="button" style={bouton} onClick={() => setEdition(true)}>Modifier ma réponse</button>
            <button type="button" style={{ ...bouton, background: 'transparent', color: '#5D6B66' }} onClick={() => setSuppression(true)}>Supprimer</button>
          </>
        ) : null}
      </div>
      <Feuille
        ouverte={edition}
        onFermer={() => setEdition(false)}
        nom="MODIFIER-MA-REPONSE"
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
                  () => memberApi.patch(`/help/${r.request.id}/responses/${r.id}`, helpResponseCreatedSchema, { body: { body: texte.trim() } }),
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
        nom="SUPPRIMER-MA-REPONSE"
        titre="Supprimer ma réponse ?"
        question="Elle disparaîtra de la demande."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onAnnuler={() => setSuppression(false)}
        onConfirmer={() => {
          void lancer(() => memberApi.del(`/help/${r.request.id}/responses/${r.id}`, voidResponse), { succes: 'Votre réponse est supprimée.' }).then((ok) => {
            if (ok) setSuppression(false);
          });
        }}
      />
      {fenetre}
    </div>
  );
}
