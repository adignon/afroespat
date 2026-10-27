'use client';

/**
 * AJOUT HORS MAQUETTE — LA CARTE D'UNE ÉTAPE ET SES GESTES.
 *
 * La frise de J01 dessinait l'étape en cours en carte « terre cuite » (description,
 * échéance, tuiles guide et section cible, avatars « N membres ont franchi cette
 * étape », « Je suis bloqué·e ») et les suivantes en lignes grises — sans AUCUN geste
 * pour démarrer, franchir, mettre en pause ou rouvrir une étape. Ici chaque transition
 * de 03 §3.2 a son bouton, le serveur tranche (`INVALID_TRANSITION`, `JOURNEY_STATE`)
 * et le refus s'affiche.
 *
 * RÈGLE DURE §3.2 : aucun libellé d'échec — « mise en pause », jamais « abandon
 * d'étape ». RÈGLE DURE §3.6 : franchir une étape ne publie RIEN ; la réponse du
 * serveur porte des PROPOSITIONS, affichées comme telles, et un second geste explicite
 * (la feuille « Partager un jalon ») est nécessaire pour publier.
 */

import { useState } from 'react';
import Link from 'next/link';
import type { JourneyFullResponse, JourneyProposals, JourneyStep } from '@app/shared';
import { LevelInvitation } from '@/components/level-invitation';
import { updateStep } from '@/screens/parcours/api';
import { ETAT_ETAPE, echeance, duree } from '@/screens/parcours/appels';
import { Avis, Bouton, C, Icone, ICONES, Pastille } from './ui';
import { ouvrirFeuille } from './feuilles-store';
import { useGeste } from './donnees';

export const dateCourte = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function etatPastille(etape: JourneyStep) {
  const libelle = ETAT_ETAPE[etape.status] ?? etape.status;
  const franchie = etape.status === 'DONE';
  const enCours = etape.status === 'IN_PROGRESS';
  return (
    <Pastille
      fond={franchie ? C.vertPale2 : enCours ? C.orange : C.fond}
      texte={franchie ? C.vert : enCours ? '#fff' : C.gris}
    >
      {libelle}
    </Pastille>
  );
}

/** Les destinations des sections que « Je suis bloqué·e » sait joindre. */
export const SECTION_CIBLE: Record<string, { href: string; libelle: string } | undefined> = {
  HELP: { href: '/entraide', libelle: 'Demander de l’aide' },
  HOUSING: { href: '/services/logement', libelle: 'Annonces de logement' },
  JOBS: { href: '/services/emploi', libelle: 'Offres d’emploi' },
  MENTORSHIP: { href: '/parrainage', libelle: 'Trouver un parrain' },
};

export function PropositionsApresEtape({
  propositions,
  parcoursId,
  onFermer,
}: {
  readonly propositions: JourneyProposals;
  readonly parcoursId: string;
  readonly onFermer: () => void;
}) {
  return (
    <div
      role="status"
      style={{ background: C.vertPale, border: `1px solid ${C.vertPale2}`, borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ fontSize: '13.5px', fontWeight: 800 }}>Étape franchie, bravo.</div>
      <div style={{ fontSize: '12.5px', color: C.gris, lineHeight: 1.5 }}>
        Rien n’est publié sans votre accord : voici ce que vous pouvez faire, ou ignorer.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {propositions.milestone === null ? null : (
          <Bouton compact onClick={() => ouvrirFeuille('partage', propositions.milestone?.stepId)}>
            Partager cette victoire
          </Bouton>
        )}
        <Link
          href={`/stories/nouvelle?etape=${propositions.tip.stepId}`}
          style={{ height: '44px', padding: '0 18px', borderRadius: '12px', background: C.fond, color: C.texte, fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          Donner un conseil sur cette étape
        </Link>
        {propositions.goPublic === null ? null : (
          <Link
            href={`/parcours/${parcoursId}/reglages`}
            style={{ height: '44px', padding: '0 18px', borderRadius: '12px', background: C.fond, color: C.texte, fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            Rendre mon parcours public
          </Link>
        )}
        <Bouton compact ton="contour" onClick={onFermer}>
          Plus tard
        </Bouton>
      </div>
    </div>
  );
}

/**
 * Les boutons de transition d'une étape. `onParcours` reçoit le parcours complet que
 * le serveur rend, pour que la vue se mette à jour sans second appel.
 */
export function GestesEtape({
  parcours,
  etape,
  onParcours,
  compact = false,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly onParcours: (p: JourneyFullResponse) => void;
  readonly compact?: boolean;
}) {
  const geste = useGeste();
  const [propositions, setPropositions] = useState<JourneyProposals | null>(null);
  const proprietaire = parcours.viewerRole === 'OWNER';
  const statut = parcours.journey.status;
  const peutAvancer = proprietaire && (statut === 'ACTIVE' || statut === 'COMPLETED');

  const aller = (status: 'IN_PROGRESS' | 'DONE' | 'PAUSED') => {
    void geste.executer(
      async () => {
        const reponse = await updateStep(parcours.journey.id, etape.id, { status });
        onParcours(reponse);
        setPropositions(reponse.proposals ?? null);
      },
      { majPanneau: true },
    );
  };

  if (!proprietaire) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {etape.status === 'TODO' && etape.riskMessage !== null ? (
        <Avis texte={etape.riskMessage} />
      ) : null}
      {etape.deadlineAlert === null || etape.deadlineAlert === undefined ? null : (
        <Avis
          texte={`Cette échéance est trop proche : « ${etape.deadlineAlert.dependsOnTitle} » prend en général ${String(etape.deadlineAlert.indicativeDays)} jours.`}
        />
      )}
      {!peutAvancer ? (
        <Avis texte="Reprenez le parcours (Réglages) pour faire avancer ses étapes." />
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {etape.status === 'TODO' ? (
            <>
              <Bouton compact={!compact} disabled={geste.occupe} onClick={() => aller('IN_PROGRESS')}>
                Commencer
              </Bouton>
              <Bouton compact={!compact} ton="calme" disabled={geste.occupe} onClick={() => aller('DONE')}>
                Déjà franchie
              </Bouton>
            </>
          ) : null}
          {etape.status === 'IN_PROGRESS' ? (
            <>
              <Bouton compact={!compact} disabled={geste.occupe} onClick={() => aller('DONE')}>
                <Icone d={ICONES.coche} taille={15} couleur="#fff" />
                Marquer comme franchie
              </Bouton>
              <Bouton compact={!compact} ton="calme" disabled={geste.occupe} onClick={() => aller('PAUSED')}>
                Mettre en pause
              </Bouton>
            </>
          ) : null}
          {etape.status === 'PAUSED' ? (
            <Bouton compact={!compact} disabled={geste.occupe} onClick={() => aller('IN_PROGRESS')}>
              Reprendre
            </Bouton>
          ) : null}
          {etape.status === 'DONE' ? (
            <>
              <Bouton compact={!compact} ton="calme" disabled={geste.occupe} onClick={() => aller('IN_PROGRESS')}>
                Rouvrir
              </Bouton>
              {etape.isMajorMilestone && etape.sharePromptDismissedAt === null ? (
                <Bouton compact={!compact} ton="contour" onClick={() => ouvrirFeuille('partage', etape.id)}>
                  Partager ce jalon
                </Bouton>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
      {propositions === null ? null : (
        <PropositionsApresEtape
          propositions={propositions}
          parcoursId={parcours.journey.id}
          onFermer={() => setPropositions(null)}
        />
      )}
    </div>
  );
}

/** Le détail d'une étape pour la frise : description, échéance, guide, section cible, pairs. */
export function CorpsEtape({
  parcours,
  etape,
  onParcours,
  detail = false,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly onParcours: (p: JourneyFullResponse) => void;
  readonly detail?: boolean;
}) {
  const proprietaire = parcours.viewerRole === 'OWNER';
  const section = SECTION_CIBLE[etape.blockerTarget];
  const tuile = {
    flex: 1,
    minWidth: '180px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    background: '#fff',
    border: `1px solid ${C.bord}`,
    textDecoration: 'none',
    color: C.texte,
  } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {etape.dueDate === undefined || etape.dueDate === null ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.orange, fontWeight: 700 }}>
          <Icone d={ICONES.calendrier} taille={15} />
          Échéance {echeance(etape.dueDate)} · {dateCourte(etape.dueDate)}
        </div>
      )}
      {etape.description === null ? null : (
        <p style={{ margin: 0, fontSize: '14px', color: C.gris, lineHeight: 1.55 }}>{etape.description}</p>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {etape.guide === null || etape.guide === undefined ? (
          <div style={{ ...tuile, color: C.gris, fontSize: '12.5px' }}>Guide à venir pour cette étape</div>
        ) : (
          <Link href={`/guides/${etape.guide.slug}`} style={tuile}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700 }}>Guide : {etape.guide.title}</span>
              <span style={{ display: 'block', fontSize: '11px', color: C.grisClair }}>
                {etape.guide.helpfulCount} ont trouvé utile
              </span>
            </span>
          </Link>
        )}
        {section === undefined || etape.blockerTarget === 'HELP' ? null : (
          <Link href={section.href} style={tuile}>
            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{section.libelle}</span>
          </Link>
        )}
      </div>
      {etape.peers === null || etape.peers === undefined || etape.peers.count === 0 ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex' }}>
            {etape.peers.sample.map((m, i) => (
              <span
                key={m.handle}
                title={m.displayName ?? m.handle}
                style={{ width: '28px', height: '28px', borderRadius: '999px', background: C.vert, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', marginLeft: i === 0 ? 0 : '-8px' }}
              >
                {(m.displayName ?? m.handle).slice(0, 2).toUpperCase()}
              </span>
            ))}
          </span>
          <span style={{ fontSize: '12.5px', color: C.gris }}>
            {etape.peers.count} membre{etape.peers.count > 1 ? 's' : ''} de {etape.peers.cityName}{' '}
            {etape.peers.count > 1 ? 'ont' : 'a'} franchi cette étape
          </span>
          <Link href="/parcours/publics" style={{ fontSize: '12.5px', fontWeight: 700, color: C.vertFonce }}>
            Leur écrire
          </Link>
        </div>
      )}
      {etape.status === 'DONE' && etape.durationDays !== null ? (
        <div style={{ fontSize: '12.5px', color: C.grisClair }}>Franchie en {duree(etape.durationDays)}</div>
      ) : null}
      {proprietaire ? (
        <GestesEtape parcours={parcours} etape={etape} onParcours={onParcours} />
      ) : null}
      {proprietaire && etape.blockerTarget !== 'NONE' && etape.status !== 'DONE' ? (
        <div>
          <Bouton ton="fort" compact onClick={() => ouvrirFeuille('blocage', etape.id)}>
            Je suis bloqué·e
          </Bouton>
        </div>
      ) : null}
      {detail ? null : (
        <Link
          href={`/parcours/${parcours.journey.id}/etapes/${etape.id}`}
          style={{ fontSize: '13px', fontWeight: 700, color: C.vertFonce }}
        >
          Ouvrir l’étape (notes, documents)
        </Link>
      )}
    </div>
  );
}
