import type { z } from 'zod';

/** Thrown from services; Fastify turns `statusCode` into the HTTP status. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = 'Not allowed') => new HttpError(403, message);
export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    throw badRequest(field ? `${field}: ${issue?.message}` : (issue?.message ?? 'Invalid request'));
  }
  return result.data;
}
