import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { GoogleButtonProps } from './google-button';

/** The parts of Google Identity Services (https://developers.google.com/identity/gsi/web) used here. */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let scriptLoad: Promise<GoogleIdentityServices> | null = null;

function loadGoogleScript(): Promise<GoogleIdentityServices> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in did not load')));
    script.onerror = () => {
      scriptLoad = null;
      reject(new Error('Could not load Google sign-in. Check your connection.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/** Google's own "Continue with Google" button; calls `onIdToken` with the signed-in account's ID token. */
export function GoogleButton({ clientId, onIdToken, onError }: GoogleButtonProps) {
  const container = useRef<React.ComponentRef<typeof View>>(null);
  // Keep the latest callbacks without re-rendering Google's button.
  const handlers = useRef({ onIdToken, onError });
  useEffect(() => {
    handlers.current = { onIdToken, onError };
  }, [onIdToken, onError]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then((google) => {
        const element = container.current as unknown as HTMLElement | null;
        if (cancelled || !element) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handlers.current.onIdToken(response.credential),
        });
        google.accounts.id.renderButton(element, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 300,
        });
      })
      .catch((error: Error) => handlers.current.onError(error.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <View ref={container} style={{ alignItems: 'center', minHeight: 44 }} />;
}
