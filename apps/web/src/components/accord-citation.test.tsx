import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccordCitation } from './accord-citation';

/**
 * « Autoriser la citation » (15 §5.3) : la case n'apparaît qu'une fois l'accord LU sur le serveur.
 * Au premier rendu elle ne montre rien — jamais une case cochée ou décochée « par défaut » qui laisserait
 * croire à un accord que le serveur ne détient pas.
 */
describe('AccordCitation', () => {
  it('ne rend rien tant que l’accord n’a pas été lu', () => {
    expect(renderToStaticMarkup(<AccordCitation guideId="01a16c8a-18c3-7000-aad3-753dd99c54f8" />)).toBe('');
  });
});
