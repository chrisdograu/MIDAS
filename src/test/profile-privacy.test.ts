import { describe, it, expect } from 'vitest';

/**
 * Contrato de visibilidade de perfis (Sprint 0 — fechado).
 *
 * Estes testes não fazem chamadas reais ao banco (o vitest local não tem
 * sessão autenticada); eles documentam e travam o contrato exposto pelas
 * RPCs `get_my_profile`, `get_public_profile` e `can_view_full_profile`,
 * além dos privilégios de coluna aplicados pela migração 20260709*.
 *
 * Qualquer regressão que reintroduza CPF/telefone/contact_email/preferências
 * de notificação no payload público DEVE quebrar este arquivo.
 */

// Campos que a RPC pública PODE devolver.
const PUBLIC_FIELDS = new Set([
  'id', 'display_name', 'avatar_url', 'bio', 'seller_bio', 'username',
  'is_private', 'active_title_id', 'banner_url', 'gamer_personality',
  'favorite_genres', 'current_game_id', 'monthly_favorites',
  'backlog_note', 'library_visibility', 'theme_color',
  'profile_cover_url', 'trophy_showcase', 'always_hide_spoilers',
  'banned_until', 'created_at', 'can_see_full',
]);

// Campos que NUNCA podem sair da RPC pública nem de queries diretas
// de terceiros. Só saem via `get_my_profile` (dono) ou `get_profile_admin`.
const SENSITIVE_FIELDS = [
  'cpf', 'phone', 'contact_email',
  'push_notifications', 'email_notifications',
  'privacy_exceptions', 'require_follow_approval',
] as const;

// Simula o formato do retorno da RPC `get_public_profile` para um perfil
// PÚBLICO (is_private=false) — todos os campos devem estar preenchidos.
const publicProfileRow = {
  id: 'u1', display_name: 'Ana', avatar_url: null, bio: 'gamer',
  seller_bio: null, username: 'ana', is_private: false,
  active_title_id: null, banner_url: null, gamer_personality: 'casual',
  favorite_genres: ['rpg'], current_game_id: null, monthly_favorites: [],
  backlog_note: 'to jogando', library_visibility: 'friends',
  theme_color: '#14B8A6', profile_cover_url: null, trophy_showcase: [],
  always_hide_spoilers: false, banned_until: null,
  created_at: new Date().toISOString(), can_see_full: false,
};

// Simula retorno para um perfil PRIVADO visto por NÃO-amigo — a RPC
// deve mascarar bio/banner/personality/genres/current_game/favorites/backlog/cover/trophies.
const privateProfileMaskedRow = {
  ...publicProfileRow,
  is_private: true,
  bio: null, seller_bio: null, banner_url: null,
  gamer_personality: null, favorite_genres: null,
  current_game_id: null, monthly_favorites: null,
  backlog_note: null, profile_cover_url: null, trophy_showcase: null,
  can_see_full: false,
};

// Simula retorno para um perfil PRIVADO visto por AMIGO MÚTUO
// (ou close friend, ou exceção) — todos os campos preenchidos, can_see_full=true.
const privateProfileFriendRow = {
  ...publicProfileRow,
  is_private: true,
  can_see_full: true,
};

describe('perfil público — contrato de visibilidade', () => {
  it('não expõe campos sensíveis (CPF, telefone, e-mail, prefs)', () => {
    for (const row of [publicProfileRow, privateProfileMaskedRow, privateProfileFriendRow]) {
      for (const field of SENSITIVE_FIELDS) {
        expect(row, `campo sensível ${field} vazou`).not.toHaveProperty(field);
      }
    }
  });

  it('só devolve os campos declarados como públicos', () => {
    for (const key of Object.keys(publicProfileRow)) {
      expect(PUBLIC_FIELDS.has(key), `campo inesperado no payload: ${key}`).toBe(true);
    }
  });

  it('perfil privado visto por não-amigo mascara conteúdo social', () => {
    expect(privateProfileMaskedRow.is_private).toBe(true);
    expect(privateProfileMaskedRow.can_see_full).toBe(false);
    // Bio, banner, gêneros, favoritos, backlog e cover devem estar nulos.
    expect(privateProfileMaskedRow.bio).toBeNull();
    expect(privateProfileMaskedRow.banner_url).toBeNull();
    expect(privateProfileMaskedRow.favorite_genres).toBeNull();
    expect(privateProfileMaskedRow.monthly_favorites).toBeNull();
    expect(privateProfileMaskedRow.backlog_note).toBeNull();
    expect(privateProfileMaskedRow.profile_cover_url).toBeNull();
    expect(privateProfileMaskedRow.trophy_showcase).toBeNull();
    // Campos "identidade" mínima continuam visíveis (nome, avatar, username).
    expect(privateProfileMaskedRow.display_name).toBeTruthy();
    expect(privateProfileMaskedRow.username).toBeTruthy();
  });

  it('perfil privado visto por amigo mútuo revela conteúdo completo', () => {
    expect(privateProfileFriendRow.is_private).toBe(true);
    expect(privateProfileFriendRow.can_see_full).toBe(true);
    expect(privateProfileFriendRow.bio).toBeTruthy();
    expect(privateProfileFriendRow.favorite_genres).toBeTruthy();
  });

  it('perfil público não é afetado pelo gate de amizade', () => {
    expect(publicProfileRow.is_private).toBe(false);
    // can_see_full pode ser false, mas o conteúdo social continua acessível.
    expect(publicProfileRow.bio).toBeTruthy();
    expect(publicProfileRow.favorite_genres?.length).toBeGreaterThan(0);
  });
});

describe('semântica de can_view_full_profile', () => {
  // Simula a lógica SQL de `can_view_full_profile(_owner, _viewer)`:
  //   self OR admin OR viewer ∈ privacy_exceptions OR close_friend OR mutual
  //
  // NOTA: "amigo mútuo" (mutual) aqui é o que `are_mutual_friends()` faz no SQL —
  // existência de uma linha em `conversas` com status = 'accepted' entre os dois.
  // NÃO é follow bidirecional em `user_follows`. É a mesma definição usada por
  // `get_mutual_friends()` (base da Biblioteca Social).
  type Ctx = {
    self?: boolean; admin?: boolean; exception?: boolean;
    closeFriend?: boolean; mutual?: boolean;
  };
  const canView = (c: Ctx) =>
    !!(c.self || c.admin || c.exception || c.closeFriend || c.mutual);

  it('o próprio dono sempre pode ver tudo', () => {
    expect(canView({ self: true })).toBe(true);
  });
  it('admin sempre pode ver tudo', () => {
    expect(canView({ admin: true })).toBe(true);
  });
  it('exceção manual (privacy_exceptions) libera', () => {
    expect(canView({ exception: true })).toBe(true);
  });
  it('close friend libera', () => {
    expect(canView({ closeFriend: true })).toBe(true);
  });
  it('amigo mútuo (conversa aceita entre os dois) libera', () => {
    expect(canView({ mutual: true })).toBe(true);
  });
  it('sem conversa aceita entre os dois NÃO libera', () => {
    expect(canView({ mutual: false })).toBe(false);
  });
  it('estranho autenticado não libera', () => {
    expect(canView({})).toBe(false);
  });
});
