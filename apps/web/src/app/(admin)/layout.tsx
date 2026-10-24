import type { Metadata } from 'next';
import { FournisseurEquipe } from '@/components/admin/session-equipe';
import './admin.css';

/**
 * LE GROUPE DE ROUTES DE L'APPLICATION D'ÉQUIPE.
 *
 * ─── POURQUOI UN GROUPE À PART, ET PAS `(app)` ─────────────────────────────────
 *
 * 15 §2.1, règle dure : « un compte équipe ne peut jamais se connecter à
 * l'application membres avec ses identifiants, ni l'inverse ». Les deux domaines
 * sont hermétiques jusque dans le garde côté API — une route d'équipe porte
 * `@RequiresStaffRole`, jamais `@RequiresCapability`, et le garde refuse toute
 * route qui déclarerait les deux.
 *
 * Une frontière que le serveur tient si strictement ne doit pas être floue côté
 * écran. Trois choses la rendent visible ici :
 *
 *   1. `(admin)` est un groupe de routes DISTINCT de `(app)` : aucune coquille,
 *      aucun rail membre, aucune barre d'onglets n'est partagée. La maquette dit
 *      la même chose — « application séparée, plus dense, tableaux, même palette ·
 *      rail admin, pas de colonne droite ».
 *   2. Ce layout ne fournit RIEN d'autre que des métadonnées. Le jour où une
 *      coquille d'équipe existera (vérification de session, garde de rôle), elle
 *      vivra ici et nulle part ailleurs ; le jour où l'application partira sur son
 *      propre domaine, c'est ce dossier qui déménagera d'un bloc.
 *   3. Les écrans consomment `@/screens/administration/data`, un module qui n'a
 *      aucun lien avec ceux des membres.
 *
 * ─── ÉCART ASSUMÉ AVEC LA SPEC, ET IL EST CONSIGNÉ ─────────────────────────────
 *
 * 15 en-tête écrit « application séparée `apps/admin` sur `admin.afroexpates.com` ».
 * Ce lot est du TRANSCODAGE : il ne crée pas d'application, il pose les seize
 * écrans dans celle qui existe, sous `/admin/*`. Le groupe de routes est le plus
 * proche équivalent à l'intérieur d'un seul build — il isole tout ce qu'un layout
 * peut isoler — mais il ne remplace PAS la séparation de domaine, qui reste à
 * faire : tant que les deux applications partagent un build, elles partagent aussi
 * un bundle et un cookie de domaine. À trancher par le porteur.
 *
 * ─── AUCUNE DE CES PAGES N'EST INDEXABLE ───────────────────────────────────────
 *
 * Le layout racine déclare `robots: { index: true }` pour l'application membres.
 * Une console d'administration n'a rien à faire dans un moteur de recherche, et
 * les métadonnées d'un layout imbriqué remplacent celles du parent.
 */
export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

/**
 * Lot « administration vivante » : le layout n'est plus vide. Il porte maintenant
 * (1) la SESSION d'équipe — `FournisseurEquipe` lit le rôle et renvoie vers
 * `/admin/connexion` sans session — et (2) `admin.css`, qui rend l'application lisible
 * sous 1 024 px, largeur que la maquette ne dessine pas (voir ce fichier).
 */
export default function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <FournisseurEquipe>
      <div data-admin="">{children}</div>
    </FournisseurEquipe>
  );
}
