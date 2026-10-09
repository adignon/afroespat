'use client';

import dynamic from 'next/dynamic';
import { EmojiStyle, Theme } from 'emoji-picker-react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE CLAVIER D'ÉMOJIS — `emoji-picker-react`, EN SECTION SOUS LA BARRE       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La librairie d'emojis utilisée n'est pas bonne hein. Utilise
 * emoji-picker-react et affiche-le en bas. C'est-à-dire quand actif ça crée une
 * section en bas de la section de l'input et image et emoji et se met en bas de
 * ça. »
 *
 * CE QUI PRÉCÉDAIT : une table de soixante-quatre caractères écrite à la main,
 * dans un panneau flottant AU-DESSUS du bouton. Pas de recherche, pas de
 * catégories, pas de tons de peau, et une grille qui débordait sur le fil.
 *
 * ── `dynamic` AVEC `ssr: false`, ET CE N'EST PAS UN CONFORT ───────────────
 *
 * La bibliothèque touche `window` à l'import pour mesurer sa grille. Rendue sur
 * le serveur, elle jette pendant le rendu de la page — et `next build` échoue,
 * pas seulement le navigateur. Chargée dynamiquement, elle n'arrive QUE lorsque
 * le membre ouvre le clavier : c'est aussi ce qui garde la page de messagerie
 * légère pour ceux qui ne s'en servent pas.
 *
 * ── CE QUE LE COMPOSANT NE FAIT PAS ──────────────────────────────────────
 *
 * Il n'insère RIEN lui-même et ne connaît pas son ouverture : le CADRE décide de
 * le monter ou non (`{emojisOuverts ? <ClavierEmojis …/> : null}`), et la page
 * décide où le caractère atterrit — au curseur du champ de conversation
 * aujourd'hui, ailleurs demain. Un composant qui écrirait dans un champ qu'il ne
 * possède pas serait à refaire au premier autre composeur.
 *
 * ── LE DESSIN RESTE CELUI DU DÉPÔT ───────────────────────────────────────
 *
 * La bibliothèque pose ses propres couleurs ; on lui impose la largeur pleine,
 * la hauteur d'un clavier de téléphone (320 px), le trait `#E6EBE9` du dépôt et
 * AUCUNE OMBRE PORTÉE (T1 §2.3 l'interdit, et le garde-fou la mesure).
 *
 * `EmojiStyle.NATIVE` : les émojis du système, et non les images distantes que
 * la bibliothèque sert par défaut. Deux raisons, et la seconde décide — ce sont
 * des caractères, donc rien à charger ; et les images viennent d'un domaine
 * tiers, ce que la politique de sécurité de contenu du dépôt n'autorise pas.
 */
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      style={{
        height: '320px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        color: '#8A958F',
        borderTop: '1px solid #E6EBE9',
      }}
    >
      Chargement des émojis…
    </div>
  ),
});

export function ClavierEmojis({
  onChoisir,
}: {
  readonly onChoisir?: ((emoji: string) => void) | undefined;
}) {
  return (
    <div
      data-panneau-emojis=""
      style={{
        flexShrink: 0,
        borderTop: '1px solid #E6EBE9',
        background: '#fff',
        /**
         * La hauteur d'un clavier de téléphone. Fixe, et c'est voulu : une
         * hauteur en pourcentage ferait sauter la liste des messages d'une
         * ouverture à l'autre selon la taille de la fenêtre.
         */
        height: '320px',
      }}
    >
      <Picker
        onEmojiClick={(choix) => {
          onChoisir?.(choix.emoji);
        }}
        emojiStyle={EmojiStyle.NATIVE}
        theme={Theme.LIGHT}
        width="100%"
        height={320}
        /** La barre de prévisualisation mange 60 px pour redire ce qu'on survole. */
        previewConfig={{ showPreview: false }}
        lazyLoadEmojis
        searchPlaceHolder="Rechercher un émoji"
      />
    </div>
  );
}
