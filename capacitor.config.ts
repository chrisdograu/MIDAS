import type { CapacitorConfig } from '@capacitor/cli';

// Rodada 18 — empacotamento nativo do app Mobile (Capacitor).
// Passos: npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
//         npx cap add android && npx cap add ios
//         npm run build && npx cap sync
const config: CapacitorConfig = {
  appId: 'com.midias.app',
  appName: 'MIDIAS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
