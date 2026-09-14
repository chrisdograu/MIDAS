// Rodada 23 · item 8 — URL de retorno de e-mail (confirmação / reset) precisa
// ser um endereço público de verdade. Em app nativo (Capacitor) ou no Electron,
// `window.location.origin` é `capacitor://` / `file://` e o link do e-mail quebra.
export const PUBLIC_SITE_URL = "https://midias-midas.lovable.app";

export function isNativeShell() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean }; process?: { versions?: { electron?: string } } };
  if (w.Capacitor?.isNativePlatform?.()) return true;
  if (w.process?.versions?.electron) return true;
  return !/^https?:$/.test(window.location.protocol);
}

/** Base segura para `emailRedirectTo` / `redirectTo` do Supabase Auth. */
export function authRedirectBase() {
  if (typeof window === "undefined") return PUBLIC_SITE_URL;
  return isNativeShell() ? PUBLIC_SITE_URL : window.location.origin;
}
