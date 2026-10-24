'use client';

/**
 * LES FEUILLES DU MODULE PARCOURS — LE DESSIN DE LA MAQUETTE, AVEC DE VRAIS GESTES.
 *
 * ── CE QUI A CHANGÉ (LOT « FEUILLES DESSINÉES ») ─────────────────────────────
 *
 * Ce fichier rendait six feuilles à la main dans un panneau centré de 440 px, sur les deux
 * largeurs. Mesuré contre la maquette, il divergeait visiblement : « Je suis bloqué·e »
 * n'avait ni le décompte « 1 · Votre message / 2 · Portée / 3 · Aperçu », ni les cartes de
 * portée à pastille, ni l'aperçu en carte terre cuite ; « Partager un jalon » n'avait pas la
 * carte « ÉTAPE FRANCHIE · N sur M ». Le porteur : « Monte les dessins de la maquette et
 * rends-les dynamiques. »
 *
 * Les planches transcodées sont donc MONTÉES :
 *
 *   · J03 « Je suis bloqué·e » — trois volets, ordinateur ET mobile ;
 *   · J04 « Partager un jalon » — ordinateur ET mobile ;
 *   · J05 « Inviter dans l'équipe », J07 « Exporter », J08 « Arrêter », J01M « Mes parcours »
 *     — la feuille mobile est celle de la maquette ; la maquette ne dessine PAS de fenêtre
 *     d'ordinateur pour elles, qui garde donc le panneau centré (châssis de K08 et D08).
 *
 * Les planches sont des images : leur texte, leurs champs, leurs listes et leurs boutons sont
 * branchés par `tools/adaptations/feuilles-dessinees.mjs`, qui remplace chaque nœud vivant par
 * une pièce de `feuille-dessinee.tsx` (`FVal`, `FAct`, `FLien`, `FSlot`). Les CONTRÔLEURS
 * ci-dessous — un par feuille — leur donnent l'état et les appels serveur.
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
 *
 * ── CE QUI RESTE UN AJOUT HORS MAQUETTE ─────────────────────────────────────
 *
 *   · les états que la maquette ne dessine pas (préparation du brouillon, confirmation de
 *     publication, refus) : le panneau centré, dans le langage visuel de K08 ;
 *   · les champs que `publishBlocker` exige selon la cible (titre, secteurs, contrats,
 *     parrain), sous les cartes de portée ;
 *   · « Signaler une erreur dans ce modèle » (§2.4), que la maquette ne dessine pas.
 */

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
import {
  chargerJ01M,
  chargerJ08Arret,
  dureeTotale,
  echeance,
  fondAvatar,
  initiales,
  nomAffiche,
  typeCourt,
} from '@/screens/parcours/appels';
import type { J01MData, J08ArretData } from '@/screens/parcours/data';
import { J03Desktop1 } from '@/screens/j03/desktop1.generated';
import { J03Desktop2 } from '@/screens/j03/desktop2.generated';
import { J03Desktop3 } from '@/screens/j03/desktop3.generated';
import { J03Mobile1 } from '@/screens/j03/mobile1.generated';
import { J03Mobile2 } from '@/screens/j03/mobile2.generated';
import { J03Mobile3 } from '@/screens/j03/mobile3.generated';
import { J04Desktop } from '@/screens/j04/desktop.generated';
import { J04Mobile } from '@/screens/j04/mobile.generated';
import { J05MobileInvitation } from '@/screens/j05invitation/mobileinvitation.generated';
import { J07MobileExport } from '@/screens/j07export/mobileexport.generated';
import { J08MobileArret } from '@/screens/j08arret/mobilearret.generated';
import { J01MMobile } from '@/screens/j01mfeuille/mobile.generated';
import { Avis, Bouton, C, Champ, Etiquette, Icone, ICONES, Pastille, ZoneTexte } from './ui';
import { FeuilleDessinee, SANS_DONNEES, type Controleur, type Styles } from './feuille-dessinee';
import { fermerFeuille, useFeuille } from './feuilles-store';
import { signalerMaj, useGeste, useIdParcours } from './donnees';

// ═══ LE CHÂSSIS DES ÉTATS QUE LA MAQUETTE NE DESSINE PAS ═══════════════════

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

/** Une fenêtre dans le châssis centré : les états sans dessin et la fenêtre d'ordinateur des feuilles mobiles. */
function FenetreCentree({
  nom,
  titre,
  onFermer,
  children,
}: {
  readonly nom: string;
  readonly titre: string;
  readonly onFermer: () => void;
  readonly children: ReactNode;
}) {
  const titreId = `parcours-feuille-${nom.toLowerCase()}`;
  return (
    <Modal
      open
      onClose={onFermer}
      titleId={titreId}
      name={nom}
      mobile={
        <Panneau titreId={titreId} titre={titre} onFermer={onFermer}>
          {children}
        </Panneau>
      }
    />
  );
}

/** Un champ de texte DESSINÉ : reprend le style du nœud de la maquette qu'il remplace. */
function ZoneDessinee({
  s,
  id,
  etiquette,
  valeur,
  onChange,
  maxLength,
  placeholder,
}: {
  readonly s: CSSProperties | undefined;
  readonly id: string;
  readonly etiquette: string;
  readonly valeur: string;
  readonly onChange: (v: string) => void;
  readonly maxLength: number;
  readonly placeholder?: string;
}) {
  const base = s ?? {};
  return (
    <textarea
      id={id}
      aria-label={etiquette}
      data-feuille-champ=""
      value={valeur}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...base,
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        font: 'inherit',
        fontSize: base.fontSize,
        lineHeight: base.lineHeight ?? 1.6,
        color: C.texte,
        background: '#fff',
        outline: 'none',
        resize: 'none',
        flexShrink: 0,
      }}
    />
  );
}

/** « Amina Diallo » → « Amina D. » : le nom que la maquette écrit sous un aperçu. */
function nomCourt(nom: string): string {
  const mots = nom.trim().split(/\s+/u);
  const second = mots[1];
  return second === undefined || mots.length < 2 ? (mots[0] ?? nom) : `${mots[0] ?? ''} ${second[0] ?? ''}.`;
}

/** « Aïcha, Moussa et Fanta » */
function listeFrancaise(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? '';
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1] ?? ''}`;
}

// ═══ JE SUIS BLOQUÉ·E (§3.5) — J03, trois volets ═══════════════════════════

const CIBLES: Record<string, string> = {
  HELP: 'une demande d’entraide',
  HOUSING: 'une recherche de logement',
  JOBS: 'votre profil de recherche d’emploi',
  MENTORSHIP: 'une demande de parrainage',
};
const CATEGORIES: Record<string, string> = {
  HELP: 'Entraide',
  HOUSING: 'Logement',
  JOBS: 'Emploi',
  MENTORSHIP: 'Parrainage',
};

function porteePublique(cible: string, ville: string): readonly [string, string] {
  switch (cible) {
    case 'HOUSING':
      return ['Publier dans Annonces logement', `Visible par les membres de ${ville} qui proposent un logement.`];
    case 'JOBS':
      return ['Publier dans Emploi', `Visible par les membres de ${ville} qui recrutent ou recommandent.`];
    case 'MENTORSHIP':
      return ['Demander à un parrain', 'Envoyée au parrain que vous choisissez, et à lui seul.'];
    default:
      return ['Publier dans Entraide', `Visible par les membres de ${ville} qui peuvent vous aider.`];
  }
}

const VOLETS_DESKTOP = [J03Desktop1, J03Desktop2, J03Desktop3] as const;
const VOLETS_MOBILE = [J03Mobile1, J03Mobile2, J03Mobile3] as const;

function FeuilleBlocage({ stepId, onFermer }: { readonly stepId: string | undefined; readonly onFermer: () => void }) {
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
  //
  // Pas de drapeau « annulé » : en développement React monte l'effet DEUX fois, et
  // `executer` refuse le second appel tant que le premier est en vol — un drapeau levé par
  // le premier nettoyage aurait jeté sa réponse, et la feuille serait restée vide.
  useEffect(() => {
    if (idParcours === null) return;
    void geste.executer(async () => {
      const complet = await readJourney(idParcours);
      const cible = stepId ?? complet.journey.currentStepId;
      if (cible === null) {
        geste.signaler('Toutes les étapes de ce parcours sont franchies : il n’y a rien à débloquer.');
        return;
      }
      const { blocker } = await createBlockerDraft(idParcours, cible);
      setParcours(complet);
      setBrouillon(blocker);
      setTexte(blocker.draftText);
    });
    // Une seule création à l'ouverture : `geste` est stable.
  }, [idParcours, stepId]);

  const etape = parcours?.steps.find((s) => s.id === brouillon?.journeyStepId);
  const cible = brouillon?.target ?? 'HELP';
  const ville = parcours?.journey.destinationCity.name ?? '';
  const texteValide = texte.trim().length >= BLOCKER_TEXT_MIN && texte.trim().length <= BLOCKER_TEXT_MAX;
  const titreRequis = !prive && (cible === 'HELP' || cible === 'HOUSING' || cible === 'JOBS');
  const titreValide = !titreRequis || (titre.trim().length >= 10 && titre.trim().length <= 120);
  const parrainValide = prive || cible !== 'MENTORSHIP' || parrain.trim().length >= 2;

  const annuler = useCallback(() => {
    if (brouillon !== null && fait === null) {
      void cancelBlocker(brouillon.id).catch(() => undefined);
    }
    onFermer();
  }, [brouillon, fait, onFermer]);

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

  const equipe = (parcours?.members ?? []).map((m) => m.user.displayName ?? m.user.handle).map((n) => (n.trim() === '' ? '…' : n.split(/\s+/u)[0] ?? n));
  const proprietaire = parcours?.journey.owner;
  const nomProprietaire = proprietaire === undefined ? '' : nomAffiche(proprietaire.displayName, proprietaire.handle);

  const controleur: Controleur = {
    fermer: annuler,
    val: (cle) => {
      switch (cle) {
        case 'categorie':
          return prive ? 'Mon équipe seulement' : (CATEGORIES[cible] ?? null);
        case 'etape':
          if (etape === undefined) return null;
          return `Étape ${String(etape.position)} · ${etape.title}${
            etape.dueDate === null || etape.dueDate === undefined ? '' : ` · échéance ${echeance(etape.dueDate)}`
          }`;
        case 'titre':
          return titreRequis && titre.trim() !== '' ? titre.trim() : null;
        case 'texte':
          return texte.trim() === '' ? null : texte.trim();
        case 'initiales':
          return proprietaire === undefined ? null : initiales(nomProprietaire, proprietaire.handle);
        case 'auteur':
          return proprietaire === undefined ? null : nomCourt(nomProprietaire);
        case 'profil':
          return parcours === null
            ? null
            : `${typeCourt(parcours.journey.template.code, parcours.journey.template.nameFr)} · ${ville}`;
        default:
          return null;
      }
    },
    act: (cle) => {
      switch (cle) {
        case 'annuler':
          return { onClick: annuler };
        case 'retour':
          return { onClick: () => setVolet((v) => Math.max(0, v - 1)) };
        case 'suivant':
          return volet === 0
            ? { onClick: () => setVolet(1), disabled: !texteValide }
            : { onClick: () => setVolet(2), disabled: !titreValide || !parrainValide };
        case 'publier':
          return { onClick: publier, disabled: geste.occupe, libelle: geste.occupe ? 'Publication…' : 'Publier' };
        default:
          return {};
      }
    },
    slot: (cle, s: Styles) => {
      if (cle === 'brouillon') {
        return (
          <ZoneDessinee
            s={s[0]}
            id="bloque-texte"
            etiquette="Votre message"
            valeur={texte}
            onChange={setTexte}
            maxLength={BLOCKER_TEXT_MAX}
          />
        );
      }
      if (cle === 'portee') {
        const [libellePublic, aidePublic] = porteePublique(cible, ville);
        const aideEquipe =
          equipe.length === 0
            ? 'Personne n’est encore dans votre équipe : le message restera dans la discussion du parcours.'
            : `${listeFrancaise(equipe)} ${equipe.length === 1 ? 'recevra' : 'recevront'} votre message en privé.`;
        const lignes: ReadonlyArray<readonly [boolean, string, string]> = [
          [false, libellePublic, aidePublic],
          [true, 'Envoyer seulement à mon équipe', aideEquipe],
        ];
        return (
          <>
            <div role="radiogroup" aria-label="Qui peut le voir ?" style={{ display: 'contents' }}>
              {lignes.map(([valeur, libelle, aide]) => {
                const choisie = prive === valeur;
                return (
                  <div
                    key={libelle}
                    role="radio"
                    aria-checked={choisie}
                    tabIndex={0}
                    data-portee={valeur ? 'equipe' : 'public'}
                    onClick={() => setPrive(valeur)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setPrive(valeur);
                      }
                    }}
                    style={{ ...(choisie ? s[0] : s[4]), cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span style={choisie ? s[1] : s[5]} />
                    <span>
                      <span style={choisie ? s[2] : s[6]}>{libelle}</span>
                      <span style={choisie ? s[3] : s[7]}>{aide}</span>
                    </span>
                  </div>
                );
              })}
            </div>
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
          </>
        );
      }
      if (cle === 'alertes') {
        return (
          <>
            {volet === 0 && texte.trim().length > 0 && !texteValide ? (
              <Avis texte={`Entre ${String(BLOCKER_TEXT_MIN)} et ${String(BLOCKER_TEXT_MAX)} caractères : c’est CE texte qui sera publié, rien d’autre.`} />
            ) : null}
            {volet !== 1 ? <Avis texte={geste.erreur} ton="erreur" /> : null}
            <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
          </>
        );
      }
      return null;
    },
  };

  if (fait !== null) {
    return (
      <FenetreCentree nom="J03" titre="Je suis bloqué·e" onFermer={onFermer}>
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
      </FenetreCentree>
    );
  }

  // Aucun brouillon possible (étape sans demande d'aide, parcours terminé, refus du serveur) :
  // on le dit, on ne montre pas un champ qui ne servirait à rien.
  if (brouillon === null) {
    return (
      <FenetreCentree nom="J03" titre="Je suis bloqué·e" onFermer={onFermer}>
        {geste.erreur === null && geste.niveau === null ? (
          <div role="status" style={{ fontSize: '13.5px', color: C.gris }}>Préparation du brouillon…</div>
        ) : null}
        <Avis texte={geste.erreur} ton="erreur" />
        <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
        <Bouton ton="calme" plein onClick={onFermer}>
          Fermer
        </Bouton>
      </FenetreCentree>
    );
  }

  const Ordinateur = VOLETS_DESKTOP[volet] ?? J03Desktop1;
  const Mobile = VOLETS_MOBILE[volet] ?? J03Mobile1;
  return (
    <Modal
      open
      onClose={annuler}
      titleId="j03-titre"
      name="J03"
      phase={volet}
      desktop={
        <FeuilleDessinee controleur={controleur}>
          <Ordinateur {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
      mobile={
        <FeuilleDessinee controleur={controleur}>
          <Mobile {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
    />
  );
}

// ═══ PARTAGER UN JALON (§3.6) — J04 ═══════════════════════════════════════

function FeuillePartage({ stepId, onFermer }: { readonly stepId: string | undefined; readonly onFermer: () => void }) {
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

  const controleur: Controleur = {
    fermer: onFermer,
    val: (cle) => {
      switch (cle) {
        case 'compte':
          return parcours === null ? null : `${String(parcours.journey.doneCount)} sur ${String(parcours.journey.totalCount)}`;
        case 'titreEtape':
          return etape?.title ?? null;
        case 'duree': {
          const d = etape === undefined ? '' : dureeTotale(etape.startedAt, etape.completedAt);
          return d === '' ? null : `Franchie en ${d}`;
        }
        default:
          return null;
      }
    },
    act: (cle) =>
      cle === 'publier'
        ? {
            onClick: publier,
            disabled: geste.occupe || texte.trim().length < 1 || etape === undefined,
            libelle: geste.occupe ? 'Publication…' : 'Publier',
          }
        : { onClick: plusTard },
    slot: (cle, s) => {
      if (cle === 'texte') {
        return (
          <ZoneDessinee
            s={s[0]}
            id="partage-texte"
            etiquette="Votre message"
            valeur={texte}
            onChange={setTexte}
            maxLength={MILESTONE_TEXT_MAX}
            placeholder="Racontez-la avec vos mots…"
          />
        );
      }
      if (cle === 'alertes') {
        return (
          <>
            <Avis texte={geste.erreur} ton="erreur" />
            <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
          </>
        );
      }
      return null;
    },
  };

  if (fait) {
    return (
      <FenetreCentree nom="J04" titre="Partager un jalon" onFermer={onFermer}>
        <Avis texte="Votre victoire est publiée dans le fil." />
        <Bouton ton="calme" plein onClick={onFermer}>
          Fermer
        </Bouton>
      </FenetreCentree>
    );
  }
  return (
    <Modal
      open
      onClose={onFermer}
      titleId="j04-titre"
      name="J04"
      desktop={
        <FeuilleDessinee controleur={controleur}>
          <J04Desktop {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
      mobile={
        <FeuilleDessinee controleur={controleur}>
          <J04Mobile {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
    />
  );
}

// ═══ INVITER DANS L'ÉQUIPE (§3.4) — J05 (feuille mobile) ═══════════════════

type Contact = { readonly handle: string; readonly displayName: string };
type RoleInvite = 'OBSERVER' | 'SUPPORTER';

/** L'état et les gestes de l'invitation, partagés par la feuille mobile (dessinée) et la fenêtre d'ordinateur. */
function useInviter() {
  const idParcours = useIdParcours();
  const [pseudo, setPseudo] = useState('');
  const [role, setRole] = useState<RoleInvite>('SUPPORTER');
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
  return { pseudo, setPseudo, role, setRole, contacts, invites, inviter, geste };
}

const AIDE_ROLE: Record<RoleInvite, string> = {
  SUPPORTER: 'L’accompagnant peut échanger et recevoir vos demandes privées.',
  OBSERVER: 'L’observateur voit la progression, sans échanger.',
};

function FeuilleInviter({ onFermer }: { readonly onFermer: () => void }) {
  const { pseudo, setPseudo, role, setRole, contacts, invites, inviter, geste } = useInviter();
  const saisi = pseudo.replace(/^@/, '').trim().toLowerCase();

  const controleur: Controleur = {
    fermer: onFermer,
    val: (cle) => (cle === 'aideRole' ? AIDE_ROLE[role] : null),
    act: () => ({}),
    slot: (cle, s: Styles) => {
      if (cle === 'pseudo') {
        return (
          <input
            id="inviter-pseudo"
            aria-label="Pseudo ou contact"
            data-feuille-champ=""
            value={pseudo}
            placeholder="Pseudo ou contact"
            autoComplete="off"
            autoCapitalize="none"
            onChange={(e) => setPseudo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saisi.length >= 3 && !geste.occupe) inviter(saisi);
            }}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', font: 'inherit', color: C.texte, padding: 0 }}
          />
        );
      }
      if (cle === 'contacts') {
        const visibles = contacts
          .filter((c) => saisi === '' || c.handle.toLowerCase().includes(saisi) || c.displayName.toLowerCase().includes(saisi))
          .slice(0, 8);
        const connu = contacts.some((c) => c.handle.toLowerCase() === saisi);
        // Un pseudo saisi qui n'est pas un contact : on propose de l'inviter tel quel, le serveur tranche.
        const lignes: Contact[] = [
          ...(saisi.length >= 3 && !connu ? [{ handle: saisi, displayName: '' }] : []),
          ...visibles,
        ];
        return (
          <>
            {lignes.map((c) => {
              const nom = c.displayName === '' ? `@${c.handle}` : c.displayName;
              const invite = invites.includes(c.handle);
              return (
                <div key={c.handle} style={s[0]}>
                  <span style={{ ...s[1], background: fondAvatar(c.handle) }}>{initiales(c.displayName, c.handle)}</span>
                  <span style={s[2]}>
                    <span style={s[3]}>{nom}</span>
                    <span style={s[4]}>{c.displayName === '' ? 'Inviter par pseudo' : `@${c.handle}`}</span>
                  </span>
                  <button
                    type="button"
                    disabled={geste.occupe || invite}
                    onClick={() => inviter(c.handle)}
                    style={{
                      ...s[5],
                      cursor: 'pointer',
                      ...(invite ? { background: C.fond, color: C.gris } : {}),
                      ...(geste.occupe && !invite ? { opacity: 0.5, cursor: 'default' } : {}),
                    }}
                  >
                    {invite ? 'Invité·e' : 'Inviter'}
                  </button>
                </div>
              );
            })}
            {lignes.length === 0 ? (
              <div style={{ fontSize: '12.5px', color: C.gris, lineHeight: 1.5 }}>
                {contacts.length === 0
                  ? 'Vous n’avez pas encore de contact : saisissez un pseudo pour inviter quelqu’un.'
                  : 'Aucun contact ne correspond : saisissez le pseudo complet pour inviter quelqu’un d’autre.'}
              </div>
            ) : null}
          </>
        );
      }
      if (cle === 'role') {
        return (
          <div role="radiogroup" aria-label="Rôle" style={s[0]}>
            {(
              [
                ['OBSERVER', 'Observateur'],
                ['SUPPORTER', 'Accompagnant'],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={role === valeur}
                onClick={() => setRole(valeur)}
                style={{ ...(role === valeur ? s[2] : s[1]), border: 'none', font: 'inherit', fontSize: s[1]?.fontSize, fontWeight: 700, cursor: 'pointer', ...(role === valeur ? { color: C.texte } : {}) }}
              >
                {libelle}
              </button>
            ))}
          </div>
        );
      }
      if (cle === 'alertes') {
        return (
          <>
            {invites.length === 0 ? null : (
              <Avis texte={`Invitation envoyée à ${invites.map((h) => `@${h.replace(/^@/, '')}`).join(', ')}. Elle accepte ou refuse.`} />
            )}
            <Avis texte={geste.erreur} ton="erreur" />
            <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
          </>
        );
      }
      return null;
    },
  };

  // La fenêtre d'ordinateur : la maquette ne la dessine pas (AJOUT) — le panneau centré, mêmes gestes.
  const ordinateur = (
    <Panneau titreId="j05-titre" titre="Inviter dans l’équipe" onFermer={onFermer}>
      <ContenuInviter etat={{ pseudo, setPseudo, role, setRole, contacts, invites, inviter, geste }} onFermer={onFermer} />
    </Panneau>
  );
  return (
    <Modal
      open
      onClose={onFermer}
      titleId="j05-titre"
      name="J05I"
      desktop={ordinateur}
      mobile={
        <FeuilleDessinee controleur={controleur}>
          <J05MobileInvitation {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
    />
  );
}

function ContenuInviter({
  etat,
  onFermer,
}: {
  readonly etat: ReturnType<typeof useInviter>;
  readonly onFermer: () => void;
}) {
  const { pseudo, setPseudo, role, setRole, contacts, invites, inviter, geste } = etat;
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
          <Champ id="inviter-pseudo-ordinateur" etiquette="Pseudo" valeur={pseudo} onChange={setPseudo} placeholder="@pseudo" />
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

// ═══ ARRÊTER (§3.9) — J08 (feuille mobile) ═════════════════════════════════

function FeuilleArret({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const router = useRouter();
  const [donnees, setDonnees] = useState<Omit<J08ArretData, keyof typeof SANS_DONNEES> | null>(null);
  const [parcours, setParcours] = useState<JourneyFullResponse | null>(null);
  const geste = useGeste();
  useEffect(() => {
    if (idParcours === null) return;
    void chargerJ08Arret(idParcours).then(setDonnees, () => undefined);
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

  const controleur: Controleur = {
    fermer: onFermer,
    val: () => null,
    act: (cle) =>
      cle === 'arreter'
        ? { onClick: arreter, disabled: geste.occupe, libelle: geste.occupe ? 'Arrêt…' : 'Arrêter' }
        : { onClick: onFermer },
    slot: (cle) => (cle === 'alertes' ? <Avis texte={geste.erreur} ton="erreur" /> : null),
  };

  const ordinateur = (
    <Panneau titreId="j08-titre" titre="Arrêter ce parcours ?" onFermer={onFermer}>
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
    </Panneau>
  );
  return (
    <Modal
      open
      onClose={onFermer}
      titleId="j08-titre"
      name="J08A"
      desktop={ordinateur}
      mobile={
        // Le titre « Arrêter « … » ? » est LIÉ au parcours : sans lui la feuille mentirait.
        donnees === null ? (
          <Panneau titreId="j08-titre" titre="Arrêter ce parcours ?" onFermer={onFermer}>
            <div role="status" style={{ color: C.gris }}>Chargement…</div>
          </Panneau>
        ) : (
          <FeuilleDessinee controleur={controleur}>
            <J08MobileArret {...SANS_DONNEES} {...donnees} />
          </FeuilleDessinee>
        )
      }
    />
  );
}

// ═══ EXPORTER (J07) — feuille mobile ═══════════════════════════════════════

function FeuilleExport({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const controleur: Controleur = {
    fermer: onFermer,
    val: () => null,
    act: (cle) =>
      cle === 'exporter' && idParcours !== null
        ? { href: `/parcours/${idParcours}/export` }
        : { onClick: onFermer, disabled: cle === 'exporter' },
    slot: () => null,
  };
  const ordinateur = (
    <Panneau titreId="j07-titre" titre="Exporter mon parcours" onFermer={onFermer}>
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
    </Panneau>
  );
  return (
    <Modal
      open
      onClose={onFermer}
      titleId="j07-titre"
      name="J07X"
      desktop={ordinateur}
      mobile={
        <FeuilleDessinee controleur={controleur}>
          <J07MobileExport {...SANS_DONNEES} />
        </FeuilleDessinee>
      }
    />
  );
}

// ═══ MES PARCOURS (J01M) — feuille mobile ══════════════════════════════════

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

function FeuilleSelecteur({ onFermer }: { readonly onFermer: () => void }) {
  const idParcours = useIdParcours();
  const [donnees, setDonnees] = useState<Omit<J01MData, keyof typeof SANS_DONNEES> | null>(null);
  useEffect(() => {
    // Hors d'un parcours (planche d'illustration) il n'y a pas de « courant » : on lit la liste seule.
    void chargerJ01M(idParcours ?? '').then(setDonnees, () => undefined);
  }, [idParcours]);
  const controleur: Controleur = { fermer: onFermer, val: () => null, act: () => ({}), slot: () => null };
  return (
    <Modal
      open
      onClose={onFermer}
      titleId="j01m-titre"
      name="J01M"
      desktop={
        <Panneau titreId="j01m-titre" titre="Mes parcours" onFermer={onFermer}>
          <ContenuSelecteur onFermer={onFermer} />
        </Panneau>
      }
      mobile={
        donnees === null ? (
          <Panneau titreId="j01m-titre" titre="Mes parcours" onFermer={onFermer}>
            <div role="status" style={{ color: C.gris }}>Chargement…</div>
          </Panneau>
        ) : (
          <FeuilleDessinee controleur={controleur}>
            <J01MMobile {...SANS_DONNEES} {...donnees} />
          </FeuilleDessinee>
        )
      }
    />
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

/** Montée UNE fois par page de parcours (voir `EcranParcoursDonnees`). */
export function FeuillesParcours() {
  const feuille = useFeuille();
  const onFermer = useCallback(() => fermerFeuille(), []);
  const monteur = onFermer;
  if (feuille === null) return null;
  switch (feuille.nom) {
    case 'blocage':
      return <FeuilleBlocage key={`b-${feuille.stepId ?? ''}`} stepId={feuille.stepId} onFermer={monteur} />;
    case 'partage':
      return <FeuillePartage key={`p-${feuille.stepId ?? ''}`} stepId={feuille.stepId} onFermer={monteur} />;
    case 'inviter':
      return <FeuilleInviter onFermer={monteur} />;
    case 'arreter':
      return <FeuilleArret onFermer={monteur} />;
    case 'exporter':
      return <FeuilleExport onFermer={monteur} />;
    case 'selecteur':
      return <FeuilleSelecteur onFermer={monteur} />;
    case 'signaler':
      return (
        <FenetreCentree nom="SIGNALER" titre="Signaler une erreur dans ce modèle" onFermer={monteur}>
          <ContenuSignaler stepId={feuille.stepId} onFermer={monteur} />
        </FenetreCentree>
      );
  }
}
