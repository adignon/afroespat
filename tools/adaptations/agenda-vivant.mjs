/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT E — « AGENDA VIVANT » : E01 À E04, LES GESTES QUE LA MAQUETTE DESSINE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le constat, mesuré sur les cadres générés : l'agenda LISAIT l'API et n'écrivait
 * rien. « Créer un événement » (E01) était un `<button>` sans gestionnaire ; les
 * jours du calendrier, les flèches du mois, les trois pastilles de filtre et les
 * trois choix de RSVP (E02) étaient des `<span>` ; « Je suis là », « Modifier »,
 * « Annuler l'événement », « Signaler » et « Enregistrer » (E04) ne faisaient rien.
 * Le lien « Voir la fiche ville » était un `href="#"`.
 *
 * Appliquées APRÈS les adaptations des autres lots (elles lisent des cadres déjà
 * branchés), et AVANT « l'en-tête global » qui ferme la liste. Chacune est
 * déclarée pour son écran seul ; le journal dira « introuvable » sur le cadre qui
 * ne dessine pas son motif (piège n° 7), pas « inutile ».
 *
 * Règles de ce fichier (voir AMORCAGE §3) : un motif est ancré sur la STRUCTURE
 * (un texte, un tracé d'icône, une prise), jamais sur une mesure ; une coupe
 * COMPTE ses balises (`finElement`) ; aucune couleur n'est inventée.
 */
import { dedoublerStyles, finElement } from './reseau-vivant.mjs';
import { NU, changerBalise, finAccolade, ouvranteAvant } from './outils-lot-e.mjs';

// ─── E01 ─────────────────────────────────────────────────────────────────────

/**
 * ── E01 · LES JOURS DU CALENDRIER ───────────────────────────────────────────
 *
 * Chaque ligne de jour (`<div … background: j.fond, opacity: j.opacite>`) devient
 * un lien vers `/agenda?jour=…` : « jours cliquables » (09 §3.5). Les jours sans
 * événement restent atténués mais cliquables — on peut vouloir voir un jour vide.
 */
const AG_E01_JOURS = {
  screens: ['E01'],
  nom: 'AG_E01_JOURS',
  why: 'Les jours du calendrier vertical étaient des <div> : ils mènent maintenant à /agenda?jour=… (le filtre et le mois se conservent).',
  provides: ['panneau'],
  apply(jsx) {
    const marque = jsx.indexOf('background: j.fond, opacity: j.opacite }}>');
    if (marque === -1) return { jsx, applied: false };
    const debut = ouvranteAvant(jsx, marque, 'div');
    const neuf = changerBalise(
      jsx,
      debut,
      'Link',
      'href={j.href} data-agenda-jour=""',
      'textDecoration: "none", color: "inherit"',
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

/** ── E01 · LES FLÈCHES DU MOIS ──────────────────────────────────────────────── */
const AG_E01_MOIS = {
  screens: ['E01'],
  nom: 'AG_E01_MOIS',
  why: 'Les deux flèches du mois étaient des <span> : elles mènent au mois précédent et suivant (/agenda?mois=…).',
  provides: ['panneau'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [trace, cible, libelle] of [
      ['m15 18-6-6 6-6', 'panneau.precedent', 'Mois précédent'],
      ['m9 18 6-6-6-6', 'panneau.suivant', 'Mois suivant'],
    ]) {
      const at = out.indexOf(`<path d="${trace}" />`);
      if (at === -1) continue;
      const debut = ouvranteAvant(out, at, 'span');
      const neuf = changerBalise(
        out,
        debut,
        'Link',
        `href={${cible}} aria-label="${libelle}" data-agenda-mois=""`,
        'textDecoration: "none"',
      );
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** ── E01 · « CRÉER UN ÉVÉNEMENT » ───────────────────────────────────────────── */
const AG_E01_CREER = {
  screens: ['E01'],
  nom: 'AG_E01_CREER',
  why: 'Le bouton « Créer un événement » du panneau n’avait aucun gestionnaire : il mène à /agenda/nouveau (E03).',
  provides: [],
  apply(jsx) {
    const at = jsx.indexOf('Créer un événement</button>');
    if (at === -1) return { jsx, applied: false };
    const debut = ouvranteAvant(jsx, at, 'button');
    const neuf = changerBalise(
      jsx,
      debut,
      'Link',
      'href="/agenda/nouveau" data-agenda-creer=""',
      'textDecoration: "none", cursor: "pointer"',
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

/**
 * ── E01 · LES TROIS PASTILLES DE FILTRE ─────────────────────────────────────
 *
 * Tous · Mes participations · Mes organisations (« Organisations » à 390 px)
 * deviennent des liens ; leurs couleurs viennent de `filtres` (la pastille active
 * garde le vert dessiné, les autres le blanc au liseré gris).
 */
const AG_E01_FILTRES = {
  screens: ['E01'],
  nom: 'AG_E01_FILTRES',
  why: 'Les pastilles Tous / Mes participations / Mes organisations étaient des <span> fixes : elles filtrent (scope=all|mine|organized) et la pastille active suit la sélection.',
  provides: ['filtres'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [texte, cle] of [
      ['Tous', 'tous'],
      ['Mes participations', 'mes'],
      ['Mes organisations', 'organises'],
      ['Organisations', 'organises'],
    ]) {
      const at = out.indexOf(`>${texte}</span>`);
      if (at === -1) continue;
      const debut = ouvranteAvant(out, at, 'span');
      if (!out.slice(debut, at).includes('borderRadius: "999px"')) continue;
      const neuf = changerBalise(
        out,
        debut,
        'Link',
        `href={filtres.${cle}.href} data-agenda-filtre="${cle}"`,
        `background: filtres.${cle}.bg, color: filtres.${cle}.fg, border: \`1px solid \${filtres.${cle}.bd}\`, textDecoration: "none"`,
      );
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** ── E01 · LA BANDE DE DATES DU TÉLÉPHONE ──────────────────────────────────── */
const AG_E01_BANDE = {
  screens: ['E01'],
  nom: 'AG_E01_BANDE',
  why: 'Les pastilles de la bande de dates (390 px) étaient des <div> : chacune mène à son jour.',
  provides: ['bande'],
  apply(jsx) {
    const marque = jsx.indexOf('opacity: j.opacite }}><span style={{ fontSize: "10px"');
    if (marque === -1) return { jsx, applied: false };
    const debut = ouvranteAvant(jsx, marque, 'div');
    const neuf = changerBalise(
      jsx,
      debut,
      'Link',
      'href={j.href} data-agenda-jour=""',
      'textDecoration: "none"',
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

/** ── E01 · « VOIR LA FICHE VILLE » ──────────────────────────────────────────── */
const AG_E01_VILLE = {
  screens: ['E01'],
  nom: 'AG_E01_VILLE',
  why: '« Voir la fiche ville » était un href="#" : il mène à /villes/:slug de MA ville, et disparaît quand la ville n’a pas de fiche (inactive).',
  provides: ['villeHref'],
  apply(jsx) {
    const m = /<a href="#" style=\{\{ ([^}]*) \}\}>Voir la fiche ville<\/a>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf = `{villeHref ? (<Link href={villeHref} data-agenda-ville="" style={{ ${m[1]} }}>Voir la fiche ville</Link>) : null}`;
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/** ── E01 · LE JOUR SANS ÉVÉNEMENT ──────────────────────────────────────────── */
const AG_E01_VIDE = {
  screens: ['E01'],
  nom: 'AG_E01_VIDE',
  why: 'Un jour sans événement laissait une page muette : il dit « Aucun événement ce jour-là » (selon le filtre).',
  provides: ['nombre', 'videTexte'],
  apply(jsx) {
    const at = jsx.indexOf('{(evenements ?? []).map(');
    if (at === -1) return { jsx, applied: false };
    const fin = finAccolade(jsx, at);
    if (fin === -1) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, fin) +
        '{nombre === 0 ? (<EtatVide texte={videTexte} />) : null}' +
        jsx.slice(fin),
      applied: true,
    };
  },
};

// ─── E02 ─────────────────────────────────────────────────────────────────────

/**
 * ── E02 · LES TROIS CHOIX DE RSVP ───────────────────────────────────────────
 *
 * « Je viens · Peut-être · Je ne viens pas » étaient des `<span>`, « ni
 * cliquables ni atteignables au clavier » (la phrase de la page). Ils deviennent
 * des boutons ; `aria-pressed` dit lequel est retenu. Pas de condition de niveau
 * ni de capacité ici : le serveur répond `WAITLIST` si c'est complet, et
 * `LEVEL_REQUIRED` ouvre la fenêtre de niveau (participer est L2).
 */
const AG_E02_RSVP = {
  screens: ['E02'],
  nom: 'AG_E02_RSVP',
  why: 'Les trois choix de RSVP étaient des <span> : ils envoient PUT /events/:id/rsvp (liste d’attente automatique côté serveur).',
  provides: ['actions', 'choix', 'evenement'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [texte, cle, statut] of [
      ['Je viens', 'vient', 'GOING'],
      ['Peut-être', 'peutEtre', 'MAYBE'],
      ['Je ne viens pas', 'refuse', 'DECLINED'],
    ]) {
      const at = out.indexOf(`>${texte}</span>`);
      if (at === -1) continue;
      const debut = ouvranteAvant(out, at, 'span');
      const neuf = changerBalise(
        out,
        debut,
        'button',
        `type="button" onClick={() => actions.onRsvp("${statut}")} disabled={actions.occupe || evenement.annule !== null} aria-pressed={choix.${cle}.fond === "#16785E"} data-evenement-rsvp="${statut}"`,
        `${NU}, opacity: actions.occupe || evenement.annule !== null ? ".6" : "1"`,
      );
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── E02 · LES CARTES D'ACTION, AUX DEUX LARGEURS ────────────────────────────
 *
 * À 1 440 px, la colonne de droite dessinée (« PENDANT L'ÉVÉNEMENT », « COMPLET »,
 * « VUE ORGANISATEUR », « Signaler ») est remplacée par `ActionsEvenementCartes`,
 * qui en reprend les styles à l'identique ; à 390 px, la planche ne dessine rien
 * de tout cela et le même composant se pose sous la fiche. Voir son en-tête
 * (AJOUT).
 */
const APPEL_CARTES = (mobile) =>
  `<ActionsEvenementCartes evenement={evenement} actions={actions} complet={complet} attente={attente} organisateur={organisateur} presence={presence}${mobile ? ' mobile' : ''} />`;

const AG_E02_CARTES = {
  screens: ['E02'],
  nom: 'AG_E02_CARTES',
  why: 'Je suis là, liste d’attente, annulation, modification, cocher les présents et Signaler : dessinés à 1 440 px sans gestionnaire, absents à 390 px — un seul composant les rend aux deux largeurs.',
  provides: ['actions', 'complet', 'attente', 'organisateur', 'presence', 'evenement'],
  apply(jsx) {
    // Ordinateur : tout l'intérieur du <aside data-zone="droite">.
    // (La zone de mise en page `data-zone="droite"` est posée APRÈS ce lot : on
    // repère donc la colonne par son contenu, pas par son attribut.)
    const titre = jsx.indexOf('PENDANT L’ÉVÉNEMENT');
    const aside = titre === -1 ? -1 : jsx.lastIndexOf('<aside', titre);
    if (aside !== -1) {
      const finOuvrante = jsx.indexOf('>', aside) + 1;
      const finAside = jsx.indexOf('</aside>', finOuvrante);
      if (finAside === -1) return { jsx, applied: false };
      return {
        jsx: jsx.slice(0, finOuvrante) + APPEL_CARTES(false) + jsx.slice(finAside),
        applied: true,
      };
    }
    // Téléphone : sous la fiche, juste avant la barre basse des trois choix.
    const barre = '</div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px"';
    const at = jsx.indexOf(barre);
    if (at === -1) return { jsx, applied: false };
    return {
      jsx: jsx.slice(0, at) + APPEL_CARTES(true) + jsx.slice(at),
      applied: true,
    };
  },
};

/**
 * ── E02 (390 px) · UN « null » ÉCRIT EN TOUTES LETTRES ──────────────────────
 *
 * MESURÉ sur le cadre généré : la ligne de l'organisateur se terminait par
 * `</span></span>null</div>` — le mot « null » était PEINT à l'écran, à droite de
 * « Organisatrice ». Un reste de liaison de la maquette, jamais vu parce que le
 * cadre n'avait pas été regardé à 390 px.
 */
const AG_E02_NULL = {
  screens: ['E02'],
  nom: 'AG_E02_NULL',
  why: 'Le cadre de 390 px peignait le mot « null » à la fin de la ligne de l’organisateur.',
  provides: [],
  apply(jsx) {
    const motif = '</span></span>null</div>';
    if (!jsx.includes(motif)) return { jsx, applied: false };
    return { jsx: jsx.replace(motif, '</span></span></div>'), applied: true };
  },
};

// ─── E03 ─────────────────────────────────────────────────────────────────────

/**
 * ── E03 · MODIFIER AU LIEU DE CRÉER ─────────────────────────────────────────
 *
 * La même planche sert « Modifier » (`?modifier=<id>`) : le titre dit « Modifier
 * l'événement » et le bouton « Enregistrer ». Aucun dessin ne change.
 */
const AG_E03_MODIFICATION = {
  screens: ['E03'],
  nom: 'AG_E03_MODIFICATION',
  why: 'En modification, la planche de création dit « Modifier l’événement » et « Enregistrer ».',
  provides: ['formulaire'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [ancien, neuf] of [
      ['>Créer un événement</h1>', '>{formulaire.modification ? "Modifier l’événement" : "Créer un événement"}</h1>'],
      ['>Publier l’événement</button>', '>{formulaire.modification ? "Enregistrer" : "Publier l’événement"}</button>'],
      ['>Publier</button>', '>{formulaire.modification ? "Enregistrer" : "Publier"}</button>'],
    ]) {
      if (out.includes(ancien)) {
        out = out.replace(ancien, neuf);
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── E04 ─────────────────────────────────────────────────────────────────────

/**
 * ── E04 · LA FEUILLE DE PRÉSENCE ────────────────────────────────────────────
 *
 *   · la boucle lit `presence.lignes` (les cases à jour, la recherche appliquée) ;
 *   · le « Présent·e » de chaque ligne devient un bouton qui coche (organisateur
 *     seulement ; une présence déjà enregistrée est figée) ;
 *   · « Rechercher un inscrit » devient un champ ; à 390 px, que la planche ne
 *     dessine pas, le même champ est posé au-dessus de la liste ;
 *   · « Enregistrer » envoie `POST /events/:id/check-in`.
 */
const AG_E04_FEUILLE = {
  screens: ['E04'],
  nom: 'AG_E04_FEUILLE',
  why: 'Le « Présent·e » de chaque ligne, la recherche et « Enregistrer » n’avaient aucun gestionnaire : la feuille coche, filtre et enregistre.',
  provides: ['presence'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;

    if (out.includes('{(participants ?? []).map(')) {
      out = out.replace('{(participants ?? []).map(', '{(presence.lignes ?? []).map(');
      compte += 1;
    }

    // La case de chaque ligne.
    const marque = '>Présent·e{p.coche ?';
    const at = out.indexOf(marque);
    if (at !== -1) {
      const debut = ouvranteAvant(out, at, 'span');
      const neuf = changerBalise(
        out,
        debut,
        'button',
        'type="button" onClick={() => { if (p.userId !== undefined) presence.onBascule(p.userId); }} disabled={!presence.estOrganisateur || p.userId === undefined || p.figee === true || presence.occupe} aria-pressed={p.coche} aria-label={\`Présent·e : \${p.nom}\`} data-presence-case=""',
        `${NU}, background: "transparent"`,
      );
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }

    // La recherche (1 440 px).
    const rech = /<div style=\{\{ (height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "#8A958F") \}\}>(<svg[\s\S]*?<\/svg>)Rechercher un inscrit<\/div>/.exec(out);
    if (rech !== null) {
      const champ = `<label style={{ ${rech[1]} }}>${rech[2]}<input type="search" value={presence.recherche} onChange={presence.onRecherche} placeholder="Rechercher un inscrit" aria-label="Rechercher un inscrit" data-presence-recherche="" style={{ flex: "1", minWidth: 0, border: "none", background: "transparent", font: "inherit", color: "#16211D", outline: "none" }} /></label>`;
      out = out.slice(0, rech.index) + champ + out.slice(rech.index + rech[0].length);
      compte += 1;
    } else {
      // Téléphone : le même champ, cloné du dessin de l'ordinateur, avant la liste.
      const carte = out.indexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "0 14pxpx"');
      if (carte !== -1) {
        const champ = '<label style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "#8A958F", flexShrink: "0" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4" /></svg><input type="search" value={presence.recherche} onChange={presence.onRecherche} placeholder="Rechercher un inscrit" aria-label="Rechercher un inscrit" data-presence-recherche="" style={{ flex: "1", minWidth: 0, border: "none", background: "transparent", font: "inherit", color: "#16211D", outline: "none" }} /></label>';
        out = out.slice(0, carte) + champ + out.slice(carte);
        compte += 1;
      }
    }

    // « padding: "0 14pxpx" » : une faute de la maquette, un padding invalide.
    if (out.includes('padding: "0 14pxpx"')) {
      out = out.replace('padding: "0 14pxpx"', 'padding: "0 14px"');
      compte += 1;
    }

    // « Enregistrer ».
    const enr = /<button style=\{\{ ([^}]*) \}\}>Enregistrer<\/button>/.exec(out);
    if (enr !== null) {
      const bouton = `<button type="button" onClick={presence.onEnregistrer} disabled={presence.occupe || presence.enAttente === 0} data-presence-enregistrer="" style={{ ${enr[1]}, cursor: "pointer", opacity: presence.occupe || presence.enAttente === 0 ? ".55" : "1" }}>Enregistrer{presence.enAttente > 0 ? \` (\${presence.enAttente})\` : ""}</button>`;
      const retour = '{presence.retour === "" ? null : (<div role="status" data-presence-retour="" style={{ fontSize: "12.5px", fontWeight: "700", color: "#0F5C48" }}>{presence.retour}</div>)}';
      out =
        out.slice(0, enr.index) +
        `{presence.estOrganisateur ? (<>${retour}${bouton}</>) : null}` +
        out.slice(enr.index + enr[0].length);
      compte += 1;
    }

    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_AGENDA_VIVANT = [
  AG_E01_JOURS,
  AG_E01_MOIS,
  AG_E01_CREER,
  AG_E01_FILTRES,
  AG_E01_BANDE,
  AG_E01_VILLE,
  AG_E01_VIDE,
  AG_E02_RSVP,
  AG_E02_CARTES,
  AG_E02_NULL,
  AG_E03_MODIFICATION,
  AG_E04_FEUILLE,
].map((a) => ({
  ...a,
  apply(jsx) {
    const r = a.apply(jsx);
    return r.applied ? { jsx: dedoublerStyles(r.jsx), applied: true } : r;
  },
}));

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_AGENDA_VIVANT = {
  ActionsEvenementCartes: '@/components/actions-evenement',
};
