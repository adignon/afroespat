'use client';

/**
 * AJOUT HORS MAQUETTE — J10 « PARCOURS ABOUTI » : FÉLICITATIONS ET TROIS PROPOSITIONS.
 *
 * §3.9 : « écran de félicitations, puis les trois propositions : devenir parrain (si
 * L2), écrire un guide à partir de l'étape la plus longue, organiser un événement ».
 * « 9 aides reçues » était écrit en dur : c'est maintenant le nombre d'activités
 * `HELP_RECEIVED` du journal (`journey.helpReceivedCount`). La durée est celle qui sépare
 * la première étape commencée de l'aboutissement ; l'étape la plus longue est celle dont
 * `durationDays` est maximal. Chaque proposition est un LIEN : rien ne se crée tout seul.
 */

import Link from 'next/link';
import type { JourneyFullResponse } from '@app/shared';
import { duree } from '@/screens/parcours/appels';
import { C, Etiquette, carte } from './ui';
import { Chargeur, EnteteParcours } from './commun';
import { CadreActif } from './cadre-actif';

function Proposition({ href, titre, texte }: { readonly href: string; readonly titre: string; readonly texte: string }) {
  return (
    <Link href={href} style={{ ...carte(18), textDecoration: 'none', color: C.texte, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800 }}>{titre}</div>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>{texte}</div>
    </Link>
  );
}

function Corps({ parcours, compact }: { readonly parcours: JourneyFullResponse; readonly compact: boolean }) {
  const franchies = parcours.steps.filter((s) => s.status === 'DONE');
  const plusLongue = [...franchies].sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))[0];
  const debut = parcours.steps.map((s) => s.startedAt).filter((d): d is string => d !== null).sort()[0];
  const fin = parcours.journey.completedAt;
  const total = debut !== undefined && fin !== null ? Math.max(1, Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000)) : null;
  const aides = parcours.journey.helpReceivedCount ?? 0;
  const termine = parcours.journey.status === 'COMPLETED';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...carte(compact ? 18 : 28), textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <Etiquette>{termine ? 'PARCOURS ABOUTI' : 'VOTRE PARCOURS'}</Etiquette>
        <h1 style={{ margin: 0, fontSize: compact ? '22px' : '28px', fontWeight: 800, letterSpacing: '-0.8px' }}>
          {termine ? 'Bravo, vous y êtes !' : 'Pas encore tout à fait'}
        </h1>
        <div style={{ fontSize: '14px', color: C.gris, lineHeight: 1.5 }}>
          {termine
            ? `${String(franchies.length)} étape${franchies.length > 1 ? 's' : ''} franchie${franchies.length > 1 ? 's' : ''}${total === null ? '' : ` en ${duree(total)}`}${aides > 0 ? ` · ${String(aides)} aide${aides > 1 ? 's' : ''} reçue${aides > 1 ? 's' : ''}` : ''}.`
            : 'Il reste des étapes à franchir avant de célébrer.'}
        </div>
      </div>
      {termine ? (
        <>
          <Proposition href="/parrainage/devenir" titre="Devenir parrain" texte="Vous connaissez le chemin : accompagnez quelqu’un qui le prend à son tour (compte vérifié en France requis)." />
          <Proposition href="/guides/nouveau" titre="Écrire un guide" texte={plusLongue === undefined ? 'Partagez ce que vous avez appris.' : `Partez de l’étape la plus longue : « ${plusLongue.title} »${plusLongue.durationDays === null ? '' : `, ${duree(plusLongue.durationDays)}`}.`} />
          <Proposition href="/agenda/nouveau" titre="Organiser un événement" texte="Réunissez ceux qui suivent le même chemin dans votre ville." />
        </>
      ) : null}
      <Link href="/parcours/nouveau" style={{ ...carte(18), textDecoration: 'none', color: C.vertFonce, fontWeight: 800, fontSize: '14.5px' }}>
        Un nouveau projet ? Créer un autre parcours
      </Link>
      <EnteteParcours parcours={parcours} compact={compact} />
    </div>
  );
}

function VueAboutiInterne({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours) =>
        compact ? <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}><Corps parcours={parcours} compact /></div> : <Corps parcours={parcours} compact={false} />
      }
    />
  );
}

export function VueAbouti(props: Parameters<typeof VueAboutiInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueAboutiInterne {...props} />
    </CadreActif>
  );
}
