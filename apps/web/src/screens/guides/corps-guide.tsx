'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { guideBodyMediaKeys } from '@app/shared';
import { urlMedia } from '@/lib/api/base';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE CORPS DU GUIDE — « TOUT ÇA EST DESSINÉ »                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : les deux sections, leurs paragraphes, leur
 * liste et leurs cadres d'image étaient le texte de la maquette — « Visale est
 * une caution gratuite proposée par Action Logement… » — affiché sur TOUS les
 * guides. `GET /guides/:slug` rendait pourtant `currentVersion.body` depuis le
 * début.
 *
 * ── CE QUE LE CORPS PEUT CONTENIR, ET RIEN DE PLUS ─────────────────────────
 *
 * `restrictedMarkdownIssue` (`@app/shared`) le dit, et le serveur le refuse
 * autrement : PAS de HTML, les titres bornés à `##` et `###` — « le titre du
 * guide est déjà le `h1` de la page, et un second briserait la structure du
 * document pour un lecteur d'écran » — et les images bornées au PIPELINE MÉDIA
 * de l'application.
 *
 * Ce rendu suit exactement cette grammaire. Il n'interprète rien d'autre, et il
 * n'a pas besoin d'une bibliothèque.
 *
 * ── CE QUE CET EN-TÊTE DISAIT, ET QUI N'EST PLUS VRAI ─────────────────────
 *
 * Il affirmait : « ⚠ LES CADRES D'IMAGE DE LA MAQUETTE DISPARAISSENT […] un guide
 * NE PEUT PAS porter d'image : il n'existe pas de table de médias pour les
 * guides, et le schéma rejette `![…](…)` en le nommant. » C'ÉTAIT EXACT, et ce
 * n'est plus le cas. Le porteur : « Les guides ont des images, il faut pouvoir
 * les ouvrir. » Le corps accepte désormais `![légende](/media/<clé>)`, et
 * `guideBodyMediaKeys` — LA MÊME grammaire que celle qui valide à l'écriture —
 * dit lesquelles sont des médias de l'application.
 *
 * Il affirmait aussi que « Proposer une correction sur ce passage » disparaissait
 * « parce que la maquette l'attache à un passage SURLIGNÉ, c'est-à-dire à une
 * sélection de texte : c'est un exemple de ce que fera la correction par passage,
 * pas un contrôle que le corps porte ». LA LECTURE ÉTAIT JUSTE, LA CONCLUSION
 * FAUSSE : c'est bien une sélection, et une sélection, ça s'écoute. Le geste est
 * donc ici, à l'endroit même où la maquette le dessine.
 *
 * ── LES STYLES SONT CEUX DE LA PLANCHE, AU CARACTÈRE PRÈS ──────────────────
 *
 *   titre de section  `26px 0 0` · 19 px / 700 · `-0.3px`
 *   sous-section      le même, en 16 px — la planche n'en dessine pas, donc il
 *                     descend d'un cran depuis celui qu'elle dessine
 *   paragraphe        `10px 0 0` · 15 px · interligne 1,72
 *   liste             `paddingLeft: 20px` · 15 px · interligne 1,85
 *   image (1440)      `<figure>` à `24px 0 0`, bloc de 220 px au rayon 18,
 *                     `<figcaption>` 12,5 px `#8A958F` à 8 px
 *   image (390)       conteneur à `margin-top: 14px`, bloc de 170 px au rayon 14,
 *                     attribution 11,5 px `#8A958F` à 6 px, sur sa propre ligne
 *
 * ── POURQUOI UN `planche` ET NON UNE SEULE SORTIE ─────────────────────────
 *
 * Tant que le corps n'était que du texte, un seul nœud rendu dans les deux cadres
 * suffisait : les deux planches écrivent leurs paragraphes à la même taille.
 * L'IMAGE, elle, n'a pas le même dessin aux deux largeurs — relevé sur les octets
 * de la maquette, pas supposé :
 *
 *   · à 1440 px la légende est SOUS le bloc, dans un `<figcaption>`, suivie de
 *     « · Image ajoutée par Marc K. » sur la MÊME ligne ;
 *   · à 390 px la légende est DANS le bloc (c'est le texte du cadre rayé) et
 *     « Image ajoutée par Marc K. » occupe sa propre ligne, en 11,5 px.
 *
 * Un seul nœud rendrait donc le dessin d'ordinateur sur le téléphone, ou
 * l'inverse. `A04_CORPS` passe désormais deux prises — `corpsGuide` et
 * `corpsGuideMobile` — et la planche se déclare ici.
 */
const TITRE: React.CSSProperties = {
  margin: '26px 0 0',
  fontSize: '19px',
  fontWeight: 700,
  letterSpacing: '-0.3px',
};

const SOUS_TITRE: React.CSSProperties = { ...TITRE, fontSize: '16px' };

const PARAGRAPHE: React.CSSProperties = { margin: '10px 0 0', fontSize: '15px', lineHeight: '1.72' };

const LISTE: React.CSSProperties = {
  margin: '16px 0 0',
  paddingLeft: '20px',
  fontSize: '15px',
  lineHeight: '1.85',
};

/**
 * LE FOND RAYÉ EST LE PLACEHOLDER DE LA MAQUETTE, PAS L'IMAGE.
 *
 * Elle dessine `repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)`
 * avec une étiquette au centre — « Capture : écran "Mon attestation" sur
 * visale.fr ». C'est ce qu'un outil de maquette met À LA PLACE d'une image qu'il
 * n'a pas. Le mettre à la place de la vraie image serait reproduire le trou, pas
 * le dessin.
 *
 * Il reste donc le FOND du bloc : visible tant que l'image n'est pas chargée,
 * recouvert par elle ensuite. Une image qui ne répond pas (média retiré, réseau
 * coupé) laisse le fond rayé et son étiquette, ce qui est exactement le dessin que
 * la maquette prévoit pour « pas d'image ici ».
 */
const RAYURES = 'repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)';

/** Le cadre d'image, aux valeurs de chaque planche. */
const BLOC_IMAGE = (planche: Planche): React.CSSProperties => ({
  height: planche === 'desktop' ? '220px' : '170px',
  borderRadius: planche === 'desktop' ? '18px' : '14px',
  background: RAYURES,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: planche === 'desktop' ? '12.5px' : '11.5px',
  fontWeight: 600,
  color: '#7C8C85',
  overflow: 'hidden',
  position: 'relative',
  /** La planche mobile le déclare ; celle d'ordinateur ne le fait pas. */
  ...(planche === 'desktop' ? {} : { flexShrink: 0 }),
});

export type Planche = 'desktop' | 'mobile';

/**
 * L'INFOBULLE DE LA PLANCHE DE 1 440 px, AU CARACTÈRE PRÈS.
 *
 * `background:#16211D;color:#fff;font-size:12.5px;font-weight:700;padding:9px 14px;
 * border-radius:12px;display:flex;align-items:center;gap:8px;white-space:nowrap`,
 * posée `top: calc(100% + 8px)` sous le passage et centrée par
 * `translateX(-50%)`.
 *
 * ⚠ ÉCART DE MAQUETTE, ASSUMÉ ET REMONTÉ : la planche de 390 px dessine le passage
 * surligné SANS infobulle — elle n'offre la correction que par le crayon de sa
 * barre basse, qui mène à la feuille sans passage visé. La règle du porteur est
 * pourtant explicite (« veille toujours à ce que toutes les corrections soient
 * aussi faites sur mobile »), et un geste de sélection sans affordance n'existe
 * pas. L'infobulle d'ordinateur est donc EMPRUNTÉE telle quelle à la planche de
 * 1 440 px de la MÊME maquette : aucune valeur inventée, et le libellé est le sien.
 */
const INFOBULLE: React.CSSProperties = {
  position: 'absolute',
  transform: 'translateX(-50%)',
  background: '#16211D',
  color: '#fff',
  fontSize: '12.5px',
  fontWeight: 700,
  padding: '9px 14px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
  border: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  zIndex: 5,
};

/**
 * LE GRAS ET LES LIENS, posés sans `dangerouslySetInnerHTML`.
 *
 * Le corps est écrit par des membres : le passer en HTML brut serait une
 * injection, et c'est exactement ce que `restrictedMarkdownIssue` interdit côté
 * serveur. On découpe donc le texte et on rend des nœuds.
 */
function enLigne(texte: string, cle: string): ReactNode[] {
  const morceaux: ReactNode[] = [];
  const motif = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let dernier = 0;
  let rang = 0;
  for (const m of texte.matchAll(motif)) {
    const i = m.index ?? 0;
    if (i > dernier) morceaux.push(texte.slice(dernier, i));
    rang += 1;
    if (m[1] !== undefined) {
      morceaux.push(
        <strong key={`${cle}-g${String(rang)}`} style={{ fontWeight: 700 }}>
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      morceaux.push(
        /**
         * `rel="noopener noreferrer"` ET `target="_blank"` : un lien écrit par
         * un membre sort du produit, et sans `noopener` la page ouverte garde
         * une prise sur celle-ci.
         */
        <a
          key={`${cle}-l${String(rang)}`}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0F5C48', textDecoration: 'underline' }}
        >
          {m[2]}
        </a>,
      );
    }
    dernier = i + m[0].length;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return morceaux;
}

/** Toutes les images d'une ligne : leur légende et leur cible. */
const IMAGE = /!\[([^\]]*)\]\(([^)\s]*)\)/g;

interface ImageCitee {
  readonly legende: string;
  readonly cible: string;
}

/**
 * LES IMAGES SORTENT DE LEUR LIGNE, ET ELLES NE S'Y REMETTENT PAS.
 *
 * La maquette ne dessine JAMAIS d'image au milieu d'une phrase : ses trois cadres
 * sont des blocs, entre un paragraphe et le titre suivant. Une image écrite dans
 * une phrase est donc PROMUE en bloc, à sa place dans l'ordre du texte, et la
 * phrase garde ses mots. L'alternative — inventer un dessin d'image en ligne que
 * la planche n'a pas — serait dessiner à la place du porteur.
 *
 * LA CIBLE EST VÉRIFIÉE PAR LA GRAMMAIRE DU SERVEUR, pas par une seconde écrite
 * ici : `guideBodyMediaKeys` est la fonction même qui valide le corps à
 * l'écriture et qui alimente `guide_media.position`. Deux expressions voisines
 * auraient fini par diverger, et le symptôme aurait été une image acceptée à
 * l'écriture puis rendue en texte brut à la lecture.
 *
 * Une image qui n'est PAS un média de l'application ne peut pas arriver ici — le
 * serveur la refuse par `IMAGE_EXTERNAL` — mais si elle arrivait (un corps écrit
 * avant la règle, une migration), son balisage reste du TEXTE. On n'affiche pas
 * une adresse étrangère dans une page de membre.
 */
function imagesDe(ligne: string): { readonly texte: string; readonly images: ImageCitee[] } {
  const images: ImageCitee[] = [];
  const texte = ligne.replace(IMAGE, (tout, legende: string, cible: string) => {
    if (guideBodyMediaKeys(tout).length === 0) return tout;
    images.push({ legende, cible });
    return '';
  });
  return { texte: texte.replace(/\s{2,}/g, ' ').trim(), images };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « IMAGE AJOUTÉE PAR … » — CE QU'ON SAIT, ET CE QU'ON NE SAIT PAS          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette écrit « Image ajoutée par Marc K. » sous chacun de ses trois cadres.
 *
 * ⚠ ÉCART DE MAQUETTE, REMONTÉ : personne ne sait QUI a ajouté CETTE image. Le
 * corps est une chaîne de Markdown ; `guide_media` rattache les clés au guide,
 * mais `GET /guides/:slug` ne rend ni cette table ni un contributeur par image.
 * Le nom affiché est donc celui de l'auteur de la VERSION COURANTE — c'est-à-dire
 * de la personne qui a écrit le corps où l'image est citée, ce qui est la
 * meilleure approximation disponible et souvent la bonne — et, à défaut, celui de
 * l'auteur du guide.
 *
 * Sans aucun des deux (guide anonymisé, §8), la ligne d'attribution TOMBE plutôt
 * que de nommer personne ou d'écrire « anonyme » là où la maquette met un nom.
 */
function Figure({
  image,
  planche,
  auteurImage,
  cle,
}: {
  readonly image: ImageCitee;
  readonly planche: Planche;
  readonly auteurImage: string | null;
  readonly cle: string;
}) {
  const attribution = auteurImage === null ? null : `Image ajoutée par ${auteurImage}`;
  const bloc = (
    <div style={BLOC_IMAGE(planche)}>
      {/**
       * L'ÉTIQUETTE CENTRÉE DE LA MAQUETTE EST LA LÉGENDE, sur la planche mobile :
       * elle écrit « Capture : écran "Mon attestation" » DANS le cadre rayé. Sur
       * l'ordinateur, le cadre porte sa propre étiquette et la légende va dans le
       * `<figcaption>` — on ne la redouble donc pas.
       */}
      {planche === 'mobile' && image.legende !== '' ? <span>{image.legende}</span> : null}
      {/**
       * `<img>` ET NON `next/image` : l'adresse est servie par l'API (`/media/…`,
       * rendue absolue par `urlMedia`), pas par Next, et l'optimiseur de Next
       * exigerait de déclarer ce domaine ET de le rendre joignable au moment du
       * rendu serveur — ce qu'il n'est pas en développement derrière ngrok.
       *
       * `position: absolute` par-dessus le fond rayé : l'image recouvre le
       * placeholder quand elle arrive, et le laisse voir quand elle n'arrive pas.
       */}
      <img
        src={urlMedia(image.cible)}
        alt={image.legende}
        loading="lazy"
        decoding="async"
        data-guide-image=""
        style={{
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );

  if (planche === 'mobile') {
    /**
     * LA PLANCHE DE 390 px N'EMPLOIE PAS `<figure>` : elle écrit un `<div>` à
     * `margin-top: 14px` contenant le bloc, puis une ligne séparée pour
     * l'attribution. On reprend sa structure, et son `<figure>` sémantique avec —
     * un bloc d'image avec sa légende EST une figure, quelle que soit la largeur.
     */
    return (
      <figure key={cle} style={{ margin: '14px 0 0' }}>
        {bloc}
        {attribution === null ? null : (
          <figcaption style={{ fontSize: '11.5px', color: '#8A958F', marginTop: '6px' }}>
            {attribution}
          </figcaption>
        )}
      </figure>
    );
  }

  /**
   * SUR L'ORDINATEUR LA LÉGENDE ET L'ATTRIBUTION PARTAGENT LA LIGNE, séparées par
   * « · » — c'est ce que la maquette écrit : « L'attestation apparaît dans
   * l'onglet "Mes documents" sous 48 h. · Image ajoutée par Marc K. »
   */
  const ligne = [image.legende, attribution].filter((p) => p !== null && p !== '').join(' · ');
  return (
    <figure key={cle} style={{ margin: '24px 0 0' }}>
      {bloc}
      {ligne === '' ? null : (
        <figcaption style={{ fontSize: '12.5px', color: '#8A958F', marginTop: '8px' }}>
          {ligne}
        </figcaption>
      )}
    </figure>
  );
}

/** Où l'infobulle se pose, et sur quel passage. */
interface Visee {
  readonly passage: string;
  readonly top: number;
  readonly left: number;
}

export function CorpsGuide({
  body,
  planche,
  auteurImage = null,
  onProposerCorrection,
}: {
  readonly body: string;
  readonly planche: Planche;
  /** Le nom à écrire sous une image. `null` = la ligne d'attribution tombe. */
  readonly auteurImage?: string | null;
  /**
   * Absent = le corps est en LECTURE SEULE et n'écoute aucune sélection. C'est le
   * cas de la page `/guides/:slug/corriger`, où le panneau est déjà ouvert : y
   * proposer une seconde correction depuis le guide esquissé derrière le voile
   * n'aurait pas de sens.
   */
  readonly onProposerCorrection?: (passage: string) => void;
}) {
  const boite = useRef<HTMLDivElement | null>(null);
  const [visee, setVisee] = useState<Visee | null>(null);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE GESTE EST UNE SÉLECTION DE TEXTE, ET LA MAQUETTE LE DIT              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Planche de 1 440 px, dans le corps du guide : un passage sur fond `#CFE3DA`
   * porte une infobulle « Proposer une correction sur ce passage ». Ce n'est pas
   * une entrée de menu — c'est ce qu'on voit APRÈS avoir sélectionné.
   *
   * ── LE SURLIGNAGE EST CELUI DU NAVIGATEUR, ET C'EST VOULU ────────────────
   *
   * La maquette peint le passage en `#CFE3DA`. Le peindre nous-mêmes exigerait de
   * découper les nœuds de texte du membre autour de la sélection, c'est-à-dire de
   * réécrire son corps dans le DOM à chaque mouvement de souris — pour obtenir ce
   * que la surbrillance native donne déjà, au clavier comme au doigt, et dans la
   * langue du système. On garde donc la sélection du navigateur. ÉCART DE TEINTE
   * REMONTÉ : elle n'est pas `#CFE3DA`.
   *
   * ── CE QU'ON REFUSE, ET POURQUOI ────────────────────────────────────────
   *
   * `targetExcerpt` exige au moins trois caractères (`createProposalSchema`), et
   * le serveur doit RETROUVER le passage dans la version courante. Une sélection
   * qui déborde du corps — sur le titre, sur la colonne de droite — ne s'y trouve
   * pas : on vérifie donc que les DEUX extrémités sont dans la boîte, et non
   * seulement l'ancre.
   */
  const relever = useCallback((): void => {
    if (onProposerCorrection === undefined) return;
    const boiteEl = boite.current;
    if (boiteEl === null) return;

    const selection = window.getSelection();
    if (selection === null || selection.isCollapsed || selection.rangeCount === 0) {
      setVisee(null);
      return;
    }
    const { anchorNode, focusNode } = selection;
    if (
      anchorNode === null ||
      focusNode === null ||
      !boiteEl.contains(anchorNode) ||
      !boiteEl.contains(focusNode)
    ) {
      setVisee(null);
      return;
    }

    const passage = selection.toString().trim();
    /** Trois caractères : le plancher de `targetExcerpt`, pas un seuil inventé. */
    if (passage.length < 3) {
      setVisee(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const cadre = boiteEl.getBoundingClientRect();
    setVisee({
      passage,
      /** `calc(100% + 8px)` de la maquette : 8 px sous le bas du passage. */
      top: rect.bottom - cadre.top + 8,
      /**
       * `left: 50%` + `translateX(-50%)` de la maquette, ramenés au milieu du
       * passage. La position est BORNÉE à la boîte : à 390 px, une sélection
       * près du bord droit aurait poussé l'infobulle hors de l'écran — mesuré.
       */
      left: Math.min(
        Math.max(rect.left + rect.width / 2 - cadre.left, 130),
        Math.max(cadre.width - 130, 130),
      ),
    });
  }, [onProposerCorrection]);

  /**
   * `selectionchange` SUR LE DOCUMENT, et pas seulement `mouseup` sur la boîte.
   *
   * Trois façons de sélectionner, et `mouseup` n'en couvre qu'une : la souris, le
   * clavier (`Shift` + flèches, `Ctrl+A`) et le doigt — où le relâchement arrive
   * AVANT que le navigateur n'ait posé les poignées de sélection, donc où
   * `touchend` lit une sélection vide. Mesuré à 390 px : zéro infobulle avec
   * `touchend` seul.
   *
   * `selectionchange` est le seul événement que les trois déclenchent. Il arrive
   * aussi quand la sélection DISPARAÎT, ce qui ferme l'infobulle sans qu'on ait à
   * écouter les clics ailleurs.
   */
  useEffect(() => {
    if (onProposerCorrection === undefined) return undefined;
    const surSelection = (): void => {
      relever();
    };
    document.addEventListener('selectionchange', surSelection);
    return () => {
      document.removeEventListener('selectionchange', surSelection);
    };
  }, [relever, onProposerCorrection]);

  const lignes = body.replace(/\r\n/g, '\n').split('\n');
  const noeuds: ReactNode[] = [];
  let puces: string[] = [];
  let paragraphe: string[] = [];

  const viderListe = (cle: string): void => {
    if (puces.length === 0) return;
    noeuds.push(
      <ul key={`ul-${cle}`} style={LISTE}>
        {puces.map((p, i) => (
          <li key={`${cle}-${String(i)}`}>{enLigne(p, `${cle}-${String(i)}`)}</li>
        ))}
      </ul>,
    );
    puces = [];
  };

  const viderParagraphe = (cle: string): void => {
    if (paragraphe.length === 0) return;
    const texte = paragraphe.join(' ');
    noeuds.push(
      <p key={`p-${cle}`} style={PARAGRAPHE}>
        {enLigne(texte, `p-${cle}`)}
      </p>,
    );
    paragraphe = [];
  };

  lignes.forEach((brute, rang) => {
    const ligne = brute.trim();
    const cle = String(rang);

    if (ligne === '') {
      viderParagraphe(cle);
      viderListe(cle);
      return;
    }

    /**
     * LES IMAGES SONT EXTRAITES AVANT TOUT LE RESTE, et le texte qui reste suit son
     * chemin ordinaire. Une ligne qui n'était QUE son image laisse une chaîne vide,
     * donc rien à mettre dans un paragraphe — et c'est le cas que la maquette
     * dessine. Voir `imagesDe`.
     */
    const { texte, images } = imagesDe(ligne);
    if (images.length > 0) {
      viderParagraphe(cle);
      viderListe(cle);
      images.forEach((image, i) => {
        const cleFigure = `fig-${cle}-${String(i)}`;
        noeuds.push(
          <Figure
            key={cleFigure}
            cle={cleFigure}
            image={image}
            planche={planche}
            auteurImage={auteurImage}
          />,
        );
      });
      if (texte === '') return;
    }

    if (texte.startsWith('### ')) {
      viderParagraphe(cle);
      viderListe(cle);
      noeuds.push(
        <h3 key={`h3-${cle}`} style={SOUS_TITRE}>
          {texte.slice(4)}
        </h3>,
      );
      return;
    }
    if (texte.startsWith('## ')) {
      viderParagraphe(cle);
      viderListe(cle);
      noeuds.push(
        <h2 key={`h2-${cle}`} style={TITRE}>
          {texte.slice(3)}
        </h2>,
      );
      return;
    }
    if (texte.startsWith('- ') || texte.startsWith('* ')) {
      viderParagraphe(cle);
      puces.push(texte.slice(2));
      return;
    }
    /** Une liste numérotée garde ses numéros : ce sont des ÉTAPES. */
    const numerotee = /^\d+\.\s+(.*)$/.exec(texte);
    if (numerotee !== null && numerotee[1] !== undefined) {
      viderParagraphe(cle);
      puces.push(numerotee[1]);
      return;
    }
    viderListe(cle);
    paragraphe.push(texte);
  });

  viderParagraphe('fin');
  viderListe('fin');

  /**
   * LA BOÎTE PORTE `position: relative` ET RIEN D'AUTRE.
   *
   * L'infobulle est posée en absolu par rapport à elle — c'est ce que la maquette
   * fait, à ceci près qu'elle l'ancre sur le passage surligné, qui n'existe pas en
   * tant qu'élément ici (voir le relevé de sélection). `display: contents` serait
   * plus discret encore, mais un élément en `contents` ne borne aucun absolu.
   *
   * ⚠ ÉCART MESURÉ : cette boîte ajoute un `<div>` entre l'`<article>` de la
   * planche et le corps. Elle ne porte ni marge, ni remplissage, ni fond, et le
   * corps hérite donc exactement de ce qu'il héritait — vérifié sur les deux
   * planches, aucun décalage.
   */
  return (
    <div
      ref={boite}
      data-guide-corps={planche}
      style={{ position: 'relative' }}
      onMouseUp={relever}
      onKeyUp={relever}
    >
      {noeuds}
      {visee === null || onProposerCorrection === undefined ? null : (
        <button
          type="button"
          data-guide-proposer-passage=""
          onClick={() => {
            onProposerCorrection(visee.passage);
            setVisee(null);
          }}
          style={{ ...INFOBULLE, top: `${String(visee.top)}px`, left: `${String(visee.left)}px` }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
          Proposer une correction sur ce passage
        </button>
      )}
    </div>
  );
}
