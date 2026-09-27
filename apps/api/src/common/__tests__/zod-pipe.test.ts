import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from '../zod.pipe';

/**
 * Le tuyau de validation — 00-fondations.md §4 et §5.2.
 *
 * Ce test existe à cause d'un défaut trouvé au `curl` en livrant l'annuaire
 * professionnel : le refus du mot « certifié », écrit dans un `.refine()`,
 * arrivait au membre sous la forme « Certaines informations sont incomplètes ou
 * mal remplies ». Le refus qui a le plus besoin d'être expliqué était le seul à
 * ne rien expliquer, et le membre ne pouvait que tâtonner.
 */
describe('tuyau de validation zod (§4)', () => {
  const meta = { type: 'body' as const };

  it('transmet le message d’un `.refine()`', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        nom: z.string().refine((v) => !/certifi/i.test(v), {
          message: 'Le mot « certifié » ne peut pas figurer ici.',
        }),
      }),
    );

    try {
      pipe.transform({ nom: 'Cabinet certifié' }, meta);
      expect.unreachable('le refus aurait dû lever');
    } catch (error) {
      const body = (error as { getResponse: () => { error: { details: { fields: unknown[] } } } })
        .getResponse();
      const field = body.error.details.fields[0] as { code: string; message?: string };
      // `custom` ne dit RIEN par lui-même : c'est le code de tout `.refine()`.
      expect(field.code).toBe('CUSTOM');
      expect(field.message).toBe('Le mot « certifié » ne peut pas figurer ici.');
    }
  });

  it('n’attache PAS le message des codes intégrés', () => {
    const pipe = new ZodValidationPipe(z.object({ age: z.number().min(18) }));

    try {
      pipe.transform({ age: 12 }, meta);
      expect.unreachable('le refus aurait dû lever');
    } catch (error) {
      const body = (error as { getResponse: () => { error: { details: { fields: unknown[] } } } })
        .getResponse();
      const field = body.error.details.fields[0] as { code: string; message?: string };
      expect(field.code).toBe('TOO_SMALL');
      // Le message de zod est en ANGLAIS et généré : le front a le code, qui lui
      // suffit à écrire sa propre phrase en français (§5.2).
      expect(field.message).toBeUndefined();
    }
  });

  it('rend le chemin du champ fautif', () => {
    const pipe = new ZodValidationPipe(
      z.object({ profil: z.object({ bio: z.string().max(3) }) }),
    );

    try {
      pipe.transform({ profil: { bio: 'beaucoup trop long' } }, meta);
      expect.unreachable('le refus aurait dû lever');
    } catch (error) {
      const body = (error as { getResponse: () => { error: { details: { fields: unknown[] } } } })
        .getResponse();
      // Sans le chemin, un formulaire ne sait pas quel champ signaler.
      expect((body.error.details.fields[0] as { path: string }).path).toBe('profil.bio');
    }
  });

  it('laisse passer une valeur valide, transformée', () => {
    const pipe = new ZodValidationPipe(z.object({ n: z.coerce.number() }));
    // Deux paramètres de type, et non un : un schéma qui transforme a un type
    // d'entrée différent de son type de sortie.
    expect(pipe.transform({ n: '42' }, meta)).toEqual({ n: 42 });
  });
});
