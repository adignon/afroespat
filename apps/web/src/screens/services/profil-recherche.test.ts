import { describe, expect, it } from 'vitest';
import { JOB_SEEKER_LIMITS, jobSeekerProfileSchema } from '@app/shared';
import { sousTitreOffres } from './navigation';
import { ajouterEntree, brouillon, refusDuBrouillon } from './profil-recherche';

describe('le brouillon du profil de recherche suit le schéma PARTAGÉ (10 §3.2)', () => {
  it('un brouillon valide passe le schéma que le serveur applique', () => {
    const corps = brouillon('Assistante RH · alternance', ['RH'], ['CDI'], true);
    expect(jobSeekerProfileSchema.safeParse(corps).success).toBe(true);
    // Aucun champ de CV : §3.2, « aucun CV stocké en V1 ».
    expect(Object.keys(corps).sort()).toEqual(['contractTypes', 'headline', 'isVisible', 'sectors']);
  });

  it('refuse un titre trop court ou trop long, avec la borne importée', () => {
    expect(refusDuBrouillon('abc', [], [])).toContain(String(JOB_SEEKER_LIMITS.headlineMin));
    expect(refusDuBrouillon('x'.repeat(JOB_SEEKER_LIMITS.headlineMax + 1), [], [])).toContain(
      String(JOB_SEEKER_LIMITS.headlineMax),
    );
    expect(refusDuBrouillon('  abc  ', [], [])).not.toBe('');
    expect(refusDuBrouillon('Assistante RH', [], [])).toBe('');
  });

  it('les entrées libres : coupées, sans doublon (casse ignorée), bornées', () => {
    const a = ajouterEntree([], '  Comptabilité ');
    expect(a).toEqual({ liste: ['Comptabilité'], ajoutee: true });
    // Doublon, casse comprise.
    expect(ajouterEntree(a.liste, 'comptabilité').ajoutee).toBe(false);
    // Trop courte / trop longue.
    expect(ajouterEntree([], 'a').ajoutee).toBe(false);
    expect(ajouterEntree([], 'x'.repeat(JOB_SEEKER_LIMITS.itemMax + 1)).ajoutee).toBe(false);
    // Dix au plus.
    const pleine = Array.from({ length: JOB_SEEKER_LIMITS.listMax }, (_, i) => `Secteur ${i}`);
    expect(ajouterEntree(pleine, 'Onzième').ajoutee).toBe(false);
    expect(ajouterEntree(pleine.slice(1), 'Onzième').ajoutee).toBe(true);
  });
});

describe('le sous-titre de S04 dit le total réel (GET /jobs → meta.total)', () => {
  it('ne nomme plus aucune ville', () => {
    expect(sousTitreOffres(0)).toBe('Aucune offre en ligne pour le moment');
    expect(sousTitreOffres(1)).toBe('1 offre en ligne');
    expect(sousTitreOffres(8)).toBe('8 offres en ligne');
    for (const n of [0, 1, 8]) expect(sousTitreOffres(n)).not.toContain('Lyon');
  });
});
