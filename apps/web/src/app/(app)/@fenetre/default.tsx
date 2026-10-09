/**
 * LE CRÉNEAU DE FENÊTRE, VIDE PAR DÉFAUT.
 *
 * Next exige un `default` pour tout créneau parallèle : c'est ce qu'il rend quand
 * l'URL courante n'est interceptée par aucune route du créneau — c'est-à-dire
 * partout sauf sur une story. Sans ce fichier, une navigation vers une page
 * ordinaire rendrait un 404 pour le créneau.
 */
export default function PasDeFenetre() {
  return null;
}
