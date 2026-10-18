'use client';

/**
 * AJOUT HORS MAQUETTE — les gestes d'une bulle de message : « Supprimer » sous les
 * miennes, « Signaler » sous celles de l'autre (08 §7.3, `DELETE /messages/:id` et
 * `POST /reports` avec `subjectType: MESSAGE`).
 *
 * La maquette M01 dessine des bulles sans aucun geste. Supprimer un message et en
 * signaler UN précis exigent pourtant un déclencheur par bulle, et c'est ce qu'il
 * ajoute — dans le langage visuel de la ligne qu'il prolonge : le texte de l'heure
 * (`font-size:11px; color:#8A958F`), en boutons nus alignés à côté d'elle. Aucune
 * couleur nouvelle, aucun rouge (un geste destructeur se confirme dans une fenêtre
 * dessinée, il ne se signale pas par une teinte).
 *
 * LA ZONE DE CLIC DÉPASSE LE TEXTE (44 px de haut) SANS GROSSIR LA LIGNE : la marge
 * négative reprend la hauteur ajoutée. Sur 390 px, un texte de 11 px seul serait
 * intouchable.
 */
export function ActionsBulle({
  mine,
  onSupprimer,
  onSignaler,
}: {
  readonly mine: boolean;
  readonly onSupprimer: () => void;
  readonly onSignaler: () => void;
}) {
  const style = {
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontSize: '11px',
    color: '#8A958F',
    textDecoration: 'underline',
    padding: '0 4px',
    minHeight: '44px',
    margin: '-16px 0',
    cursor: 'pointer',
  } as const;
  return mine ? (
    <button type="button" onClick={onSupprimer} data-bulle-supprimer="" style={style}>
      Supprimer
    </button>
  ) : (
    <button type="button" onClick={onSignaler} data-bulle-signaler="" style={style}>
      Signaler
    </button>
  );
}
