import { describe, expect, it } from 'vitest';
import { contactsFiltres, sansAccent } from './from-api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FILTRE DE CONTACTS DE LA FENÊTRE « PARTAGER »                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ces cas existent parce que le chemin NE PEUT PAS être mesuré au navigateur : la
 * colonne « contacts en ligne » est calculée par `GET /feed/sidebar` sur
 * `last_seen_at < 10 min`, et elle est mise en cache cinq minutes par ville. Un
 * contact créé pour un test n'y apparaît jamais à temps.
 *
 * CE QUI SE CASSERAIT SANS EUX, et qui ne se verrait pas : le rang. La sélection
 * est une liste d'INDEX dans la liste complète, et l'envoi relit `online[rang]`.
 * Un filtre qui renumérote de zéro ferait partir le lien à quelqu'un d'autre que
 * celui qu'on a coché — sans aucune erreur, sans aucun signe à l'écran.
 */
describe('le filtre de « Rechercher un contact »', () => {
  const contacts = [
    { name: 'Awa Konaté' },
    { name: 'Bintou Camara' },
    { name: 'Amina Ndiayé' },
    { name: 'Kofi Boateng' },
  ];

  it('rend tout le monde, avec son rang, quand la barre est vide', () => {
    expect(contactsFiltres(contacts, '').map((c) => c.rang)).toEqual([0, 1, 2, 3]);
  });

  it('ignore les espaces de bordure : « " awa " » cherche « awa »', () => {
    expect(contactsFiltres(contacts, '  awa  ').map((c) => c.contact.name)).toEqual(['Awa Konaté']);
  });

  it('GARDE LE RANG D’ORIGINE — c’est lui que l’envoi relit', () => {
    // Les quatre noms portent un « a » : ce relevé-là ne prouve donc RIEN sur les
    // rangs, puisque [0, 1, 2, 3] sort aussi d'une renumérotation. Il est ici pour
    // dire que le filtre ne perd personne, et c'est le relevé suivant qui tranche.
    expect(contactsFiltres(contacts, 'a').map((c) => c.rang)).toEqual([0, 1, 2, 3]);
    // CELUI-CI TRANCHE : un seul survivant, et son rang est 1. Une renumérotation
    // dirait 0, et le lien partirait à Awa.
    const tardifs = contactsFiltres(contacts, 'camara');
    expect(tardifs).toHaveLength(1);
    expect(tardifs[0]?.rang, 'Bintou est au rang 1, pas au rang 0').toBe(1);
  });

  it('ignore la casse ET les accents, dans les deux sens', () => {
    expect(contactsFiltres(contacts, 'NDIAYE').map((c) => c.contact.name)).toEqual(['Amina Ndiayé']);
    expect(contactsFiltres(contacts, 'ndiayé').map((c) => c.contact.name)).toEqual(['Amina Ndiayé']);
    expect(contactsFiltres(contacts, 'konate').map((c) => c.contact.name)).toEqual(['Awa Konaté']);
  });

  it('rend une liste vide quand rien ne correspond — jamais la liste entière', () => {
    expect(contactsFiltres(contacts, 'zzzz')).toEqual([]);
  });

  it('sansAccent dépouille sans rien perdre d’autre', () => {
    expect(sansAccent('Amina Ndiayé')).toBe('amina ndiaye');
    expect(sansAccent('Côte d’Ivoire')).toBe('cote d’ivoire');
    expect(sansAccent('')).toBe('');
  });
});
