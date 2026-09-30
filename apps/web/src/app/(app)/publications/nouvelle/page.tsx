import { ScreenFrames } from '@/screens/frames';
import { A01NMobile } from '@/screens/a01n/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A01N — « Nouvelle publication », le composeur en plein écran. MOBILE SEUL.
 *
 * Second cadre de 390 px de la section A01S de `docs/template/03 Accueil v2.dc.html`,
 * manqué par les lots précédents : la déclaration des modales ne prenait que
 * l'occurrence 0 (la fenêtre « Créer un sondage »), et rien ne disait qu'il y en
 * avait une seconde.
 *
 * ── POURQUOI CETTE ROUTE, ET PAS `?composeur=` SUR `/accueil` ────────────────
 *
 * L'état par paramètre d'URL — le motif de `?paiement=` sur `/compte/abonnement` —
 * suppose une page SERVEUR qui lit `searchParams` et les passe à un composant
 * client. `(app)/accueil/page.tsx` est un composant CLIENT de bout en bout : y lire
 * l'URL demanderait `useSearchParams()`, et la page du fil arriverait alors VIDE au
 * premier rendu. C'est exactement le défaut que le commentaire de K06 décrit, et il
 * vaut pour la page la plus visitée du produit.
 *
 * Cet écran a d'ailleurs cessé d'être un « état » : c'est une PAGE à part entière,
 * avec son propre titre (« Nouvelle publication ») et son propre en-tête à croix. Il
 * prend donc la forme que ce dépôt donne déjà à ses six autres écrans de création —
 * `/stories/nouvelle`, `/guides/nouveau`, `/reseaux/nouveau`, `/agenda/nouveau`,
 * `/parcours/nouveau`, `/entraide/nouveau`. Le nom n'est pas inventé : c'est la
 * convention du dépôt appliquée au segment que `/publications/[id]` occupe déjà.
 *
 * ── CE CADRE N'A AUCUN PENDANT D'ORDINATEUR ─────────────────────────────────
 *
 * Et ce n'est pas un manque du transcodage : côté web, la maquette ne dessine le
 * composeur rempli que dans une COLONNE DE DOCUMENTATION de 760 px, avec ses
 * légendes « COMPOSANTS » et « ÉTAT VIDE ». La transcoder mettrait ces légendes dans
 * l'application. Voir la note de la déclaration dans `tools/screens/03-accueil.mjs`.
 *
 * La maquette fait loi : elle a décidé que cet écran est mobile. `ScreenFrames` rend
 * donc un cadre unique, borné à ses 390 px et centré — le miroir de O05, qui n'a pas
 * de cadre mobile et dont le cadre unique sert aux deux largeurs.
 */
export default function NouvellePublicationPage() {
  return <ScreenFrames screen="A01N" mobile={<A01NMobile {...accueilData()} />} />;
}
