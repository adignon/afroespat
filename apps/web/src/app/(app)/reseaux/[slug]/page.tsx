import { ReseauScreen } from './reseau-screen';

/**
 * A08 et ses onglets. `/reseaux/:slug`
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/villes/page.tsx`.
 * `?onglet=` choisit la planche A08T. La vue de l'équipe ne vient plus de
 * l'adresse mais du rôle — voir plus bas.
 *
 * Le `slug` de la route descend jusqu'au client : c'est lui qui identifie le
 * réseau auprès de l'API. La fiche accepte indifféremment un slug ou un
 * identifiant (`load()` normalise), donc on passe ce que l'URL porte.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ readonly slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const onglet = query['onglet'];
  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ L'ADRESSE NUE OUVRE LE FIL, ET ELLE OUVRAIT « SUJETS »                     ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, capture à l'appui : « La page des réseaux doit s'ouvrir par défaut
   * sur le fil d'actualité. »
   *
   * MESURÉ au navigateur avant de toucher quoi que ce soit, sur
   * `/reseaux/pays-bj` sans paramètre : l'onglet actif était « Sujets » — bordure
   * `rgb(22, 120, 94)` et graisse 700 sur « Sujets », bordure transparente et
   * graisse 500 sur « Fil ». Ce n'était donc pas une navigation qui laissait
   * traîner un onglet : c'est ce `'sujets'` qui le décidait, et lui seul.
   *
   * ⚠ CE DÉFAUT NE SE VOYAIT PAS DANS `reseau-screen.tsx`, et c'est pour cela
   * qu'il a duré : ce fichier-là traite déjà « Fil » comme un onglet ordinaire, et
   * son repli (« un onglet inconnu retombe sur Sujets ») reste juste — il parle
   * d'un `?onglet=` ILLISIBLE, pas de son absence. Les deux cas se ressemblent et
   * ne veulent pas dire la même chose : une adresse sans paramètre est une arrivée
   * sur le réseau, un paramètre inconnu est une adresse abîmée.
   *
   * `'sujets'` reste la valeur que `reseau-screen.tsx` emploie pour le CADRE
   * COMPLET de A08 — la maquette dessine son onglet « Sujets » avec le rail — et
   * rien de cela ne change : seule la valeur par DÉFAUT bouge.
   */
  /**
   * ⚠ `?vue=proprietaire` N'EST PLUS LU. Il décidait SEUL des planches de
   * l'équipe — n'importe qui, en le tapant, recevait la vue de gestion. La vue
   * suit maintenant le rôle que la fiche du réseau porte (`myRole`), dans
   * `reseau-screen.tsx`. Les liens qui l'écrivent encore restent valides : le
   * paramètre est ignoré.
   *
   * `?section=` choisit l'entrée du rail de « Gérer » — « Vue d'ensemble »,
   * « Demandes d'adhésion », « Signalements », « Paramètres ».
   */
  const section = query['section'];
  return (
    <ReseauScreen
      slug={slug}
      onglet={typeof onglet === 'string' ? onglet : 'fil'}
      section={
        section === 'demandes' || section === 'signalements' || section === 'parametres'
          ? section
          : 'ensemble'
      }
    />
  );
}
