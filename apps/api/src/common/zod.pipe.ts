import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { ApiError } from './api-error';

/**
 * Validation par zod — 00-fondations.md §4.
 *
 * « Les schémas de validation vivent dans packages/shared et sont la SOURCE
 * UNIQUE : types inférés, validation API, validation formulaires. »
 *
 * D'où l'absence de class-validator : deux bibliothèques de validation, ce sont
 * deux définitions de la même règle, qui finissent par diverger. Le schéma zod
 * qui valide ce corps de requête est le même que celui du formulaire React.
 *
 * Les erreurs sortent au format attendu par T4 §3 :
 * `400 VALIDATION_FAILED` avec `details.fields: [{ path, code }]`.
 */
/**
 * Deux paramètres de type, et non un seul : un schéma qui transforme — coercion
 * d'un nombre, `"true"` vers un booléen, date ISO vers `Date` — a un type
 * d'entrée différent de son type de sortie. Les confondre interdit justement les
 * schémas qui servent le plus dans une query string.
 */
@Injectable()
export class ZodValidationPipe<Output, Input = unknown>
  implements PipeTransform<unknown, Output>
{
  constructor(private readonly schema: ZodType<Output, ZodTypeDef, Input>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): Output {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw ApiError.validation(
          error.issues.map((issue) => ({
            path: issue.path.join('.'),
            // Le code zod est stable et exploitable par le front ; le message,
            // lui, reste en français côté interface (§5.2).
            code: issue.code.toUpperCase(),
          })),
        );
      }
      throw error;
    }
  }
}

/** Sucre : `@Query(zodPipe(schema))`. */
export function zodPipe<Output, Input>(
  schema: ZodType<Output, ZodTypeDef, Input>,
): ZodValidationPipe<Output, Input> {
  return new ZodValidationPipe(schema);
}
