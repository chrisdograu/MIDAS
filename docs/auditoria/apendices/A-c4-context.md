# Apêndice A · C4 (Context + Container)

## Contexto (Nível 1)
```text
[Gamer Web] ─┐        ┌─ [Gamer Mobile (Capacitor)]
             ▼        ▼
        ┌────────────────────┐         ┌────────────┐
        │ MIDIAS Platform     │◀──────▶│ Staff Desk │
        │ (Web+PWA+Desktop)   │        │ (Electron) │
        └─────────┬──────────┘         └────┬───────┘
                  ▼                         ▼
        ┌──────────────────────────────────────────┐
        │ Lovable Cloud (Postgres, Auth, Storage,   │
        │ Edge Functions, Realtime)                 │
        └──────────────────────────────────────────┘
```

## Container (Nível 2)
```text
Web SPA (React+Vite)        Mobile (Capacitor)          Desktop Admin (Electron+React)
      │                          │                          │
      └────────── HTTPS/JWT ─────┼──────────────────────────┘
                                 ▼
                     Supabase JS/Dart clients
                                 ▼
          ┌────────────────────────────────────────┐
          │ Postgres (RLS)  ·  Storage buckets     │
          │ Realtime channels  ·  Edge Functions:  │
          │  - manage-employee                     │
          │  - seed-admin-friends                  │
          │  - seed-test-users                     │
          │  - tournament-reminders                │
          └────────────────────────────────────────┘
```

## Notas
Diagramas C3 (Component) e C4 (Code) serão gerados on-demand por módulo — ver ADRs para decisões atômicas.

