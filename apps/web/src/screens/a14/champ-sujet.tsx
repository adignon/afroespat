'use client';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « AUTRE » OUVRE UN CHAMP — LE SEUL SUJET QUE LE MEMBRE ÉCRIT LUI-MÊME      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Au niveau du sujet, Autre doit permettre de saisir dans un champ. »
 *
 * Les huit autres pastilles sont des valeurs de référentiel (`STORY_SUBJECTS`) ;
 * « Autre » n'en est pas une, c'est un AVEU qu'aucune ne convient. Tant qu'elle ne
 * portait pas de texte, elle rangeait la story dans un tiroir sans étiquette : ni
 * le fil, ni la recherche, ni un lecteur ne pouvaient savoir de quoi elle parlait.
 *
 * ── CE QUE LE TEXTE DEVIENT ────────────────────────────────────────────────
 *
 * Il part dans `categoryOther`, une colonne AJOUTÉE pour lui
 * (`20261004120000_story_category_other`), à côté de `category` qui reste
 * `'AUTRE'`. Les deux ne se remplacent pas : l'énumération classe, le texte dit.
 * Écrire le texte DANS `category` aurait fait d'une phrase de membre une valeur
 * de référentiel, et le classement du fil s'y serait perdu.
 *
 * ── D'OÙ VIENT SA BOÎTE ────────────────────────────────────────────────────
 *
 * De la BARRE DE RECHERCHE du même panneau, que la maquette dessine juste
 * au-dessus (`03 Accueil v2.dc.html`, section A14) : `height:44px;
 * border-radius:999px;background:#F2F5F4;padding:0 16px;font-size:13.5px`. C'est
 * le seul champ de texte que cette planche dessine, et il appartient à ce
 * panneau-ci — le champ hérite donc de sa forme, sans qu'on en invente une.
 *
 * L'encre est `#16211D` et l'invite garde le gris `#8A958F` par
 * `[data-saisie-sur-gris]::placeholder` : c'est la correction qui vient d'être
 * faite sur la barre de recherche, et pour la même raison — un champ dont la
 * saisie sort en gris d'invite a l'air vide quand il ne l'est pas.
 *
 * ── LE SEUL TEXTE QUI N'EST SUR AUCUNE PLANCHE ─────────────────────────────
 *
 * « Précisez le sujet ». Aucune maquette ne dessine ce champ, donc aucune ne lui
 * donne d'invite, et un champ nu qui apparaît sous les pastilles ne dit pas ce
 * qu'il attend. REMONTÉ au porteur comme les autres textes d'interface non
 * dessinés.
 */
export function ChampSujetLibre({
  visible,
  valeur,
  onChange,
}: {
  /** Vrai seulement quand « Autre » est la pastille retenue. */
  readonly visible: boolean;
  readonly valeur: string;
  readonly onChange: (texte: string) => void;
}) {
  /**
   * Rien n'est rendu quand « Autre » n'est pas retenu : un champ masqué en CSS
   * resterait dans l'ordre de tabulation et partirait dans la charge, alors que
   * le schéma refuse `categoryOther` sans `category === 'AUTRE'`.
   */
  if (!visible) return null;

  return (
    <ChampDuPanneau
      valeur={valeur}
      onChange={onChange}
      maxLength={60}
      invite="Précisez le sujet"
      repere="data-sujet-libre"
    />
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE LIEU D'UNE DÉCOUVERTE — SANS LUI, ELLE EST REFUSÉE                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, sur le refus rencontré en publiant : « Ceci est lié à quoi "Ce type
 * de story demande un rattachement que vous n'avez pas indiqué" ? Qu'est-ce qui
 * manque ? »
 *
 * MESURÉ depuis le composeur, les trois types à la suite : un conseil part (201),
 * une information part (201), une DÉCOUVERTE est refusée en `422`, motif
 * `DECOUVERTE_NEEDS_PLACE`. §2.6 demande à une découverte « Ville + catégorie +
 * `place_label` », et la planche ne dessine aucun champ pour ce dernier : une
 * découverte était donc IMPOSSIBLE à publier depuis l'écran.
 *
 * Le champ prend la place du sujet libre, et les deux ne se rencontrent jamais :
 * une découverte a pour catégorie `LIEU`, `PRODUIT` ou `SORTIE`, jamais `AUTRE`.
 *
 * ── LE TEXTE N'EST SUR AUCUNE PLANCHE ──────────────────────────────────────
 *
 * « Où ? Le lieu, l'adresse ou le marché » — l'invite est écrite ici faute d'une
 * maquette qui la donne, et REMONTÉE au porteur comme les autres textes
 * d'interface inventés. Elle dit ce que §2.6 attend : « Découverte : lieu ».
 */
export function ChampLieu({
  visible,
  valeur,
  onChange,
}: {
  /** Vrai seulement pour une DÉCOUVERTE, le seul type qui l'exige. */
  readonly visible: boolean;
  readonly valeur: string;
  readonly onChange: (texte: string) => void;
}) {
  if (!visible) return null;

  return (
    <ChampDuPanneau
      valeur={valeur}
      onChange={onChange}
      /** 120 : la borne de `placeLabel` dans `createStorySchema`, pas un nombre choisi ici. */
      maxLength={120}
      invite="Où ? Le lieu, l’adresse ou le marché"
      repere="data-lieu"
    />
  );
}

/**
 * LA BOÎTE, ÉCRITE UNE FOIS. Les deux champs de ce panneau ont la même forme —
 * celle de sa barre de recherche — et la recopier en ferait deux formes qui
 * divergeraient au premier ajustement.
 */
function ChampDuPanneau({
  valeur,
  onChange,
  maxLength,
  invite,
  repere,
}: {
  readonly valeur: string;
  readonly onChange: (texte: string) => void;
  readonly maxLength: number;
  readonly invite: string;
  readonly repere: 'data-sujet-libre' | 'data-lieu';
}) {
  return (
    <input
      type="text"
      value={valeur}
      onChange={(event) => onChange(event.target.value)}
      maxLength={maxLength}
      placeholder={invite}
      aria-label={invite}
      data-saisie-sur-gris=""
      {...{ [repere]: '' }}
      style={{
        height: '44px',
        borderRadius: '999px',
        background: '#F2F5F4',
        padding: '0 16px',
        /**
         * `fontFamily` et NON `font`. La barre de recherche écrit `font: inherit`
         * parce que son CONTENANT porte déjà la taille ; ici il n'y a pas de
         * contenant, et `font` est un raccourci qui REMETTRAIT la taille à celle
         * du document — la ligne `fontSize` au-dessus serait écrasée en silence.
         */
        fontFamily: 'inherit',
        fontSize: '13.5px',
        color: '#16211D',
        border: 'none',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        // Le panneau est une colonne flex : sans ça, la hauteur dessinée s'écrase.
        flexShrink: 0,
      }}
    />
  );
}
