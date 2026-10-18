'use client';

/**
 * AJOUT HORS MAQUETTE — J02 « CRÉER UN PARCOURS », AVEC DE VRAIS CHAMPS.
 *
 * La maquette dessine quatre cartes de type en `<div>`, un « Nom du parcours » et une
 * « Date d'arrivée cible » en `<div>`, et un bouton « Créer le parcours » sans geste :
 * seul « Régulariser » (mobile) créait un parcours. Cette vue crée n'importe quel type
 * proposé par `GET /journey-templates` (Études, Travail, Famille, Régularisation…),
 * avec son titre, son échéance, et — pour « Régulariser ma situation » — la variante
 * des trois que T3 A.2 demande de choisir à la création.
 *
 * LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE : la limite de plan, le niveau et le type
 * disponible sont tranchés par `POST /journeys`. `PLAN_LIMIT_REACHED` devient l'encart
 * de la planche « plan atteint » (« Vous avez déjà un parcours actif »), qui ne bloque
 * pas la lecture : les types restent lisibles dessous. Les bornes du titre viennent de
 * `@app/shared`.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  JOURNEY_TITLE_MAX,
  JOURNEY_TITLE_MIN,
  SETTLEMENT_TEMPLATE_CODE,
  SETTLEMENT_VARIANTS,
  SETTLEMENT_VARIANT_LABELS,
  type JourneyTemplate,
  type SettlementVariant,
} from '@app/shared';
import { ApiError, displayMessageFor } from '@/lib/api/index';
import { LevelInvitation } from '@/components/level-invitation';
import { createJourney, listJourneyTemplates } from '@/screens/parcours/api';
import { Attente, Avis, Bouton, C, Champ, Icone, ICONES, carte } from './ui';
import { signalerMaj, useGeste } from './donnees';
import { CadreActif } from './cadre-actif';

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function VueCreerInterne({ compact }: { readonly compact: boolean }) {
  const router = useRouter();
  const [modeles, setModeles] = useState<readonly JourneyTemplate[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [variante, setVariante] = useState<SettlementVariant>('REGULARIZATION');
  const [titre, setTitre] = useState('');
  const [titreModifie, setTitreModifie] = useState(false);
  const [date, setDate] = useState('');
  const [planAtteint, setPlanAtteint] = useState(false);
  const geste = useGeste();

  useEffect(() => {
    let annule = false;
    listJourneyTemplates().then(
      (reponse) => {
        if (annule) return;
        const proposes = reponse.items.filter((m) => m.createsJourney);
        setModeles(proposes);
        const premier = proposes[0];
        if (premier !== undefined) {
          setChoisi(premier.id);
          setTitre(premier.nameFr);
        }
      },
      (cause: unknown) => {
        if (!annule) setEchec(displayMessageFor(cause));
      },
    );
    return () => {
      annule = true;
    };
  }, []);

  const modele = modeles?.find((m) => m.id === choisi) ?? null;
  const estRegularisation = modele?.code === SETTLEMENT_TEMPLATE_CODE;
  // Le titre PROPOSÉ suit le type tant que le membre n'y a pas touché (§3.1).
  const choisir = (m: JourneyTemplate) => {
    setChoisi(m.id);
    if (!titreModifie) setTitre(m.nameFr);
    setPlanAtteint(false);
    geste.effacer();
  };

  const titreValide = titre.trim().length >= JOURNEY_TITLE_MIN && titre.trim().length <= JOURNEY_TITLE_MAX;

  const creer = () => {
    if (modele === null || !titreValide) return;
    void geste.executer(async () => {
      try {
        const { journey } = await createJourney({
          templateId: modele.id,
          title: titre.trim(),
          ...(date === '' || estRegularisation ? {} : { targetArrivalDate: date }),
          ...(estRegularisation ? { variant: variante } : {}),
        });
        signalerMaj();
        router.push(`/parcours/${journey.id}`);
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'PLAN_LIMIT_REACHED') {
          setPlanAtteint(true);
          return;
        }
        throw cause;
      }
    });
  };

  const corps = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {planAtteint ? (
        <div
          role="alert"
          style={{ ...carte(16), background: C.vertPale, border: `1px solid ${C.vertPale2}`, display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 800 }}>Vous avez déjà un parcours actif</div>
          <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
            Le plan gratuit accompagne un parcours à la fois. Terminez-le, mettez-le de côté ou
            arrêtez-le pour en ouvrir un autre — vos étapes franchies restent dans votre historique.
          </div>
          <div>
            <Link href="/parcours" style={{ fontSize: '13px', fontWeight: 700, color: C.vertFonce }}>
              Voir mes parcours
            </Link>
          </div>
        </div>
      ) : null}

      {modeles === null && echec === null ? <Attente texte="Chargement des types de parcours…" /> : null}
      <Avis texte={echec} ton="erreur" />

      <div
        role="radiogroup"
        aria-label="Type de parcours"
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
          gap: compact ? '12px' : '10px',
        }}
      >
        {(modeles ?? []).map((m) => {
          const actif = m.id === choisi;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => choisir(m)}
              style={{
                display: 'flex',
                alignItems: compact ? 'center' : 'flex-start',
                flexDirection: compact ? 'row' : 'column',
                gap: compact ? '12px' : '8px',
                padding: compact ? '12px 14px' : '16px',
                borderRadius: compact ? '16px' : '20px',
                background: actif ? C.vertPale : '#fff',
                border: actif ? `2px solid ${C.vert}` : `1px solid ${C.bord}`,
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                color: C.texte,
              }}
            >
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: actif ? '#fff' : C.vertPale2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: C.vertFonce,
                }}
              >
                <Icone d={m.icon ?? ICONES.parcours} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700 }}>{m.nameFr}</span>
                <span style={{ display: 'block', fontSize: '12px', color: actif ? C.vert : C.gris, fontWeight: 700 }}>
                  {m.version.stepCount} étapes
                </span>
              </span>
              {actif ? (
                <span style={{ width: '22px', height: '22px', borderRadius: '999px', background: C.vert, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icone d={ICONES.coche} taille={11} couleur="#fff" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {modele !== null && estRegularisation ? (
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', padding: 0 }}>
            Quelle est votre démarche ?
          </legend>
          {SETTLEMENT_VARIANTS.map((v) => (
            <label
              key={v}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '14px',
                border: variante === v ? `2px solid ${C.vert}` : `1px solid ${C.bord}`,
                background: variante === v ? C.vertPale : '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="variante"
                checked={variante === v}
                onChange={() => setVariante(v)}
                style={{ accentColor: C.vert }}
              />
              {SETTLEMENT_VARIANT_LABELS[v]}
            </label>
          ))}
        </fieldset>
      ) : null}

      {modele !== null ? (
        <>
          <Champ
            id="creer-titre"
            etiquette="Nom du parcours"
            valeur={titre}
            maxLength={JOURNEY_TITLE_MAX}
            onChange={(v) => {
              setTitre(v);
              setTitreModifie(true);
            }}
            aide="C’est le nom que vous voyez. Il ne sort jamais de votre parcours : les autres ne voient que le type."
          />
          {estRegularisation ? null : (
            <Champ
              id="creer-date"
              etiquette="Date d’arrivée cible (facultatif)"
              type="date"
              valeur={date}
              min={aujourdhui()}
              onChange={setDate}
              aide="Chaque étape reçoit une échéance calculée à rebours."
            />
          )}
        </>
      ) : null}

      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </div>
  );

  const bouton = (
    <Bouton
      onClick={creer}
      disabled={geste.occupe || modele === null || !titreValide}
      plein={compact}
      compact={!compact}
    >
      {geste.occupe ? 'Création…' : 'Créer le parcours'}
    </Bouton>
  );

  if (!compact) {
    return (
      <div style={carte(24)}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.8px' }}>Créer un parcours</h1>
        <div style={{ fontSize: '14px', color: C.gris, marginTop: '4px', marginBottom: '18px' }}>
          Découpez votre projet en étapes, avec les guides et les membres qui les ont franchies.
        </div>
        {corps}
        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>{bouton}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', borderBottom: `1px solid ${C.bord}`, flexShrink: 0 }}>
        <Link href="/parcours" aria-label="Fermer" style={{ width: '40px', height: '40px', borderRadius: '999px', background: C.barre, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.texte }}>
          <Icone d={ICONES.croix} />
        </Link>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, flex: 1 }}>Créer un parcours</h1>
      </div>
      <div style={{ flexGrow: 1, padding: '12px 16px' }}>{corps}</div>
      <div style={{ flexShrink: 0, background: '#fff', borderTop: `1px solid ${C.bord}`, padding: '12px 16px 28px', display: 'flex', gap: '8px', position: 'sticky', bottom: 0 }}>
        {bouton}
      </div>
    </>
  );
}

export function VueCreer(props: Parameters<typeof VueCreerInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueCreerInterne {...props} />
    </CadreActif>
  );
}
