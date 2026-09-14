// Edge Function: seed-test-users
// Cria 4 usuários de teste no auth.users e popula tabelas com dados de exemplo
// Idempotente: pode ser chamada várias vezes sem duplicar
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ALLOWED_ORIGINS = [
  'https://midias-midas.lovable.app',
  'https://id-preview--c1cfbae2-5609-422d-b6ab-69f5e8880b6d.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
];

function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const TEST_USERS = [
  { email: 'cliente1@teste.com', display_name: 'João Cliente',  bio: 'Comprador frequente, fã de RPGs.', phone: '11999990001' },
  { email: 'cliente2@teste.com', display_name: 'Marina Vendedora', bio: 'Vendo meus jogos usados aqui no marketplace.', phone: '11999990002' },
  { email: 'cliente3@teste.com', display_name: 'Pedro Avaliador', bio: 'Adoro escrever reviews de jogos.', phone: '11999990003' },
  { email: 'banido@teste.com', display_name: 'Usuário Banido', bio: 'Conta usada para testar o banimento.', phone: '11999990004' },
];

// Senha aleatória por execução — nunca hardcoded, nunca logada.
function generatePassword(): string {
  return crypto.randomUUID().replace(/-/g, '') + 'A@1';
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: 'Apenas admins podem popular dados' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 1) Criar/recuperar os 4 usuários — busca a lista UMA vez, fora do loop
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const userIds: Record<string, string> = {};
    const createdCredentials: Array<{ email: string; password: string }> = [];
    for (const u of TEST_USERS) {
      const existing = list?.users?.find(x => x.email === u.email);
      let uid: string;
      if (existing) {
        uid = existing.id;
      } else {
        const pwd = generatePassword();
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: pwd,
          email_confirm: true,
          user_metadata: { display_name: u.display_name },
        });
        if (cErr || !created.user) throw new Error(`Falha ao criar ${u.email}: ${cErr?.message}`);
        uid = created.user.id;
        createdCredentials.push({ email: u.email, password: pwd });
      }
      userIds[u.email] = uid;
      await admin.from('profiles').update({
        display_name: u.display_name,
        bio: u.bio,
        phone: u.phone,
        is_private: false,
      }).eq('id', uid);
    }

    // Banir o usuário banido
    const banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('profiles').update({ banned_until: banUntil }).eq('id', userIds['banido@teste.com']);

    const c1 = userIds['cliente1@teste.com'];
    const c2 = userIds['cliente2@teste.com'];
    const c3 = userIds['cliente3@teste.com'];

    // 2) Buscar produtos para referenciar
    const { data: produtos } = await admin.from('produtos').select('id, title').limit(6);
    const prodIds = (produtos ?? []).map(p => p.id);

    // 3) Anúncios marketplace (idempotente por title+seller)
    const anunciosSeed = [
      { seller_id: c2, user_id: c2, title: 'God of War Ragnarok PS5 - Lacrado', description: 'Mídia física, lacrado de fábrica.', ad_type: 'venda', category: 'jogo_fisico', condition: 'novo', price: 250, plataformas: ['PS5'], certificate_type: 'sem_certificado' },
      { seller_id: c2, user_id: c2, title: 'Conta Steam com 50 jogos', description: 'Conta com biblioteca grande, vendo por motivos pessoais.', ad_type: 'venda', category: 'conta', condition: 'usado', price: 450, plataformas: ['PC'], certificate_type: 'protegido' },
      { seller_id: c1, user_id: c1, title: 'Troco FIFA 24 por EA Sports FC 25', description: 'Quero trocar meu FIFA 24 PS5 pelo FC 25.', ad_type: 'troca', category: 'jogo_fisico', condition: 'usado', price: 0, plataformas: ['PS5'], desired_item: 'EA Sports FC 25 PS5', certificate_type: 'sem_certificado' },
      { seller_id: c3, user_id: c3, title: 'Elden Ring Xbox - Mídia Física', description: 'Pouco uso, na caixa.', ad_type: 'venda', category: 'jogo_fisico', condition: 'usado', price: 180, plataformas: ['Xbox Series X'], certificate_type: 'protegido' },
      { seller_id: c2, user_id: c2, title: 'Nintendo Switch OLED + 3 jogos', description: 'Console em ótimo estado com Mario, Zelda e Smash.', ad_type: 'venda', category: 'console', condition: 'usado', price: 2200, plataformas: ['Nintendo Switch'], certificate_type: 'protegido' },
      { seller_id: c1, user_id: c1, title: 'Hogwarts Legacy PS4', description: 'Comprei e não joguei, lacrado.', ad_type: 'venda', category: 'jogo_fisico', condition: 'novo', price: 199, plataformas: ['PS4'], certificate_type: 'sem_certificado' },
    ];
    const anuncioIds: string[] = [];
    for (const a of anunciosSeed) {
      const { data: existing } = await admin.from('anuncios').select('id').eq('seller_id', a.seller_id).eq('title', a.title).maybeSingle();
      if (existing) { anuncioIds.push(existing.id); continue; }
      const { data: ins } = await admin.from('anuncios').insert(a).select('id').single();
      if (ins) anuncioIds.push(ins.id);
    }

    // 4) Fórum: posts e respostas
    if (prodIds.length >= 2) {
      const forumSeed = [
        { product_id: prodIds[0], user_id: c1, content: 'Esse jogo é incrível! Alguém mais zerou no modo difícil?' },
        { product_id: prodIds[0], user_id: c3, content: 'Zerei mês passado, recomendo demais.' },
        { product_id: prodIds[1], user_id: c2, content: 'Vale a pena no preço atual?' },
        { product_id: prodIds[1], user_id: c1, content: 'Com o desconto vale muito!' },
      ];
      for (const p of forumSeed) {
        const { data: existing } = await admin.from('forum_posts').select('id').eq('user_id', p.user_id).eq('content', p.content).maybeSingle();
        if (existing) continue;
        const { data: post } = await admin.from('forum_posts').insert(p).select('id').single();
        if (post) {
          await admin.from('forum_replies').insert({ post_id: post.id, user_id: c3, content: 'Concordo totalmente!' });
        }
      }
    }

    // 5) Denúncias pendentes
    if (anuncioIds.length > 0) {
      const denunciasSeed = [
        { reporter_id: c1, target_type: 'anuncio', target_id: anuncioIds[1], reason: 'preco_abusivo', description: 'Preço muito acima do mercado, parece golpe.' },
        { reporter_id: c3, target_type: 'usuario', target_id: c2, reason: 'comportamento_inadequado', description: 'Usuário foi rude no chat.' },
        { reporter_id: c2, target_type: 'usuario', target_id: c1, reason: 'spam', description: 'Está enviando muitas mensagens repetidas.' },
      ];
      for (const d of denunciasSeed) {
        const { data: existing } = await admin.from('denuncias').select('id').eq('reporter_id', d.reporter_id).eq('target_id', d.target_id).maybeSingle();
        if (!existing) await admin.from('denuncias').insert(d);
      }
    }

    // 6) Certificados (1 pendente, 1 ativo)
    const certSeed = [
      { user_id: c2, status: 'pendente' as const, reason: 'Quero proteger minhas vendas no marketplace.' },
      { user_id: c3, status: 'ativo' as const, reason: 'Aprovado após análise.', expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), reviewed_at: new Date().toISOString(), reviewed_by: user.id },
    ];
    for (const c of certSeed) {
      const { data: existing } = await admin.from('certificados').select('id').eq('user_id', c.user_id).eq('status', c.status).maybeSingle();
      if (!existing) await admin.from('certificados').insert(c);
    }

    // 7) Favoritos
    if (prodIds.length >= 3) {
      const favSeed = [
        { user_id: c1, product_id: prodIds[0] },
        { user_id: c1, product_id: prodIds[1] },
        { user_id: c2, product_id: prodIds[2] },
        { user_id: c3, product_id: prodIds[0] },
        { user_id: c3, product_id: prodIds[2] },
      ];
      for (const f of favSeed) {
        const { data: existing } = await admin.from('favoritos').select('id').eq('user_id', f.user_id).eq('product_id', f.product_id).maybeSingle();
        if (!existing) await admin.from('favoritos').insert(f);
      }
    }

    // 8) Mensagens entre c1 e c2 (sobre anúncio)
    if (anuncioIds.length > 0) {
      const msgSeed = [
        { sender_id: c1, receiver_id: c2, anuncio_id: anuncioIds[0], content: 'Olá! Esse jogo ainda está disponível?' },
        { sender_id: c2, receiver_id: c1, anuncio_id: anuncioIds[0], content: 'Sim! Tem interesse?' },
        { sender_id: c1, receiver_id: c2, anuncio_id: anuncioIds[0], content: 'Aceita 220 reais?' },
      ];
      for (const m of msgSeed) {
        const { data: existing } = await admin.from('mensagens').select('id').eq('sender_id', m.sender_id).eq('content', m.content).maybeSingle();
        if (!existing) await admin.from('mensagens').insert(m);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Dados de teste criados com sucesso',
      users: Object.fromEntries(Object.entries(userIds).map(([email, id]) => [email, { id }])),
      // Credenciais só das contas criadas nesta execução. Anote agora — não vamos devolver de novo.
      new_credentials: createdCredentials,
      counts: { anuncios: anuncioIds.length },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('seed-test-users error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
