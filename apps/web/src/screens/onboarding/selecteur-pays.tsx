'use client';

import { drapeauDe } from './drapeau';
import type { CountryChoice } from './data';
import {
  GEOMETRIES,
  PanneauDeSection,
  PhrasePanneau,
  type GeometriePanneau,
} from './panneau-section';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE CHOIX DU PAYS D'ORIGINE — UN PANNEAU DANS LA SECTION, PAS UNE FENÊTRE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot : « Dans l'image des pages il faut afficher un slide
 * left modal quand on clique sur le pays et qui montre tous les pays de l'afrique
 * avec leur drapeau correctement et on peut selectionner. IL NE FAUT PAS QUE CE
 * SOIT COMME LES AUTRES MODALS mais plutôt un modal dans la section qui cache tout
 * le contenu de la section. »
 *
 * La phrase exclut donc explicitement les huit fenêtres du dépôt — voile sombre,
 * feuille du bas sur téléphone, boîte centrée de 520 px sur ordinateur. Ce n'est
 * pas un `Modal` : il n'y a ni voile, ni `position: fixed`, ni rien hors de la
 * section. C'est un panneau `position: absolute; inset: 0` DANS son conteneur, qui
 * glisse depuis la droite et prend la place de ce qu'il recouvre.
 *
 * ── CE QU'IL REMPLACE, ET POURQUOI ÇA DEVAIT CHANGER ───────────────────────
 *
 * La maquette pose, par-dessus la ligne du pays, un `<select>` TRANSPARENT en
 * pleine taille. Ça marchait, et c'était pauvre pour deux raisons mesurables :
 *
 *   · le menu natif n'affiche AUCUN drapeau — un `<option>` ne rend que du texte,
 *     c'est une limite du HTML, pas un oubli ;
 *   · la pastille de la ligne restait celle du Bénin, donc masquée pour les quinze
 *     autres pays (`originFlagDisplay`). Autrement dit : un seul pays sur seize
 *     avait un drapeau, et aucun ne l'avait pendant qu'on choisissait.
 *
 * ── D'OÙ VIENT CHAQUE VALEUR DESSINÉE ICI ──────────────────────────────────
 *
 * Même discipline que `a14/selecteur-parcours.tsx` : la maquette ne dessine pas ce
 * panneau, donc le transcodeur ne peut pas le produire — mais AUCUNE valeur n'est
 * inventée. Tout est emprunté à `docs/template/01 Accès et Onboarding.dc.html`,
 * section O02, c'est-à-dire à la section même que le panneau recouvre :
 *
 *   · la coque — la carte blanche d'ordinateur, `background:#fff;
 *     border-radius:22px;padding:22px` ; sur téléphone la section n'a PAS de
 *     carte, donc la coque prend le fond du cadre, `#F6F8F7` ;
 *   · le bouton de retour — le chevron de l'en-tête de cette même section,
 *     `width:44px;height:44px;border-radius:999px;background:#EEF2F0` et le tracé
 *     `m15 18-6-6 6-6` en `#16211D` ;
 *   · le titre — l'étiquette du champ qu'on remplace, « D'où venez-vous ? », avec
 *     SON style : `font-size:13.5px;font-weight:700` sur ordinateur, 13 px sur
 *     téléphone. C'est volontairement discret : le panneau vit au niveau de la
 *     carte, pas au niveau du titre de page ;
 *   · la liste et ses lignes — la LISTE DE VILLES de la même carte, verbatim
 *     (`border:1px solid #EAEEEC;border-radius:16px;padding:6px`, lignes de 48 px
 *     sur ordinateur et 46 px sur téléphone, `#E3F0EB` pour la ligne retenue) ;
 *   · la pastille du drapeau — la boîte que la maquette dessine pour le drapeau,
 *     `width:22px;height:15px;border-radius:3px` ;
 *   · la coche — le rond de 26 px de cette maquette (`border-radius:999px`,
 *     `#16785E` quand il est plein, `1.5px solid #CBD5D1` sinon) et son tracé
 *     `m5 12 4.5 4.5L19 7` en 13 px.
 *
 * Le seul texte qui ne vient d'aucune planche est le nom accessible du bouton de
 * fermeture, « Fermer » — c'est celui que les huit fenêtres du dépôt emploient
 * déjà. Il ne dit pas « Retour » parce que l'en-tête de l'écran porte DÉJÀ un
 * bouton « Retour », et deux boutons du même nom dans un document rendent le
 * clavier illisible.
 *
 * ── LE MOUVEMENT EST DÉCLARÉ, PAS DEVINÉ ───────────────────────────────────
 *
 * `packages/config/motion.js` ne portait aucun glissement latéral complet :
 * `panelAdvance` est une AVANCE de 16 px à l'intérieur d'un contenu, et `modalIn`
 * est une fenêtre de page. Le moment `sectionPanelIn` y a donc été ajouté et
 * documenté — 220 ms (la durée de `sheet`, parce que c'est le même geste, couché)
 * sur la courbe `out`, depuis `translateX(100%)`.
 *
 * ── LES DEUX CADRES EXISTENT TOUS LES DEUX ─────────────────────────────────
 *
 * `ScreenFrames` rend le cadre d'ordinateur ET celui de téléphone, et masque l'un
 * en CSS. Deux panneaux sont donc montés. D'où deux précautions :
 *
 *   · le nom de la boîte de dialogue passe par `aria-label`, pas par
 *     `aria-labelledby` : deux fois le même `id` dans un document rendrait le nom
 *     ambigu, et c'est l'écueil que `modal.tsx` documente ;
 *   · le focus, le piège au clavier et Échap sont pris en charge par le SEUL
 *     panneau réellement visible, reconnu à son `offsetParent`. Sans ce filtre,
 *     le panneau masqué volait le focus à celui qu'on regarde.
 */

/** Une ligne du panneau : un drapeau, un nom, une coche. */
function LignePays({
  pays,
  retenu,
  geometrie,
  onChoisir,
}: {
  readonly pays: CountryChoice;
  readonly retenu: boolean;
  readonly geometrie: GeometriePanneau;
  readonly onChoisir: (iso2: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(pays.iso2)}
      aria-pressed={retenu}
      style={{
        ...geometrie.ligne,
        display: 'flex',
        alignItems: 'center',
        borderRadius: '12px',
        background: retenu ? '#E3F0EB' : 'transparent',
        color: '#16211D',
        border: 'none',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '22px',
          height: '15px',
          borderRadius: '3px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          /**
           * 15 px de glyphe dans une boîte de 15 px de haut : le drapeau remplit
           * sa pastille sans la dépasser, et le repli en deux lettres sur Windows
           * y tient aussi. `lineHeight: 1` empêche la police d'ajouter son
           * interligne, qui recentrerait mal le caractère.
           */
          fontSize: '15px',
          lineHeight: 1,
        }}
      >
        {drapeauDe(pays.iso2)}
      </span>
      <span style={{ flex: '1', minWidth: '0', fontSize: '14px', fontWeight: 600 }}>
        {pays.nameFr}
      </span>
      <span
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '999px',
          background: retenu ? '#16785E' : 'transparent',
          border: retenu ? 'none' : '1.5px solid #CBD5D1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {retenu && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

/**
 * LE PANNEAU.
 *
 * Il n'est monté que quand il est ouvert : un panneau fermé mais présent laisserait
 * seize boutons dans l'ordre de tabulation, derrière un contenu visible.
 */
export function SelecteurPays({
  ouvert,
  pays,
  choisiIso2,
  variante,
  onChoisir,
  onFermer,
}: {
  readonly ouvert: boolean;
  readonly pays: readonly CountryChoice[];
  readonly choisiIso2: string;
  readonly variante: 'desktop' | 'mobile';
  readonly onChoisir: (iso2: string) => void;
  readonly onFermer: () => void;
}) {
  const g = GEOMETRIES[variante];
  return (
    <PanneauDeSection
      ouvert={ouvert}
      titre="D’où venez-vous ?"
      variante={variante}
      repere="pays"
      onFermer={onFermer}
    >
      {pays.length === 0 ? (
        /**
         * Une liste vide n'est pas un écran cassé, et elle ne doit pas se
         * confondre avec lui. Aucune planche ne dessine cette phrase — aucune ne
         * dessine ce panneau ; elle est donc sèche et factuelle.
         */
        <PhrasePanneau>Aucun pays n’est proposé pour l’instant.</PhrasePanneau>
      ) : (
        pays.map((p) => (
          <LignePays
            key={p.iso2}
            pays={p}
            retenu={p.iso2 === choisiIso2}
            geometrie={g}
            onChoisir={onChoisir}
          />
        ))
      )}
    </PanneauDeSection>
  );
}
