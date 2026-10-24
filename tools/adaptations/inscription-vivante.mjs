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
 *   · la coche de la carte du réseau n'apparaît que si le membre l'a rejoint ;
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

    // La coche de la carte du réseau n'affirme « rejoint » que si c'est vrai.
    const coche = out.indexOf('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"');
    const finCoche = coche < 0 ? -1 : finElement(out, coche);
    if (finCoche < 0) return { jsx, applied: false };
    out = out.slice(0, coche) + '{lieu.rejoint ? (' + out.slice(coche, finCoche) + ') : null}' + out.slice(finCoche);

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

/**
 * ── O05 À 390 PX : LE CADRE DE 520 PX DÉBORDAIT ─────────────────────────────────
 *
 * Mesuré au navigateur (W1A, phase 0.1) : la maquette ne dessine O05 qu'en 700 px,
 * « sans bascule au seuil de 1024 px » (voir `fin-screen.tsx`). Sa colonne est fixée
 * à `width: 520px` avec 40 px de retrait : à 390 px elle sortait de l'écran par la
 * droite (le titre, la carte du réseau et « Aller à l'accueil » coupés), sur les DEUX
 * variantes. La colonne devient `width: 100%` plafonnée à 520 px ; le retrait
 * de 40 px de la coque, lui, reste celui de la maquette (la colonne fait donc 310 px
 * à 390 px). À 1 440 px rien ne bouge : la colonne reste centrée à 520 px.
 */
const O05_LARGEUR = {
  screens: ['O05'],
  nom: 'O05_LARGEUR_MOBILE',
  why: 'La colonne de 520 px de O05 devient fluide (plafonnée à 520 px) : elle débordait à 390 px.',
  provides: [],
  apply(jsx) {
    // Variante sans parcours : `width, margin` ; variante avec parcours : `width` seule.
    const colonnes = [
      ['width: "520px", margin: "48px auto 0"', 'width: "100%", maxWidth: "520px", margin: "48px auto 0"'],
      ['<div style={{ width: "520px" }}>', '<div style={{ width: "100%", maxWidth: "520px" }}>'],
    ];
        const trouvee = colonnes.find(([avant]) => jsx.includes(avant));
    if (trouvee === undefined) return { jsx, applied: false };
    // La coque (fond, retrait de 40 px) n'est pas encore posée à cet instant :
    // `keepFrameStyle` la rend APRÈS les adaptations (mesuré). Son retrait de 40 px
    // reste donc celui de la maquette, et la colonne fait 310 px à 390 px.
    return { jsx: jsx.replace(trouvee[0], () => trouvee[1]), applied: true };
  },
};

export const ADAPTATIONS_INSCRIPTION_VIVANTE = [O05_SANS_PARCOURS, O05_LARGEUR];
