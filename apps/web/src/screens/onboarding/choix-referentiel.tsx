'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ECART_PANNEAU, placerPanneau, type PlacementPanneau } from './placement-panneau';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUTER DES COMPÉTENCES ET DES LANGUES — O04                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'ajout de compétences et langue ». Puis, deux messages plus
 * tard : « les inputs d'ajout de langue, compétences et autres de la page
 * marchent ? »
 *
 * Ils ne marchaient pas, et il faut dire à quel point : la maquette dessine cinq
 * pastilles — « Comptabilité », « Excel », « Français », « Fon », « Anglais » —
 * et le mot gris « Rechercher… ». MESURÉ AU NAVIGATEUR : zéro `input`, zéro
 * bouton. C'étaient des `<span>` littéraux. Rien ne se cochait, rien ne
 * s'enregistrait, et `updateProfileSchema` portait pourtant `languageIds` et
 * `skillIds` depuis le début.
 *
 * ── CE QUI EST EMPRUNTÉ, ET À QUI ─────────────────────────────────────────
 *
 * La BOÎTE reste celle de la maquette : le transcodeur ne fait que remplacer son
 * CONTENU (`O04_CHOIX_REFERENTIEL`). Tout ce qui est dessiné ici vient de
 * `01 Accès et Onboarding.dc.html`, section O04 :
 *
 *   · la pastille — `background:#fff;border-radius:999px;padding:6px 12px;
 *     font-size:12.5px;font-weight:600`, verbatim ;
 *   · l'invite — `font-size:12.5px;color:#8A958F;padding:0 6px`, c'est-à-dire le
 *     « Rechercher… » que la planche pose au bout de la rangée. Il devient un
 *     champ, à sa place et à sa taille ;
 *   · la croix de retrait — le tracé `M18 6 6 18M6 6l12 12`, celui des fenêtres
 *     du dépôt, en 10 px et dans le gris des métadonnées `#8A958F`.
 *
 * La LISTE DE SUGGESTIONS n'est dessinée nulle part — aucune planche ne la
 * montre. Sa coque est celle de la liste de villes de O02, dans la MÊME maquette
 * (`border:1px solid #EAEEEC;border-radius:16px;padding:6px`, lignes de 48 px,
 * rayon 12, retrait `0 12px`, nom en 14 px / 600, `#E3F0EB` au survol du choix).
 * C'est la seule liste de suggestions que ce dossier dessine.
 *
 * ── TROIS TEXTES NON DESSINÉS ─────────────────────────────────────────────
 *
 * « Retirer … », « Aucun résultat. » et la phrase de borne. REMONTÉS.
 */

export interface ChoixItem {
  readonly id: string;
  readonly nom: string;
  /**
   * La catégorie servie par `GET /places/skills` ; `null` quand le serveur n'en
   * donne pas, ABSENTE pour les langues, qui n'en ont pas du tout. Les trois cas
   * existent, et les confondre forcerait un `as` quelque part.
   */
  readonly detail?: string | null | undefined;
}

const plier = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export function ChoixReferentiel({
  libelle,
  options,
  choisis,
  max,
  onAjouter,
  onRetirer,
  onCreer,
}: {
  /** « Compétences » ou « Langues » — pour nommer le champ au clavier. */
  readonly libelle: string;
  readonly options: readonly ChoixItem[];
  readonly choisis: readonly ChoixItem[];
  readonly max: number;
  readonly onAjouter: (id: string) => void;
  readonly onRetirer: (id: string) => void;
  /**
   * ── LA SAISIE LIBRE, QUAND ELLE EST PERMISE ─────────────────────────────
   *
   * Le porteur : « Les compétences doivent aussi supporter le free typing qui
   * crée de nouvelles compétences. »
   *
   * Absente pour les LANGUES, et c'est délibéré : une langue est un code
   * ISO 639-1 côté serveur, pas un mot libre. En inventer une donnerait une
   * ligne que rien ne sait rapprocher d'une autre.
   */
  readonly onCreer?: ((nom: string) => Promise<void>) | undefined;
}) {
  /**
   * La saisie vit ICI et non dans l'état du flux : c'est un texte de travail,
   * jamais enregistré, et le remonter ferait repasser tout l'écran à chaque
   * frappe. Les IDENTIFIANTS retenus, eux, sont dans l'état — c'est eux qui
   * partent.
   */
  const [saisie, setSaisie] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [creation, setCreation] = useState(false);
  const listeId = useId();
  const saisieRef = useRef<HTMLInputElement | null>(null);
  const [place, setPlace] = useState<PlacementPanneau>({ cote: 'dessous', hauteurMax: 220 });

  /**
   * LE PANNEAU SUIT SON CHAMP. Posé sous la boîte qui porte la saisie (son parent, rendu
   * `position: relative` par le générateur — voir `interrupteur-vivant.mjs`), à sa largeur ;
   * au-dessus si le bas de la fenêtre est trop près. Recalculé à l'ouverture, au
   * défilement et au redimensionnement : un panneau qui garde sa place pendant que la page
   * bouge finit hors du champ.
   */
  const replacer = useCallback(() => {
    const boite = saisieRef.current?.parentElement;
    if (!boite) return;
    const r = boite.getBoundingClientRect();
    setPlace((avant) => {
      const suivant = placerPanneau(r, window.innerHeight);
      return avant.cote === suivant.cote && avant.hauteurMax === suivant.hauteurMax ? avant : suivant;
    });
  }, []);
  useLayoutEffect(() => {
    if (ouvert) replacer();
  }, [ouvert, replacer, choisis.length, saisie]);
  useEffect(() => {
    if (!ouvert) return;
    window.addEventListener('scroll', replacer, true);
    window.addEventListener('resize', replacer);
    return () => {
      window.removeEventListener('scroll', replacer, true);
      window.removeEventListener('resize', replacer);
    };
  }, [ouvert, replacer]);

  const net = plier(saisie);
  const dejaPris = new Set(choisis.map((c) => c.id));
  const plein = choisis.length >= max;
  const suggestions = options
    .filter((o) => !dejaPris.has(o.id))
    .filter((o) => net === '' || plier(o.nom).includes(net))
    /**
     * HUIT AU PLUS. 60 compétences dans une liste posée sur le reste du
     * formulaire le recouvriraient entièrement ; la recherche est là pour
     * resserrer, pas pour tout dérouler.
     */
    .slice(0, 8);

  /**
   * ── « CRÉER … » N'APPARAÎT QUE QUAND RIEN NE CORRESPOND EXACTEMENT ───────
   *
   * Le repère est l'ÉGALITÉ du nom replié, pas l'absence de suggestions : taper
   * « compta » propose « Comptabilité » ET permet de créer « compta », parce que
   * ce sont deux choses différentes. Taper « Comptabilité » en entier ne propose
   * plus de la créer — elle existe.
   *
   * On regarde TOUTES les options, y compris celles déjà retenues : proposer de
   * créer une compétence qu'on vient de cocher serait un doublon offert.
   */
  const texte = saisie.trim();
  const existeDeja = options.some((o) => plier(o.nom) === plier(texte));
  const peutCreer =
    onCreer !== undefined && texte.length >= 2 && texte.length <= 60 && !existeDeja && !plein;

  return (
    <>
      {choisis.map((c) => (
        <span
          key={c.id}
          style={{
            background: '#fff',
            borderRadius: '999px',
            padding: '6px 12px',
            fontSize: '12.5px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {c.nom}
          <button
            type="button"
            onClick={() => onRetirer(c.id)}
            aria-label={`Retirer ${c.nom}`}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#8A958F',
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <input
        type="text"
        value={saisie}
        onChange={(event) => {
          setSaisie(event.target.value);
          setOuvert(true);
        }}
        ref={saisieRef}
        onFocus={() => setOuvert(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && ouvert) {
            event.stopPropagation();
            setOuvert(false);
          }
        }}
        /**
         * `onBlur` DIFFÉRÉ : un clic sur une suggestion déclenche le `blur` du
         * champ AVANT son propre `click`. Fermer tout de suite démonterait la
         * ligne sous le doigt, et le clic ne toucherait plus rien — le défaut
         * classique de ce contrôle, et il ne se voit qu'à la souris.
         */
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        placeholder={plein ? '' : 'Rechercher…'}
        aria-label={`Ajouter ${libelle.toLocaleLowerCase('fr-FR')}`}
        aria-expanded={ouvert && suggestions.length > 0}
        aria-controls={listeId}
        disabled={plein}
        data-saisie-sur-gris=""
        style={{
          flex: '1',
          minWidth: '80px',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          // L'invite de la maquette : 12,5 px, gris `#8A958F`, retrait `0 6px`.
          fontFamily: 'inherit',
          fontSize: '12.5px',
          color: '#16211D',
          padding: '0 6px',
        }}
      />

      {ouvert && (
        <div
          id={listeId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            ...(place.cote === 'dessous'
              ? { top: `calc(100% + ${ECART_PANNEAU}px)` }
              : { bottom: `calc(100% + ${ECART_PANNEAU}px)` }),
            zIndex: 20,
            boxSizing: 'border-box',
            background: '#fff',
            border: '1px solid #EAEEEC',
            borderRadius: '16px',
            padding: '6px',
            maxHeight: `${place.hauteurMax}px`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            /**
             * AUCUNE OMBRE PORTÉE — T1 §2.3.
             *
             * `boxShadow: '0 8px 24px rgba(22,33,29,.08)'` était posé ici, et il
             * contredisait la règle : `e2e/services.spec.ts` la relève écran par
             * écran, et les sept maquettes du produit n'écrivent PAS UNE ombre
             * (`grep box-shadow docs/template/*.dc.html` rend zéro). Ce panneau
             * n'est pas couvert par ce relevé — il vit dans l'onboarding — d'où
             * l'ombre survivante.
             *
             * Le bord `1px solid #EAEEEC` qu'il porte déjà est la façon dont ce
             * produit détache un panneau flottant ; il suffit, et c'est celle des
             * deux autres panneaux du dépôt.
             */
          }}
        >
          {plein ? (
            <p style={{ margin: 0, padding: '12px', fontSize: '12.5px', color: '#5D6B66' }}>
              {max} au maximum. Retirez-en un pour en ajouter un autre.
            </p>
          ) : suggestions.length === 0 && !peutCreer ? (
            <p style={{ margin: 0, padding: '12px', fontSize: '12.5px', color: '#5D6B66' }}>
              Aucun résultat.
            </p>
          ) : (
            suggestions.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={false}
                /**
                 * ╔══════════════════════════════════════════════════════════╗
                 * ║ `onMouseDown` NE FAIT QU'UNE CHOSE : GARDER LE FOCUS     ║
                 * ╚══════════════════════════════════════════════════════════╝
                 *
                 * Première version : il AJOUTAIT aussi, et `onClick` ajoutait de
                 * son côté « puisque l'option disparaît des suggestions ». C'était
                 * faux, et le test l'a montré — deux identifiants partaient pour
                 * un seul clic.
                 *
                 * La mécanique exacte : `mousedown` ajoute et vide la saisie, la
                 * liste se re-rend AVEC D'AUTRES OPTIONS (le filtre a disparu),
                 * puis `click` tombe à la même position… sur une ligne
                 * différente. On ajoutait donc la compétence voulue ET la première
                 * de la liste complète.
                 *
                 * `preventDefault` seul empêche le champ de perdre le focus —
                 * c'est tout ce dont on a besoin pour que la liste ne se ferme pas
                 * sous le doigt. L'ajout, lui, se fait UNE FOIS, dans `onClick`,
                 * qui répond aussi au clavier.
                 */
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onAjouter(o.id);
                  setSaisie('');
                  /**
                   * LA LISTE SE FERME APRÈS UN CHOIX, et ce n'est pas un détail
                   * de confort. Laissée ouverte, elle se re-remplissait avec les
                   * huit premières options NON FILTRÉES — la saisie venant d'être
                   * vidée — et les deux boîtes de l'écran pouvaient avoir leur
                   * liste ouverte en même temps, l'une par-dessus l'autre. Une
                   * pastille apparaît immédiatement pour dire que le choix est
                   * pris ; retaper rouvre la liste.
                   */
                  setOuvert(false);
                }}
                style={{
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: '#16211D',
                  border: 'none',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
                <span style={{ flex: '1', minWidth: '0', fontSize: '14px', fontWeight: 600 }}>
                  {o.nom}
                </span>
                {o.detail !== undefined && o.detail !== null && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#5D6B66' }}>
                    {o.detail}
                  </span>
                )}
              </button>
            ))
          )}

          {peutCreer && (
            /**
             * LA LIGNE DE CRÉATION — même boîte qu'une suggestion, pour que le
             * geste soit le même ; seule l'encre change, celle des actions de
             * cette maquette (`#16785E`).
             *
             * Le nom tapé est cité ENTRE GUILLEMETS pour qu'on voie exactement ce
             * qui sera créé, espaces compris. C'est ce que le serveur enregistrera,
             * après `trim`.
             */
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (creation) return;
                setCreation(true);
                void onCreer(texte).finally(() => {
                  setCreation(false);
                  setSaisie('');
                  setOuvert(false);
                });
              }}
              disabled={creation}
              style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 12px',
                borderRadius: '12px',
                background: 'transparent',
                color: '#16785E',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 700,
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {creation ? 'Création…' : `Créer « ${texte} »`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
