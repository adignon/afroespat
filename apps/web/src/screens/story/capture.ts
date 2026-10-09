'use client';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA STORY, CAPTURÉE EN IMAGE POUR ACCOMPAGNER LE MESSAGE                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « quand on envoie un message dans le contexte d'une story, il
 * faudrait que la story soit capturée comme une image et ajoutée au message juste
 * un peu sous le message ».
 *
 * MESURÉ avant : écrire à l'auteur envoyait un texte NU. Le destinataire recevait
 * « Votre conseil m'a beaucoup aidée » sans savoir DE QUELLE story on parle — et
 * une story vit vingt-quatre heures : le lendemain, la question est sans réponse
 * possible, même pour son auteur.
 *
 * ── POURQUOI UN CANVAS, ET PAS UNE BIBLIOTHÈQUE DE CAPTURE ────────────────
 *
 * `html2canvas` et ses cousines rendent le DOM en réimplémentant une partie du
 * moteur de rendu : elles pèsent une cinquantaine de kilo-octets, se trompent sur
 * les dégradés, les polices et les ombres, et ajouteraient une dépendance à un
 * projet qui n'en a aucune pour le dessin. Ce qu'il faut capturer ici n'est pas
 * une page quelconque : c'est UNE carte dont le dépôt connaît déjà toutes les
 * valeurs — fond, pastille, nom, sous-ligne, texte, ligne d'état. On les peint.
 *
 * ── CE QUE LA CAPTURE N'EST PAS ───────────────────────────────────────────
 *
 * Ce n'est pas une copie au pixel de l'écran de lecture : les boutons de vote, la
 * barre de progression et le champ de message n'y sont pas, parce qu'une image ne
 * se vote pas. C'est la carte, et la carte est ce que la story EST. L'écart est
 * assumé et il est nommé ici plutôt que découvert.
 *
 * ── LE DESSIN REPREND LES VALEURS DE LA PLANCHE ───────────────────────────
 *
 * Aucune couleur n'est choisie : `bg`, `avBg`, `pill`, `pillFg` viennent de la
 * story, et le blanc du texte, le `rgba(255,255,255,.72)` de la sous-ligne et le
 * `rgba(255,255,255,.55)` de la ligne d'état sont ceux que A13 dessine. Rien n'est
 * assombri.
 */

/** Les valeurs de la story qui comptent sur une image. Toutes viennent de A13. */
export interface StoryACapturer {
  readonly bg: string;
  readonly avBg: string;
  readonly i: string;
  readonly name: string;
  readonly sub: string;
  readonly label: string;
  readonly pill: string;
  readonly pillFg: string;
  readonly text: string;
  readonly state: string;
  /** `/media/<clé>` de l'image de fond, déjà absolue. `null` s'il n'y en a pas. */
  readonly imageUrl: string | null;
}

/**
 * 1080 × 1920 : les proportions d'une story, à une densité qui reste lisible
 * agrandie dans une conversation. Le PNG qui en sort pèse quelques dizaines de
 * kilo-octets — très en dessous du plafond d'image du module média.
 */
const LARGEUR = 1080;
const HAUTEUR = 1920;

/**
 * L'IMAGE DE FOND EST RÉCUPÉRÉE EN OCTETS, PAS POSÉE DANS UN `<img>`.
 *
 * Un `<img src="http://localhost:3001/media/…">` dessiné dans un canvas le SOUILLE
 * (`tainted`) dès que l'origine diffère, et `toBlob` lève alors une
 * `SecurityError` : la capture échouerait précisément sur les stories qui ont une
 * photo. `crossOrigin="anonymous"` marcherait SI l'API répondait les bons en-têtes
 * à une requête sans identification — ce qui dépend de sa configuration CORS et
 * changerait sans qu'on le voie.
 *
 * `fetch` puis `createImageBitmap` sur le `Blob` évite la question : les octets
 * sont déjà chez nous, l'image est locale, le canvas reste propre.
 *
 * ET SI ELLE NE VIENT PAS, LA CAPTURE CONTINUE. Une image absente donne une carte
 * de couleur, qui est ce que la story montre quand elle n'a pas de photo. Perdre le
 * message entier parce qu'un fond n'a pas chargé serait disproportionné.
 */
async function imageDeFond(url: string): Promise<ImageBitmap | null> {
  try {
    const reponse = await fetch(url, { credentials: 'omit' });
    if (!reponse.ok) return null;
    return await createImageBitmap(await reponse.blob());
  } catch {
    return null;
  }
}

/** Le texte, coupé en lignes qui tiennent dans la largeur. */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const sorties: string[] = [];
  for (const paragraphe of texte.split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(/\s+/)) {
      const essai = ligne === '' ? mot : `${ligne} ${mot}`;
      if (ctx.measureText(essai).width > largeur && ligne !== '') {
        sorties.push(ligne);
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    sorties.push(ligne);
  }
  return sorties;
}

/** Un rectangle à coins arrondis — `roundRect` n'existe pas partout. */
function carteArrondie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  l: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/**
 * La story, en PNG. `null` si le navigateur ne sait pas peindre — il n'y a alors
 * rien à joindre, et le message part seul.
 */
export async function capturerStory(vue: StoryACapturer): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  // ── LE FOND : la couleur de l'auteur, jamais assombrie (T1 §1.2) ────────
  ctx.fillStyle = vue.bg;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  if (vue.imageUrl !== null) {
    const image = await imageDeFond(vue.imageUrl);
    if (image !== null) {
      /**
       * « COUVRIR », comme `photoFondFor(url, false)` le fait en CSS : l'image
       * remplit le cadre et déborde sur un côté, au lieu d'être déformée. C'est le
       * même choix que l'écran de lecture, et le même que le composeur.
       */
      const echelle = Math.max(LARGEUR / image.width, HAUTEUR / image.height);
      const l = image.width * echelle;
      const h = image.height * echelle;
      ctx.drawImage(image, (LARGEUR - l) / 2, (HAUTEUR - h) / 2, l, h);
      image.close();
      /**
       * UN VOILE SOUS LE TEXTE, et seulement là. Sans lui, un texte blanc sur une
       * photo claire est illisible — c'est le défaut que l'écran de lecture évite
       * avec son dégradé « assombrir le bas ». On reprend la même idée sur le bas
       * de l'image, là où le texte se trouve.
       */
      const voile = ctx.createLinearGradient(0, HAUTEUR * 0.35, 0, HAUTEUR);
      voile.addColorStop(0, 'rgba(0,0,0,0)');
      voile.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = voile;
      ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    }
  }

  const marge = 84;
  const interne = LARGEUR - marge * 2;

  // ── L'AUTEUR : son rond d'initiales, son nom, sa sous-ligne ─────────────
  const rayon = 56;
  ctx.fillStyle = vue.avBg;
  ctx.beginPath();
  ctx.arc(marge + rayon, marge + rayon, rayon, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(vue.i, marge + rayon, marge + rayon + 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 42px system-ui, sans-serif';
  ctx.fillText(vue.name, marge + rayon * 2 + 28, marge + 48);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillText(vue.sub, marge + rayon * 2 + 28, marge + 96);

  // ── LA PASTILLE DE TYPE : « Conseil », « Découverte », « Information » ──
  ctx.font = '700 30px system-ui, sans-serif';
  const largeurMot = ctx.measureText(vue.label).width;
  const hautPastille = marge + rayon * 2 + 56;
  ctx.fillStyle = vue.pill;
  carteArrondie(ctx, marge, hautPastille, largeurMot + 56, 62, 31);
  ctx.fill();
  ctx.fillStyle = vue.pillFg;
  ctx.fillText(vue.label, marge + 28, hautPastille + 41);

  // ── LE TEXTE DE LA STORY — ce qu'elle dit ───────────────────────────────
  ctx.fillStyle = '#fff';
  ctx.font = '700 58px system-ui, sans-serif';
  const corps = lignes(ctx, vue.text, interne);
  /**
   * LE TEXTE EST CENTRÉ VERTICALEMENT, comme la carte de lecture le pose, et il
   * est BORNÉ : une story fait 280 caractères au plus (§2.6), mais une suite de
   * mots longs peut déborder. Au-delà de douze lignes on coupe avec une ellipse —
   * la story reste lisible, et ce qui manque est visible en l'ouvrant.
   */
  const maxLignes = 12;
  const montrees = corps.slice(0, maxLignes);
  if (corps.length > maxLignes) {
    montrees[maxLignes - 1] = `${(montrees[maxLignes - 1] ?? '').slice(0, -1)}…`;
  }
  const interligne = 76;
  let y = HAUTEUR / 2 - ((montrees.length - 1) * interligne) / 2;
  for (const ligne of montrees) {
    ctx.fillText(ligne, marge, y);
    y += interligne;
  }

  // ── LA LIGNE D'ÉTAT, composée par le serveur ────────────────────────────
  if (vue.state !== '') {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '400 30px system-ui, sans-serif';
    for (const ligne of lignes(ctx, vue.state, interne).slice(0, 2)) {
      ctx.fillText(ligne, marge, HAUTEUR - marge - 8);
    }
  }

  return new Promise<Blob | null>((resoudre) => {
    canvas.toBlob((blob) => resoudre(blob), 'image/png');
  });
}
