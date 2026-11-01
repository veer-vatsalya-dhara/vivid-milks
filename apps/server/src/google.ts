import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Verifies a Google ID token's signature, issuer, expiry and audience (our client IDs). */
export function googleVerifier(clientIds: string[]): GoogleVerifier {
  return async (idToken) => {
    const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientIds,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new Error('Google token is missing the account id or email');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email.split('@')[0]!,
    };
  };
}
