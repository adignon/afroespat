'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS POINTS D'UNE PUBLICATION — MODIFIER, SUPPRIMER                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Mets à côté du bouton bookmark (à gauche du bouton) le bouton
 * d'option sur la publication, visible uniquement par le propriétaire, qui lui
 * permet d'éditer la publication […] ou de supprimer la publication. Donc le clic
 * sur les trois points affiche un menu de contexte qui présente ces options. »
 *
 * ── CE DESSIN N'EST PAS DANS LA MAQUETTE ──────────────────────────────────
 *
 * Aucune planche ne dessine de « trois points », nulle part — vérifié sur les
 * neuf fichiers de `docs/template`. La forme ci-dessous est donc demandée, pas
 * transcrite, et elle emprunte tout ce qu'elle peut :
 *
 *   · le bouton reprend EXACTEMENT le rond de 40 px du signet qu'il jouxte —
 *     même diamètre, même fond `#F2F5F4`, même centrage ;
 *   · le panneau reprend la carte blanche à bord `#E6EBE9` et rayon 16 px que
 *     la maquette emploie pour toutes ses cartes secondaires ;
 *   · « Supprimer » prend le rouge `#C2453B`, le seul rouge de la palette, celui
 *     que `08 Compte` emploie déjà pour « Supprimer mon compte ».
 *
 * AUCUNE OMBRE PORTÉE : T1 §2.3. Un menu flottant sans ombre tient par sa bordure
 * et son fond blanc — c'est ce que fait déjà le survol du rail.
 *
 * ── CE QUE LE COMPOSANT NE DÉCIDE PAS ─────────────────────────────────────
 *
 * Il ne sait pas si on est l'auteur : c'est le cadre qui ne le rend que sous
 * `p.isAuthor`, lequel vient du SERVEUR. Décider ici reviendrait à lire un droit
 * dans le navigateur — et un menu de suppression affiché à tort serait une
 * promesse que l'API refuserait.
 */
export function MenuPublication({
  onModifier,
  onSupprimer,
}: {
  readonly onModifier?: (() => void) | undefined;
  readonly onSupprimer?: (() => void) | undefined;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLSpanElement | null>(null);

  /**
   * ON FERME AU CLIC DEHORS ET À ÉCHAP — les deux, pas l'un ou l'autre.
   *
   * Un menu de contexte qui ne se ferme qu'en rechoisissant les trois points
   * reste ouvert pendant qu'on lit le fil, et recouvre la carte suivante. Échap
   * est la sortie clavier ; le clic dehors est la sortie à la souris. C'est ce
   * que les fenêtres transcodées tiennent déjà, et `e2e/modales.spec.ts` le
   * garde pour chacune.
   *
   * `mousedown` ET NON `click` : un `click` sur un élément qui disparaît au
   * `mousedown` n'est jamais émis, et l'écoute manquerait le geste.
   */
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (event: MouseEvent): void => {
      if (boite.current !== null && !boite.current.contains(event.target as Node)) {
        setOuvert(false);
      }
    };
    const echap = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  const entree = (
    libelle: string,
    repere: string,
    encre: string,
    chemin: string,
    action: (() => void) | undefined,
  ) => (
    <button
      type="button"
      data-publication-action={repere}
      onClick={() => {
        setOuvert(false);
        action?.();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        height: '42px',
        padding: '0 14px',
        border: 'none',
        background: 'none',
        font: 'inherit',
        fontSize: '13.5px',
        fontWeight: '700',
        color: encre,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={encre}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={chemin} />
      </svg>
      {libelle}
    </button>
  );

  return (
    <span ref={boite} style={{ position: 'relative', flexShrink: '0' }}>
      <button
        type="button"
        onClick={() => {
          setOuvert((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Options de la publication"
        title="Options de la publication"
        data-publication-options=""
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          border: 'none',
          background: '#F2F5F4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          font: 'inherit',
          flexShrink: '0',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="#16211D">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {ouvert ? (
        <span
          role="menu"
          data-publication-menu=""
          style={{
            position: 'absolute',
            top: '46px',
            /**
             * ANCRÉ À DROITE : le bouton est en bout de ligne, et un panneau qui
             * partirait vers la droite sortirait de la carte. C'est le même choix
             * que la maquette fait pour tous ses panneaux de bord.
             */
            right: '0',
            minWidth: '184px',
            background: '#fff',
            border: '1px solid #E6EBE9',
            borderRadius: '16px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 20,
          }}
        >
          {entree(
            'Modifier',
            'modifier',
            '#16211D',
            'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
            onModifier,
          )}
          {entree(
            'Supprimer',
            'supprimer',
            '#C2453B',
            'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
            onSupprimer,
          )}
        </span>
      ) : null}
    </span>
  );
}
