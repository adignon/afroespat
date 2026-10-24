/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ W1A · PHASE 0.1 — O05 « SANS PARCOURS » : LES DERNIERS GESTES ET LES DONNÉES ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré (audit) : sur la variante « sans parcours » du dernier écran de
 * l'inscription, « Aller à l'accueil » ne faisait rien (un `<button>` sans geste),
 * « Demander » non plus, et tout le reste était la démonstration de la maquette :
 * « Bienvenue à Lyon », « Lyon et Rhône · 1 400 membres », trois événements lyonnais
 * et la marraine « Aïcha Diop ». Un membre inscrit à Évry lisait cela.
 *
 * Ce que cette adaptation fait, sur le seul cadre qui dessine « PROCHAINS
 * ÉVÉNEMENTS » (`SansParcours`) :
 *
 *   · la ville, le réseau et son effectif viennent de `lieu` (`atterrissage.ts`) ;
 *   · les événements restent la boucle de la maquette, nourrie par `events` — et une
 *     ligne dit qu'il n'y en a aucun quand la ville n'en annonce pas, au lieu d'un
 *     cadre vide ;
 *   · la carte du parrain suggéré n'existe que s'il y en a un (`lieu.parrain`) :
 *     une suggestion inventée est pire que pas de suggestion ;
 *   · « Demander » mène à la fiche du parrain (`onDemander`), où la demande réelle
 *     se rédige (message de 50 à 1 000 caractères, niveau L1 expliqué par la fenêtre
 *     de niveau si besoin). On n'envoie PAS de message écrit à la place du membre ;
 *   · « Aller à l'accueil » appelle `onAccueil`, qui vérifie la session puis ouvre
 *     `/accueil`.
 *
 * Aucune couleur, aucun rayon, aucune taille nouvelle : la ligne « aucun
 * événement » reprend le gris et le corps des sous-titres des lignes voisines.
 */
import { finElement } from './reseau-vivant.mjs';

const CARTE_PARRAIN_DEBUT = '<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px", display: "flex", alignItems: "center", gap: "12px" }}><span style={{ width: "46px"';

const O05_SANS_PARCOURS = {
  screens: ['O05'],
  nom: 'O05_SANS_PARCOURS_VIVANT',
  why: 'La variante « sans parcours » lit la ville, le réseau, les événements et le parrain suggéré de l’API, et ses deux boutons font quelque chose.',
  provides: ['lieu', 'onAccueil', 'onDemander'],
  apply(jsx) {
    // Seul le cadre qui dessine les événements est concerné (l'autre variante, non).
    if (!jsx.includes('PROCHAINS ÉVÉNEMENTS')) return { jsx, applied: false };
    let out = jsx;

    const remplacer = (avant, apres) => {
      if (!out.includes(avant)) return false;
      out = out.replace(avant, () => apres);
      return true;
    };

    let tout = true;
    tout = remplacer('>Bienvenue à Lyon</h1>', '>Bienvenue{lieu.ville === "" ? "" : ` à ${lieu.ville}`}</h1>') && tout;
    tout = remplacer('>LY</span>', '>{lieu.initiales}</span>') && tout;
    tout = remplacer('>Lyon et Rhône</span>', '>{lieu.reseau}</span>') && tout;
    tout = remplacer('>1 400 membres · vous avez rejoint ce réseau</span>', '>{lieu.membres}</span>') && tout;

    // Aucun événement : une ligne, avec le style des sous-titres de la carte.
    const finBoucle = out.indexOf('))}', out.indexOf('(events ?? []).map('));
    if (finBoucle < 0) return { jsx, applied: false };
    out =
      out.slice(0, finBoucle + 3) +
      '\n{(events ?? []).length === 0 ? (<div style={{ fontSize: "13px", color: "#8A958F", marginTop: "12px" }}>Aucun événement annoncé dans votre ville pour le moment.</div>) : null}' +
      out.slice(finBoucle + 3);

    // La carte du parrain : conditionnelle, et « Demander » branché.
    const marque = out.indexOf(CARTE_PARRAIN_DEBUT);
    if (marque < 0) return { jsx, applied: false };
    const fin = finElement(out, marque);
    if (fin < 0) return { jsx, applied: false };
    let carte = out.slice(marque, fin);
    const dans = (avant, apres) => {
      if (!carte.includes(avant)) {
        tout = false;
        return;
      }
      carte = carte.replace(avant, () => apres);
    };
    dans('>AD</span>', '>{lieu.parrain.initiales}</span>');
    dans('>Aïcha Diop<svg', '>{lieu.parrain.nom}<svg');
    dans('>Parraine suggérée · installée · Lyon 7e</span>', '>{lieu.parrain.detail}</span>');
    dans('<button style={{', '<button type="button" onClick={onDemander} style={{');
    out = out.slice(0, marque) + '{lieu.parrain === null ? null : (' + carte + ')}' + out.slice(fin);

    // « Aller à l'accueil » : le grand bouton plein.
    tout = remplacer('<button style={{ width: "100%", height: "52px"', '<button type="button" onClick={onAccueil} style={{ width: "100%", height: "52px"') && tout;

    return tout ? { jsx: out, applied: true } : { jsx, applied: false };
  },
};

export const ADAPTATIONS_INSCRIPTION_VIVANTE = [O05_SANS_PARCOURS];
