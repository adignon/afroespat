import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiErrorFilter, isUniqueViolation } from '../error.filter';

function uniqueError(code: string): Error {
  const error = new Error('Unique constraint failed on the fields: (`user_id`)');
  error.name = 'PrismaClientKnownRequestError';
  Object.assign(error, { code });
  return error;
}

function host() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, getHeader: vi.fn() };
  const req = { method: 'POST', url: '/v1/x' };
  const argumentsHost = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, status, json };
}

describe('filtre d’erreurs : violation d’unicité', () => {
  it('reconnaît P2002 et rien d’autre', () => {
    expect(isUniqueViolation(uniqueError('P2002'))).toBe(true);
    expect(isUniqueViolation(uniqueError('P2025'))).toBe(false);
    expect(isUniqueViolation(new Error('autre'))).toBe(false);
  });

  it('répond 409 CONFLICT sans révéler le détail de la contrainte', () => {
    const { argumentsHost, status, json } = host();
    new ApiErrorFilter().catch(uniqueError('P2002'), argumentsHost);
    expect(status).toHaveBeenCalledWith(409);
    const body = JSON.stringify(json.mock.calls[0]?.[0]);
    expect(body).toContain('CONFLICT');
    expect(body).not.toContain('user_id');
  });
});
