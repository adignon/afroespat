import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LES FEUILLES DESSINÉES — chaque nœud vivant de la planche est branché, et la valeur de la
 * maquette a disparu (lot « feuilles dessinées », `tools/adaptations/feuilles-dessinees.mjs`).
 *
 * Le défaut que ce test garde : une planche montée dont l'adaptation a cessé de coller (« adaptation
 * attendue introuvable ») s'afficherait, compilerait, et montrerait « Visa étudiant », « 4 sur 12 »
 * ou « Amina D. » à tous les membres. Le premier sens vérifie que les pièces vivantes y sont, le
 * second que les littéraux de la maquette n'y sont plus.
 */
const RACINE = resolve(__dirname, '..');
const cadre = (fichier: string): string => readFileSync(resolve(RACINE, fichier), 'utf8');

const FEUILLES: ReadonlyArray<{
  readonly fichier: string;
  readonly lit: readonly string[];
  readonly nePlus: readonly string[];
}> = [
  ...(['desktop1', 'mobile1'] as const).map((n) => ({
    fichier: `j03/${n}.generated.tsx`,
    lit: ['<FSlot k="brouillon"', '<FAct k="annuler"', '<FAct k="suivant"', '<FSlot k="alertes"'],
    nePlus: ["Je suis bloqué·e à l'étape Logement", 'garant français', 'onClick={onNext}'],
  })),
  ...(['desktop2', 'mobile2'] as const).map((n) => ({
    fichier: `j03/${n}.generated.tsx`,
    lit: ['<FSlot k="portee"', '<FAct k="retour"', '<FAct k="suivant"'],
    nePlus: ['Publier dans Annonces logement', 'Aïcha, Moussa et Fanta', 'ma parraine'],
  })),
  ...(['desktop3', 'mobile3'] as const).map((n) => ({
    fichier: `j03/${n}.generated.tsx`,
    lit: ['<FVal k="etape"', '<FVal k="titre"', '<FVal k="texte"', '<FVal k="auteur"', '<FAct k="publier"'],
    nePlus: ['Amina D.', "Besoin d'un garant pour un studio à Lyon", 'Étape 7 · Logement', 'Étudiante · Lyon'],
  })),
  ...(['desktop', 'mobile'] as const).map((n) => ({
    fichier: `j04/${n}.generated.tsx`,
    lit: ['<FVal k="compte"', '<FVal k="titreEtape"', '<FSlot k="texte"', '<FAct k="publier"', '<FAct k="plusTard"'],
    // L'icône « photo » est retirée : le jalon se partage en texte seul.
    nePlus: ['4 sur 12', 'Visa étudiant', 'Franchie en 4 semaines', 'M3 4h18v16H3z'],
  })),
  {
    fichier: 'j05invitation/mobileinvitation.generated.tsx',
    lit: ['<FSlot k="pseudo"', '<FSlot k="contacts"', '<FSlot k="role"', '<FVal k="aideRole"'],
    nePlus: ['Sandra M.', 'Yasmine B.', 'Pseudo ou contact</div>'],
  },
  {
    fichier: 'j07export/mobileexport.generated.tsx',
    lit: ['<FAct k="exporter"', '<FAct k="plusTard"'],
    // Le paiement est hors périmètre : plus de carte « Réservé à Premium », et la phrase fausse
    // sur « documents cochés » (l'export ne porte pas la checklist) est corrigée.
    nePlus: ['Découvrir Premium', 'Réservé à Premium', 'documents cochés'],
  },
  {
    fichier: 'j08arret/mobilearret.generated.tsx',
    lit: ['{panneau.titre}', '{parcours.franchies}', '<FAct k="garder"', '<FAct k="arreter"'],
    nePlus: ['Mes études à Lyon', 'Vos 6 étapes'],
  },
  {
    fichier: 'j01mfeuille/mobile.generated.tsx',
    lit: ['<FLien href={`/parcours/${p.id}`}', '<FLien href="/parcours/nouveau"', '{p.titre}', '{total}'],
    nePlus: ['Mes études à Lyon', 'Faire venir ma sœur'],
  },
  {
    fichier: 'x04/mobile.generated.tsx',
    lit: ['<FVal k="titre"', '<FVal k="texte"', '<FAct k="monter"'],
    // « PLAN » (le compteur d'événements, donc le paiement) n'est pas monté.
    nePlus: ['Découvrir Premium', 'événement sur', 'Réinitialisé le', '>Cette action demande une identité vérifiée<', 'Créer un événement'],
  },
];

describe('les feuilles dessinées lisent leurs données et font leurs gestes', () => {
  for (const feuille of FEUILLES) {
    it(`${feuille.fichier} : pièces vivantes présentes, littéraux de maquette absents`, () => {
      const source = cadre(feuille.fichier);
      for (const piece of feuille.lit) {
        expect(source, `${feuille.fichier} doit contenir ${piece}`).toContain(piece);
      }
      for (const litteral of feuille.nePlus) {
        expect(source, `${feuille.fichier} ne doit plus écrire « ${litteral} »`).not.toContain(litteral);
      }
    });
  }

  it('aucune feuille ne garde un « href="#" »', () => {
    for (const feuille of FEUILLES) {
      expect(cadre(feuille.fichier), feuille.fichier).not.toContain('href="#"');
    }
  });
});
