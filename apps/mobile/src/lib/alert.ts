import { Alert, Platform } from 'react-native';

/** `Alert.alert` does nothing on web, so fall back to the browser dialog there. */
export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
