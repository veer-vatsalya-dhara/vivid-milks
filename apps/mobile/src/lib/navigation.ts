import { router } from 'expo-router';

/** Closes the current screen. Opened directly (e.g. a refreshed web page), there's no history, so go to the start screen. */
export function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Returns to the bottom tabs, closing any screens on top. */
export function closeAllScreens() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}
