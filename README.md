# Vivid Milks

Mobile app for Android and iOS, built with [React Native](https://reactnative.dev) and [Expo](https://expo.dev) from a single TypeScript codebase.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
npx expo start
```

From the Expo dev server you can open the app in:

- **Expo Go** on a physical device (scan the QR code)
- **Android emulator** (press `a`, requires Android Studio)
- **iOS simulator** (press `i`, requires Xcode on macOS)

## Project structure

```
src/
  app/          # Screens and routes (Expo Router, file-based routing)
  components/   # Reusable UI components
  constants/    # Theme and other constants
  hooks/        # Custom React hooks
assets/         # Images, icons, fonts
```

`android/` and `ios/` are not committed. They are generated from `app.json` by `npx expo prebuild` when needed.

## Useful commands

```bash
npx expo install <package>   # Add a dependency (picks SDK-compatible versions)
npm run lint                 # Lint
npx tsc --noEmit             # Type-check
npx expo-doctor              # Diagnose dependency/config issues
```

## Building and releasing

Use [EAS Build](https://docs.expo.dev/build/introduction/) to build signed Android and iOS binaries in the cloud, and [EAS Submit](https://docs.expo.dev/submit/introduction/) to publish them to the Play Store and App Store.
