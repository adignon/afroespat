import { describe, expect, it } from 'vitest';
import { adresseConnexion, suiteValide } from '../suite-connexion';

describe('suiteValide', () => {
  it('accepte un chemin interne, avec requête et ancre', () => {
    expect(suiteValide('/accueil')).toBe('/accueil');
    expect(suiteValide('/messages/abc?x=1#bas')).toBe('/messages/abc?x=1#bas');
  });

  it('refuse les redirections ouvertes', () => {
    expect(suiteValide('//evil.example')).toBeNull();
    expect(suiteValide('/\\evil.example')).toBeNull();
    expect(suiteValide('https://evil.example')).toBeNull();
    expect(suiteValide('javascript:alert(1)')).toBeNull();
    expect(suiteValide('evil.example')).toBeNull();
    expect(suiteValide('/')).toBeNull();
  });

  it('refuse les caractères de contrôle et les valeurs absentes ou démesurées', () => {
    expect(suiteValide('/a\nb')).toBeNull();
    expect(suiteValide('/a\tb')).toBeNull();
    expect(suiteValide(null)).toBeNull();
    expect(suiteValide(undefined)).toBeNull();
    expect(suiteValide('')).toBeNull();
    expect(suiteValide(`/${'a'.repeat(600)}`)).toBeNull();
  });

  it('refuse les pages d\'accès : on reviendrait en boucle', () => {
    expect(suiteValide('/connexion')).toBeNull();
    expect(suiteValide('/connexion?suite=/accueil')).toBeNull();
    expect(suiteValide('/bienvenue/code')).toBeNull();
    expect(suiteValide('/connexions-amies')).toBe('/connexions-amies');
  });
});

describe('adresseConnexion', () => {
  it('encode la destination', () => {
    expect(adresseConnexion('/messages/1?a=b')).toBe('/connexion?suite=%2Fmessages%2F1%3Fa%3Db');
  });

  it('retombe sur /connexion quand la destination est invalide', () => {
    expect(adresseConnexion('//evil.example')).toBe('/connexion');
    expect(adresseConnexion(null)).toBe('/connexion');
  });
});
