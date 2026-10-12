'use client';

import { Modal } from '@/components/modal';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE VRAIE FENÊTRE DE CONFIRMATION — ET CHAQUE PIÈCE EST EMPRUNTÉE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour les confirmations inspire-toi du design pour créer un modal
 * bien fait. »
 *
 * CE QUI PRÉCÉDAIT : `window.confirm`, à deux endroits — supprimer une
 * publication, et bloquer un membre. La boîte du navigateur ne porte ni la
 * typographie du dépôt, ni ses couleurs, ni sa langue sur certains systèmes, et
 * sur téléphone elle s'affiche en haut de l'écran, loin du geste.
 *
 * ── RIEN N'EST INVENTÉ ICI, ET C'EST LE POINT ─────────────────────────────
 *
 * `08 Compte` DESSINE DÉJÀ une fenêtre de confirmation : K08 · suppression de
 * compte, cadre de 440 px. Tout le châssis en vient, mot pour mot :
 *
 *   · le voile `rgba(22,33,29,.55)` ;
 *   · le panneau — 440 px, `#fff`, trait `1px solid #DDE3E0`, rayon 28,
 *     retrait 24, colonne, écart 16, `maxHeight: calc(100vh - 48px)` ;
 *   · l'en-tête — `<h2>` 20 px / 800 / `-0.5px`, et la croix dans un rond de
 *     40 px sur `#F2F5F4` ;
 *   · la zone de contenu `data-fenetre-contenu` qui DÉFILE, elle seule ;
 *   · l'encart d'avertissement — `#F6F8F7`, rayon 14, retrait 12, 12,5 px ;
 *   · le bouton d'action — 44 px, retrait `0 18px`, rayon 14, `#16211D`, encre
 *     blanche, 13,5 px / 700.
 *
 * Le bouton « Annuler » vient d'ailleurs, et il est dessiné lui aussi : D08 en
 * écrit un, même géométrie exactement, sur l'aplat `#F2F5F4` avec l'encre
 * `#16211D`. C'est le bouton secondaire du dépôt.
 *
 * ⚠ LE SEUL ÉCART, et il faut le dire : la planche de K08 ne dessine QU'UN
 * bouton — la croix y tient lieu d'annulation. On en pose deux, parce qu'une
 * croix de 40 px en haut à droite est une cible lointaine pour un pouce quand la
 * question est posée en bas de l'écran. REMONTÉ au porteur.
 *
 * ⚠ ET LE BOUTON DE CONFIRMATION RESTE `#16211D`, PAS ROUGE. C'est ce que la
 * planche dessine sur « Confirmer la suppression », l'action la plus destructive
 * du produit. Le rouge `#C2453B` du dépôt est réservé au LIBELLÉ d'une entrée
 * dangereuse — « Supprimer », « Bloquer » dans un menu — et non à l'aplat d'un
 * bouton. On ne change pas cette grammaire pour une fenêtre.
 *
 * ── CE QUE CE COMPOSANT NE FAIT PAS ───────────────────────────────────────
 *
 * Ni Échap, ni le piège de tabulation, ni le retour du focus : c'est `Modal` qui
 * les porte, pour les huit fenêtres transcodées comme pour celle-ci. Ce fichier
 * n'est que la COQUE qu'on lui donne à rendre.
 *
 * ── `champ` : UN MOT DE L'AUTEUR DU GESTE, ET POURQUOI IL EST ICI ──────────
 *
 * Mesuré : « L'information a changé » envoyait TOUJOURS un commentaire vide,
 * alors que `guideOutdatedFlagSchema` en accepte un (1 à 500 caractères,
 * facultatif) et que `flagOutdated(guideId, comment?)` le prend déjà. Or c'est la
 * seule information utile du geste : « à vérifier » dit qu'il y a un problème, le
 * commentaire dit LEQUEL — l'auteur du guide ne peut pas corriger un reproche
 * qu'il ne connaît pas.
 *
 * DEUX CHEMINS ÉTAIENT POSSIBLES, ET VOICI CELUI QU'ON N'A PAS PRIS : employer
 * X03, la feuille de signalement (`components/fenetre-signalement.tsx`). Elle
 * porte déjà un champ libre, mais elle porte AUSSI ses six motifs OBLIGATOIRES
 * (`ReportReason`) et son encart « la conversation sera visible des
 * modérateurs ». Or le signalement d'obsolescence est DISTINCT du signalement
 * d'abus — le dit le service, le dit §2.6, et le dit le libellé même du geste :
 * il dit que le contenu a VIEILLI, pas qu'il est FAUTIF. Demander « arnaque /
 * harcèlement / indésirable » pour dire « le prix a changé » aurait fait mentir
 * l'écran sur la nature du geste, et aurait rendu obligatoire un choix que la
 * route n'accepte pas.
 *
 * LA GÉOMÉTRIE DU CHAMP EST CELLE DE X03, RELEVÉE VERBATIM, pas redessinée : le
 * bloc « Détails (facultatif) » de sa planche, c'est-à-dire l'étiquette 12,5 px /
 * 700 avec 6 px de marge basse, puis le `<textarea>` à `minHeight: 48px`, rayon
 * 14, trait `1.5px solid #16785E`, retrait `13px 14px`, 14 px / 1.5,
 * `resize: vertical`. Les deux fenêtres partagent déjà le même châssis — voile,
 * panneau blanc à rayon 28 et retrait 24, `data-fenetre-contenu` qui défile — et
 * le champ s'y pose donc sans un pixel inventé.
 *
 * ⚠ CE PARAGRAPHE DISAIT « FACULTATIF CÔTÉ SERVEUR, DONC FACULTATIF À L'ÉCRAN :
 * rien ne bloque la confirmation sur un champ vide », et c'était vrai du seul
 * appelant qu'il avait. Le REFUS D'UNE PROPOSITION est arrivé depuis, et son motif
 * est OBLIGATOIRE : `rejectProposalSchema` exige `reason` trimé, de 10 à 1 000
 * caractères. D'où `champ.min`.
 *
 * `min` EST FACULTATIF, et son absence garde l'ancien comportement au caractère
 * près : rien ne bloque, et c'est l'appelant qui omet la clé quand le champ est
 * vide (le schéma est `.strict()`, et une chaîne vide serait REFUSÉE par `min(1)`).
 * Quand `min` est là, le bouton de confirmation s'éteint tant que la valeur TRIMÉE
 * n'y arrive pas — trimée parce que c'est ce que fait le schéma du serveur, et
 * qu'un bouton allumé sur trois espaces promettrait un `400`.
 *
 * ⚠ « ANNULER » NE S'ÉTEINT JAMAIS AVEC LUI. C'est pour cela que ce n'est pas
 * `occupe` qui porte la règle : `occupe` éteint LES DEUX boutons — ce qui est juste
 * pendant un appel — et aurait enfermé le membre dans une fenêtre dont la croix de
 * 40 px est la seule sortie.
 */
export function FenetreConfirmation({
  ouverte,
  titre,
  question,
  precision,
  champ,
  libelleConfirmer,
  onConfirmer,
  onAnnuler,
  occupe = false,
  nom = 'CONFIRMATION',
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  /** La phrase principale — ce qui va se passer, en une ligne. */
  readonly question: string;
  /** L'encart gris : ce qu'on ne pourra pas défaire. Absent, rien n'est dessiné. */
  readonly precision?: string;
  /**
   * UN CHAMP LIBRE, FACULTATIF. Absent, rien n'est dessiné — les huit autres
   * fenêtres de confirmation du dépôt n'en veulent pas et ne changent pas.
   *
   * `max` vient du SCHÉMA de la route, jamais d'un nombre écrit ici : voir
   * `OBSOLETE_COMMENTAIRE_MAX` dans `screens/guides/api.ts`, qui le LIT sur
   * `guideOutdatedFlagSchema`. Une borne recopiée est une borne qui divergera.
   */
  readonly champ?: {
    readonly libelle: string;
    readonly valeur: string;
    readonly onChange: (valeur: string) => void;
    readonly max: number;
    /**
     * LE PLANCHER DE LA ROUTE, quand elle en a un. Voir l'en-tête : absent, rien
     * ne bloque. La valeur vient du SCHÉMA de la route, jamais d'un nombre écrit
     * dans un écran.
     */
    readonly min?: number;
  };
  readonly libelleConfirmer: string;
  readonly onConfirmer: () => void;
  readonly onAnnuler: () => void;
  /** Vrai pendant l'appel : les deux boutons s'éteignent plutôt que de partir deux fois. */
  readonly occupe?: boolean;
  /** Le nom de la planche, pour que les épreuves désignent la bonne fenêtre. */
  readonly nom?: string;
}) {
  const titreId = `${nom.toLowerCase()}-titre`;

  /**
   * Le champ atteint-il son plancher ? Vrai quand il n'y en a pas — l'absence de
   * `min` ne bloque rien, c'est la non-régression des huit autres fenêtres.
   *
   * ⚠ `trim()` AVANT DE COMPTER, parce que le schéma du serveur trime avant de
   * compter (`z.string().trim().min(10)`). Sans cela, dix espaces allumeraient le
   * bouton et la route répondrait `400`.
   */
  const champSuffisant =
    champ === undefined || champ.min === undefined || champ.valeur.trim().length >= champ.min;
  const peutConfirmer = !occupe && champSuffisant;

  const panneau = (
    <>
      <div
        style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        data-fenetre-confirmation=""
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '440px',
          /** La planche fige 440 px ; un téléphone de 390 px déborderait. */
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          border: '1px solid #DDE3E0',
          borderRadius: '28px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0,
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: '1' }}>
            <h2
              id={titreId}
              style={{ margin: '0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              {titre}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
            onClick={onAnnuler}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: '#F2F5F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              padding: '0',
              font: 'inherit',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16211D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          data-fenetre-contenu=""
          style={{
            flex: '1',
            /** Sans `minHeight: 0`, un enfant de flex refuse de rétrécir et déborde. */
            minHeight: '0',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#16211D' }}>{question}</div>
          {champ === undefined ? null : (
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                {champ.libelle}
              </div>
              <textarea
                value={champ.valeur}
                onChange={(e) => {
                  champ.onChange(e.target.value);
                }}
                placeholder={champ.libelle}
                aria-label={champ.libelle}
                rows={3}
                maxLength={champ.max}
                disabled={occupe}
                data-confirmation-champ=""
                style={{
                  minHeight: '48px',
                  borderRadius: '14px',
                  border: '1.5px solid #16785E',
                  background: '#fff',
                  padding: '13px 14px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  color: '#16211D',
                }}
              />
            </div>
          )}
          {precision === undefined ? null : (
            <div
              style={{
                background: '#F6F8F7',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '12.5px',
                color: '#5D6B66',
                lineHeight: '1.55',
              }}
            >
              {precision}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onAnnuler}
            disabled={occupe}
            data-confirmation-annuler=""
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', flex: '1' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirmer}
            disabled={!peutConfirmer}
            data-confirmation-confirmer=""
            style={{
              ...BOUTON,
              background: peutConfirmer ? '#16211D' : '#8A958F',
              color: '#fff',
              flex: '1',
              cursor: peutConfirmer ? 'pointer' : 'default',
            }}
          >
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <Modal open={ouverte} onClose={onAnnuler} titleId={titreId} name={nom} mobile={panneau} />
  );
}

/** La géométrie que K08 et D08 dessinent tous deux, à l'identique. */
const BOUTON = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap' as const,
  cursor: 'pointer',
};
