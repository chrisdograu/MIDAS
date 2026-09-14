# Empacotamento — Mobile (Capacitor) e Backoffice (Electron)

O código é um só (React + Vite). O que muda é o invólucro.

## Mobile — Capacitor

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android      # e/ou: npx cap add ios (precisa de macOS + Xcode)
npm run build
npx cap sync
npx cap open android
```

- Configuração em `capacitor.config.ts` (`appId: com.midias.app`, `webDir: dist`).
- O app abre na raiz e o `MobileLayout` já roteia para `/m/...`.
- Sem internet, o app **abre mesmo assim**: o cache do React Query é restaurado
  do armazenamento local (`src/lib/queryPersist.ts`) e ações feitas offline
  entram na fila (`src/lib/offlineQueue.ts`), reenviadas quando a rede volta.
- Compras e pagamentos são bloqueados offline de propósito (`RequiresConnection`).

## Backoffice — Electron

```bash
npm i -D electron electron-builder
npm run build
npx electron electron/main.cjs          # roda o backoffice empacotado
npx electron-builder --config electron/builder.json   # gera instalador
```

- `electron/main.cjs` abre direto em `/desktop`, sem `nodeIntegration`, com
  `contextIsolation` e `sandbox` ligados. Links externos abrem no navegador.
- Para apontar para o servidor de desenvolvimento: `MIDIAS_DEV_URL=http://localhost:8080 npx electron electron/main.cjs`.

## Checklist de release

1. `npm run build` sem erros.
2. Testar offline: desligar rede, abrir o app, navegar, favoritar (deve entrar na fila), religar rede e confirmar o reenvio.
3. Conferir que o Backoffice **não** abre rotas de loja e que rotas por cargo continuam bloqueadas.
