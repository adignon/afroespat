/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT VIDE D'UNE SECTION — DANS LA CARTE, À LA PLACE DE LA LISTE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Si vide il faut aussi afficher un message pour toutes les
 * sections. »
 *
 * ── POURQUOI DANS LE CADRE, ET NON PLUS EN BANDE SOUS LA PAGE ─────────────
 *
 * `reseau-screen.tsx` posait déjà des bandes `role="status"` « Aucune
 * publication dans ce réseau », « Aucun membre à afficher »… — HORS du cadre,
 * en frère du fragment. MESURÉ au navigateur, fenêtre de 1 440 px : la bande du
 * fil vide tombait à y = 1 009, sous le rail et la colonne de droite, c'est-à-dire
 * en bas de la fenêtre et loin de la carte vide qu'elle commentait. Le lecteur
 * voyait une carte blanche muette.
 *
 * La phrase est donc posée là où la liste aurait été, par les adaptations des
 * cadres. Ses mesures sont celles des bandes qu'elle remplace — le gris
 * `#5D6B66` et les 13 px —, et rien d'autre n'est dessiné : ni icône, ni cadre,
 * puisque la maquette ne dessine aucun état vide pour ces listes.
 */
export function EtatVide({
  texte,
  compact = false,
}: {
  readonly texte: string;
  readonly compact?: boolean;
}) {
  return (
    <p
      role="status"
      data-etat-vide=""
      style={{
        margin: compact ? '10px 0 0' : '0',
        padding: compact ? '0' : '18px 12px',
        color: '#5D6B66',
        fontSize: compact ? '12.5px' : '13px',
        lineHeight: 1.5,
        textAlign: compact ? 'left' : 'center',
      }}
    >
      {texte}
    </p>
  );
}
