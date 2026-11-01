import { jwtVerify, SignJWT } from 'jose';

const SESSION_DAYS = 30;

/** Signs and checks the app's own session tokens, issued after a successful sign-in. */
export function sessionTokens(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    async issue(userId: number): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(userId))
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(key);
    },
    /** The user id, or null if the token is invalid or expired. */
    async verify(token: string): Promise<number | null> {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        const id = Number(payload.sub);
        return Number.isInteger(id) && id > 0 ? id : null;
      } catch {
        return null;
      }
    },
  };
}

export type SessionTokens = ReturnType<typeof sessionTokens>;
