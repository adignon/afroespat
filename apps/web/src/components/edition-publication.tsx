'use client';

import { FEED_LIMITS } from '@app/shared';
import { photoFondFor } from '@/screens/a14/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ MODIFIER UNE PUBLICATION — LA FENÊTRE QUE LA MAQUETTE NE DESSINE PAS      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le bouton d'option […] qui lui permet d'éditer la publication
 * (dans un modal et reprend le design de l'input la publication à adapter) avec
 * tous ces artifacts (images, guides, sondages) ».
 *
 * ── D'OÙ VIENT CHAQUE TRAIT ───────────────────────────────────────────────
 *
 * Aucune planche ne dessine cette fenêtre. Elle est donc ASSEMBLÉE à partir de
 * deux dessins qui existent, et d'aucun autre :
 *
 *   · le PANNEAU est celui de A01S « Créer un sondage » — 520 px, rayon 28,
 *     retrait 24, en-tête à titre de 20 px/800 et rond de fermeture de 40 px ;
 *   · la BOÎTE et ses pièces jointes sont celles de « A01·S — COMPOSEUR AVEC
 *     PIÈCES JOINTES » : fond `#F2F5F4`, rayon 18, vignettes de 92 px à croix,
 *     carte de sondage blanche, étiquettes de guide vertes. Mot pour mot les
 *     mêmes valeurs que `A01_PIECES_JOINTES` pose dans le cadre du fil.
 *
 * C'est exactement ce que « reprend le design de l'input de la publication »
 * demande : on ne redessine pas, on remploie.
 *
 * ── CE QUE LA FENÊTRE NE PERMET PAS, ET POURQUOI ──────────────────────────
 *
 * ON N'AJOUTE PAS D'IMAGE ICI. Le téléversement vit dans le composeur du fil, qui
 * a son sélecteur de fichier et sa file d'envoi ; le dupliquer ferait deux
 * chemins d'envoi à tenir d'accord. La fenêtre RETIRE — ce qui est le geste que
 * l'on cherche quand on rouvre une publication — et le porteur tranchera s'il
 * veut aussi l'ajout.
 *
 * LE SONDAGE SE RETIRE, IL NE SE RÉÉCRIT PAS. Le serveur refuse les deux dès
 * qu'un vote existe (`POLL_HAS_VOTES`) : changer le libellé d'une option
 * réécrirait ce que des membres ont choisi. Tant qu'il n'a aucun vote, la croix
 * le retire ; sitôt voté, elle disparaît et la carte le dit.
 *
 * AUCUNE OMBRE PORTÉE : T1 §2.3.
 */
export interface EditionPublication {
  readonly texte: string;
  readonly onTexte: (event: { target: { value: string } }) => void;
  readonly images: readonly { readonly id: string; readonly url: string }[];
  readonly onRetirerImage: (id: string) => void;
  readonly guides: readonly { readonly id: string; readonly titre: string }[];
  readonly onRetirerGuide: (id: string) => void;
  readonly sondage: { readonly question: string; readonly options: readonly string[] } | null;
  /** `null` quand le sondage a reçu des votes : il n'est alors plus retirable. */
  readonly onRetirerSondage: (() => void) | null;
  readonly onEnregistrer: () => void;
  readonly bloque: boolean;
  readonly libelle: string;

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS PASTILLES — ON PEUT AUSSI AJOUTER, PAS SEULEMENT RETIRER      ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * La première version de cette fenêtre ne savait que RETIRER, et le disait : « le
   * porteur tranchera s'il veut aussi l'ajout ». Il a tranché — « la modification
   * d'une publication n'affiche plus les 3 boutons du bas pour attacher des
   * choses ».
   *
   * LE DESSIN EST CELUI DU COMPOSEUR GARNI, au caractère près : même hauteur de
   * 36 px, mêmes deux apparences (rond `#E3F0EB` à vide, pastille `#16785E` à
   * libellé quand le contrôle porte quelque chose). C'est la même rangée, dans la
   * même boîte — pas une rangée de plus à apprendre.
   *
   * ELLE N'EST PAS EN ABSOLU ICI. Dans le fil, la planche la pose en
   * `position: absolute` parce que la boîte réserve sa place par un retrait de
   * 58 px. Cette fenêtre n'a pas cette contrainte : la rangée est le dernier
   * enfant du flux, et rien ne peut passer dessous.
   */
  readonly pastilles: {
    readonly sondage: Pastille;
    readonly guides: Pastille;
    readonly images: Pastille;
  };
  readonly onAjouterImage: () => void;
  readonly onSondage: () => void;
  readonly onGuides: () => void;
  /** Quatre images au plus (§2.4) : au-delà, la pastille et la case s'éteignent. */
  readonly ajoutImageBloque: boolean;
  /** Un sondage déjà voté ne se refait pas : la pastille s'éteint, et le dit. */
  readonly sondageFige: boolean;
  readonly imagesCompte: string;
}

/** Un des trois contrôles, dans son apparence du moment — la même qu'au fil. */
interface Pastille {
  readonly garni: boolean;
  readonly libelle: string;
  readonly titre: string;
  readonly encre: string;
}

/**
 * LES TROIS TRACÉS SONT CEUX DE LA PLANCHE, recopiés depuis la rangée du composeur
 * du fil (`A01_PIECES_JOINTES`) : barres pour le sondage, livre ouvert pour les
 * guides, cadre photo pour les images. Aucun n'est redessiné.
 */
const PASTILLES = [
  { cle: 'sondage', trace: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  {
    cle: 'guides',
    trace:
      'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  },
  { cle: 'images', trace: 'M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9' },
] as const;

const CROIX = (taille: number, couleur: string, trait: string) => (
  <svg
    width={taille}
    height={taille}
    viewBox="0 0 24 24"
    fill="none"
    stroke={couleur}
    strokeWidth={trait}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function FenetreEditionPublication(p: EditionPublication) {
  return (
    <>
      <div style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }} data-modal-overlay="" />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '520px',
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          borderRadius: '28px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          /** Le même garde-fou que `FENETRE_QUI_DEBORDE` pose sur les panneaux centrés. */
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
        data-modal-panel=""
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2
            id="edition-publication-titre"
            style={{ margin: '0', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', flex: '1' }}
          >
            Modifier la publication
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
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
            }}
          >
            {CROIX(17, '#16211D', '2')}
          </button>
        </div>

        <div
          style={{
            minWidth: '0',
            minHeight: '92px',
            borderRadius: '18px',
            background: '#F2F5F4',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '14px',
            color: '#8A958F',
          }}
        >
          <textarea
            value={p.texte}
            onChange={p.onTexte}
            maxLength={FEED_LIMITS.postBodyMax}
            placeholder="Que voulez-vous partager avec la diaspora ?"
            aria-label="Le texte de votre publication"
            data-edition-texte=""
            style={{
              width: '100%',
              minHeight: '96px',
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: '14px',
              color: '#16211D',
              outline: 'none',
              padding: 0,
              resize: 'none',
            }}
          />

          {p.images.length === 0 ? null : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {p.images.map((im) => (
                <div
                  key={im.id}
                  style={{
                    position: 'relative',
                    width: '92px',
                    height: '92px',
                    borderRadius: '14px',
                    background: photoFondFor(im.url, false),
                    flexShrink: '0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      p.onRetirerImage(im.id);
                    }}
                    aria-label="Retirer cette image"
                    data-edition-retirer-image=""
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '999px',
                      background: 'rgba(22,33,29,.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {CROIX(11, '#fff', '2.6')}
                  </button>
                </div>
              ))}
              {/**
                * LA CASE EN TIRETÉ EST UN BOUTON, comme dans le composeur du fil : la
                * planche y dessine un « + » et le compte, c'est donc visiblement
                * l'endroit où l'on ajoute. Éteinte à quatre, où il n'y a plus rien à
                * ajouter.
                */}
              <button
                type="button"
                onClick={p.onAjouterImage}
                disabled={p.ajoutImageBloque}
                aria-label="Ajouter une image"
                data-edition-ajouter-image=""
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '14px',
                  border: '1.5px dashed #CBD5D1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#5D6B66',
                  background: 'none',
                  font: 'inherit',
                  padding: 0,
                  flexShrink: '0',
                  cursor: p.ajoutImageBloque ? 'default' : 'pointer',
                  opacity: p.ajoutImageBloque ? '.55' : '1',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5D6B66"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {p.imagesCompte}
              </button>
            </div>
          )}

          {p.sondage === null ? null : (
            <div
              style={{
                background: '#fff',
                border: '1px solid #E6EBE9',
                borderRadius: '16px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '9px',
                    background: '#E3F0EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0F5C48"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                  </svg>
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', flex: '1', color: '#16211D' }}>
                  {p.sondage.question}
                </span>
                {p.onRetirerSondage === null ? (
                  <span style={{ fontSize: '11.5px', color: '#8A958F' }}>déjà voté</span>
                ) : (
                  <button
                    type="button"
                    onClick={p.onRetirerSondage}
                    aria-label="Retirer le sondage"
                    data-edition-retirer-sondage=""
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    {CROIX(13, '#5D6B66', '2.4')}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                {p.sondage.options.map((op, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '10px',
                      background: '#F2F5F4',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#16211D',
                    }}
                  >
                    {op}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.guides.length === 0 ? null : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {p.guides.map((g) => (
                <span
                  key={g.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#EFF7F3',
                    color: '#0F5C48',
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '6px 8px 6px 12px',
                    borderRadius: '999px',
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0F5C48"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                  </svg>
                  {g.titre}
                  <button
                    type="button"
                    onClick={() => {
                      p.onRetirerGuide(g.id);
                    }}
                    aria-label={`Délier ${g.titre}`}
                    data-edition-retirer-guide=""
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    {CROIX(11, '#0F5C48', '2.6')}
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            {PASTILLES.map(({ cle, trace }) => {
              const pa = p.pastilles[cle];
              const eteint =
                (cle === 'images' && p.ajoutImageBloque) || (cle === 'sondage' && p.sondageFige);
              return (
                <button
                  key={cle}
                  type="button"
                  onClick={
                    cle === 'images' ? p.onAjouterImage : cle === 'sondage' ? p.onSondage : p.onGuides
                  }
                  disabled={eteint}
                  aria-label={pa.titre}
                  title={pa.titre}
                  data-edition-pastille={cle}
                  style={{
                    height: '36px',
                    minWidth: '36px',
                    padding: pa.garni ? '0 10px' : '0',
                    borderRadius: '12px',
                    background: pa.garni ? '#16785E' : '#E3F0EB',
                    color: pa.encre,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    font: 'inherit',
                    cursor: eteint ? 'default' : 'pointer',
                    opacity: eteint ? '.55' : '1',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={pa.encre}
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={trace} />
                  </svg>
                  {pa.libelle}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={p.onEnregistrer}
          disabled={p.bloque}
          data-edition-enregistrer=""
          style={{
            height: '50px',
            borderRadius: '14px',
            background: '#16785E',
            color: '#fff',
            border: 'none',
            font: 'inherit',
            fontSize: '14.5px',
            fontWeight: '700',
            cursor: 'pointer',
            opacity: p.bloque ? '.55' : '1',
          }}
        >
          {p.libelle}
        </button>
      </div>
    </>
  );
}
