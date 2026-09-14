// Edge Function: seed-admin-friends
// Cria 6 amigos artificiais para a conta admin master (admin2@midias.com)
// e popula biblioteca, torneios, conversas, opiniões, screenshots, certificados.
// IDEMPOTENTE — pode ser chamada várias vezes.
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

const ADMIN_EMAIL = 'admin2@midias.com';

// Senha aleatória gerada por execução (nunca hardcoded).
function generatePassword(): string {
  return crypto.randomUUID().replace(/-/g, '') + 'A@1';
}

const FRIENDS = [
  { email: 'amigo.gamer@midias.test',    display_name: '🎮 Léo Gamer',       bio: 'Platinei 80+ jogos. RPGs e Souls são minha vida.',     persona: 'gamer' },
  { email: 'amigo.vendedor@midias.test', display_name: '🛒 Bia Vendedora',   bio: 'Vendo jogos físicos e contas. Certificada na MIDIAS.', persona: 'seller' },
  { email: 'amigo.comprador@midias.test',display_name: '💰 Caio Comprador',  bio: 'Caçador de promoções. Sempre buscando trades justas.', persona: 'buyer' },
  { email: 'amigo.torneio@midias.test',  display_name: '🏆 Duda Pro',        bio: 'Competitiva. FGC e Smash em primeiro lugar.',          persona: 'tournament' },
  { email: 'amigo.reviewer@midias.test', display_name: '⭐ Edu Reviewer',     bio: 'Escrevo análises sinceras. Sem hype, sem trollagem.',  persona: 'reviewer' },
  { email: 'amigo.streamer@midias.test', display_name: '📺 Fê Streamer',     bio: 'Compartilho clips e screenshots dos meus runs.',       persona: 'streamer' },
];

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
    if (userErr || !user) return json({ error: 'Não autenticado' }, 401, corsHeaders);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Apenas admins' }, 403, corsHeaders);

    // 1) Localizar admin master
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminMaster = list?.users?.find(u => u.email === ADMIN_EMAIL);
    if (!adminMaster) return json({ error: `Admin master ${ADMIN_EMAIL} não encontrado` }, 404, corsHeaders);
    const ADMIN_ID = adminMaster.id;

    // 2) Criar/recuperar os 6 amigos (senha aleatória por conta criada nesta execução)
    const friendIds: Record<string, string> = {};
    const createdCredentials: Array<{ email: string; password: string }> = [];
    for (const f of FRIENDS) {
      const existing = list?.users?.find(u => u.email === f.email);
      let uid: string;
      if (existing) uid = existing.id;
      else {
        const pwd = generatePassword();
        const { data: c, error: cErr } = await admin.auth.admin.createUser({
          email: f.email, password: pwd, email_confirm: true,
          user_metadata: { display_name: f.display_name },
        });
        if (cErr || !c.user) throw new Error(`Falha ao criar ${f.email}: ${cErr?.message}`);
        uid = c.user.id;
        // Credenciais devolvidas UMA vez — o admin que chamou deve anotar. Não salvamos em log/DB.
        createdCredentials.push({ email: f.email, password: pwd });
      }
      friendIds[f.persona] = uid;
      await admin.from('profiles').update({
        display_name: f.display_name, bio: f.bio, is_private: false,
        library_visibility: 'public',
        social_visibility: 'public',
        theme_color: f.persona === 'gamer' ? '#A855F7' : '#14B8A6',
      } as any).eq('id', uid);
    }

    // 3) Follow mútuo: admin <-> cada amigo (cria conversa accepted)
    for (const fid of Object.values(friendIds)) {
      await admin.from('user_follows').insert({ follower_id: ADMIN_ID, following_id: fid }).select().maybeSingle();
      await admin.from('user_follows').insert({ follower_id: fid, following_id: ADMIN_ID }).select().maybeSingle();
      const [p1, p2] = [ADMIN_ID, fid].sort();
      const { data: existingConv } = await admin.from('conversas')
        .select('id').eq('participant_1', p1).eq('participant_2', p2).maybeSingle();
      if (!existingConv) {
        await admin.from('conversas').insert({ participant_1: p1, participant_2: p2, status: 'accepted' });
      }
    }

    // 4) Buscar produtos para popular biblioteca/torneios/etc.
    const { data: produtos } = await admin.from('produtos').select('id, title').limit(20);
    const prods = produtos ?? [];

    // 5) Biblioteca dos amigos: cada um com 3-5 jogos em status variados
    const statuses = ['quero_jogar', 'jogando', 'zerado', 'platinado', 'abandonado'];
    let bibCount = 0;
    for (const fid of Object.values(friendIds)) {
      const sample = prods.slice(0, 5);
      for (let i = 0; i < sample.length; i++) {
        const p = sample[i];
        const status = statuses[i % statuses.length];
        const { error } = await admin.from('biblioteca_usuario').upsert({
          user_id: fid, product_id: p.id, status,
          hours_played: Math.floor(Math.random() * 80) + 5,
          personal_rating: status === 'platinado' || status === 'zerado' ? (Math.random() * 2 + 3).toFixed(1) : null,
        }, { onConflict: 'user_id,product_id' });
        if (!error) bibCount++;
      }
    }
    // Admin também
    for (let i = 0; i < Math.min(6, prods.length); i++) {
      await admin.from('biblioteca_usuario').upsert({
        user_id: ADMIN_ID, product_id: prods[i].id,
        status: statuses[i % statuses.length],
        hours_played: Math.floor(Math.random() * 100) + 10,
      }, { onConflict: 'user_id,product_id' });
    }

    // 5b) Timeline events para cada amigo
    for (const fid of Object.values(friendIds)) {
      for (const p of prods.slice(0, 3)) {
        const { data: ex } = await admin.from('game_timeline_events')
          .select('id').eq('user_id', fid).eq('product_id', p.id).limit(1);
        if (!ex || ex.length === 0) {
          await admin.from('game_timeline_events').insert([
            { user_id: fid, product_id: p.id, event_type: 'status_change', payload: { status: 'jogando', hours: 12 } as any },
            { user_id: fid, product_id: p.id, event_type: 'achievement', payload: { name: 'Primeira vitória', icon: '🏆' } as any },
          ]);
        }
      }
    }


    // 6) Opiniões + respostas (cria conversas de opinião)
    let opCount = 0;
    if (prods.length > 0 && friendIds.reviewer) {
      for (const p of prods.slice(0, 3)) {
        const { data: existingOp } = await admin.from('game_opinions')
          .select('id').eq('user_id', friendIds.reviewer).eq('product_id', p.id).maybeSingle();
        let opId = existingOp?.id;
        if (!opId) {
          const { data: op } = await admin.from('game_opinions').insert({
            user_id: friendIds.reviewer, product_id: p.id,
            text: `Achei ${p.title} surpreendente. Vale demais o tempo investido!`,
          }).select('id').single();
          opId = op?.id;
        }
        if (opId) {
          const { data: conv } = await admin.from('opinion_conversations').upsert({
            opinion_id: opId, responder_id: ADMIN_ID,
          }, { onConflict: 'opinion_id,responder_id' }).select('id').single();
          if (conv?.id) {
            await admin.from('game_opinion_replies').insert({
              opinion_id: opId, conversation_id: conv.id,
              sender_id: ADMIN_ID, responder_id: ADMIN_ID,
              text: 'Concordo! Esse jogo é uma obra-prima.',
            });
            opCount++;
          }
        }
      }
    }

    // 7) Screenshots do streamer
    let scCount = 0;
    if (prods.length > 0 && friendIds.streamer) {
      for (const p of prods.slice(0, 2)) {
        const { data: existing } = await admin.from('game_screenshots')
          .select('id').eq('user_id', friendIds.streamer).eq('product_id', p.id).limit(1);
        if (!existing || existing.length === 0) {
          await admin.from('game_screenshots').insert({
            user_id: friendIds.streamer, product_id: p.id,
            image_url: `https://picsum.photos/seed/${p.id}/1280/720`,
            caption: `Boss fight insano em ${p.title} 🔥`,
          });
          scCount++;
        }
      }
    }

    // 8) Reviews completas do reviewer
    if (prods.length > 0 && friendIds.reviewer) {
      for (const p of prods.slice(0, 2)) {
        const { data: existing } = await admin.from('reviews_completas')
          .select('id').eq('user_id', friendIds.reviewer).eq('product_id', p.id).maybeSingle();
        if (!existing) {
          await admin.from('reviews_completas').insert({
            user_id: friendIds.reviewer, product_id: p.id,
            title: `Review honesta: ${p.title}`,
            content: `Após 40h jogando ${p.title}, posso dizer que vale cada centavo. Gameplay sólida, narrativa envolvente e replay value alto. Nota geral: 9/10.`,
            rating: 4.5, state: 'publicado',
          });
        }
      }
    }

    // 9) Anúncios do vendedor + conversa de marketplace
    let adIds: string[] = [];
    if (friendIds.seller) {
      const adsSeed = [
        { title: 'Elden Ring PS5 - Mídia Física', price: 200, category: 'jogo_fisico', condition: 'usado', plataformas: ['PS5'] },
        { title: 'Conta Steam c/ Cyberpunk + DLCs', price: 380, category: 'conta', condition: 'usado', plataformas: ['PC'] },
        { title: 'Mario Kart 8 Switch', price: 250, category: 'jogo_fisico', condition: 'novo', plataformas: ['Nintendo Switch'] },
      ];
      for (const a of adsSeed) {
        const { data: existing } = await admin.from('anuncios')
          .select('id').eq('seller_id', friendIds.seller).eq('title', a.title).maybeSingle();
        if (existing) { adIds.push(existing.id); continue; }
        const { data: ins } = await admin.from('anuncios').insert({
          ...a, seller_id: friendIds.seller, user_id: friendIds.seller,
          ad_type: 'venda', description: 'Item em ótimo estado, qualquer dúvida chama no chat.',
          certificate_type: 'protegido', status: 'active',
        }).select('id').single();
        if (ins) adIds.push(ins.id);
      }
      if (adIds.length > 0) {
        const msgs = [
          { sender: ADMIN_ID, receiver: friendIds.seller, content: 'Oi! Esse jogo ainda tá disponível?' },
          { sender: friendIds.seller, receiver: ADMIN_ID, content: 'Tá sim! Posso enviar hoje.' },
          { sender: ADMIN_ID, receiver: friendIds.seller, content: 'Fechado! Aceita Pix?' },
        ];
        for (const m of msgs) {
          const { data: ex } = await admin.from('mensagens')
            .select('id').eq('sender_id', m.sender).eq('content', m.content).maybeSingle();
          if (!ex) await admin.from('mensagens').insert({
            sender_id: m.sender, receiver_id: m.receiver, anuncio_id: adIds[0], content: m.content,
          });
        }
      }
    }

    // 10) Admin como vendedor → comprador
    if (friendIds.buyer) {
      const { data: existingAd } = await admin.from('anuncios')
        .select('id').eq('seller_id', ADMIN_ID).eq('title', '[Admin] Coleção Retrô SNES').maybeSingle();
      let myAdId = existingAd?.id;
      if (!myAdId) {
        const { data: ins } = await admin.from('anuncios').insert({
          seller_id: ADMIN_ID, user_id: ADMIN_ID,
          title: '[Admin] Coleção Retrô SNES', price: 1200,
          category: 'jogo_fisico', condition: 'usado', plataformas: ['Outros'],
          ad_type: 'venda', description: '15 cartuchos originais SNES. Tudo testado.',
          certificate_type: 'protegido', status: 'active',
        }).select('id').single();
        myAdId = ins?.id;
      }
      if (myAdId) {
        const msgs = [
          { sender: friendIds.buyer, receiver: ADMIN_ID, content: 'Tem interesse em trocar por um PS4 Pro?' },
          { sender: ADMIN_ID, receiver: friendIds.buyer, content: 'Posso considerar, manda fotos do PS4.' },
        ];
        for (const m of msgs) {
          const { data: ex } = await admin.from('mensagens')
            .select('id').eq('sender_id', m.sender).eq('content', m.content).maybeSingle();
          if (!ex) await admin.from('mensagens').insert({
            sender_id: m.sender, receiver_id: m.receiver, anuncio_id: myAdId, content: m.content,
          });
        }
      }
    }

    // 11) Certificado ativo para vendedor + streamer
    for (const fid of [friendIds.seller, friendIds.streamer]) {
      if (!fid) continue;
      const { data: ex } = await admin.from('certificados')
        .select('id').eq('user_id', fid).eq('status', 'ativo').maybeSingle();
      if (!ex) await admin.from('certificados').insert({
        user_id: fid, status: 'ativo',
        reason: 'Aprovado via seed admin',
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        reviewed_at: new Date().toISOString(), reviewed_by: ADMIN_ID,
      });
    }

    // 12) Torneio: cria um torneio onde admin + duda + leo participam
    if (friendIds.tournament && friendIds.gamer && prods.length > 0) {
      const { data: existingT } = await admin.from('tournaments')
        .select('id').eq('title', '🏆 Copa MIDIAS Teste').maybeSingle();
      let tId = existingT?.id;
      if (!tId) {
        const { data: t } = await admin.from('tournaments').insert({
          title: '🏆 Copa MIDIAS Teste', description: 'Torneio de teste para conta admin',
          product_id: prods[0].id, created_by: ADMIN_ID,
          format: 'single_elimination', max_participants: 8,
          status: 'open', registration_open: true,
          starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single();
        tId = t?.id;
      }
      if (tId) {
        for (const uid of [ADMIN_ID, friendIds.tournament, friendIds.gamer, friendIds.reviewer]) {
          await admin.from('tournament_participants').upsert({
            tournament_id: tId, user_id: uid, chat_role: 'participant',
          }, { onConflict: 'tournament_id,user_id' });
        }
        const { data: chatEx } = await admin.from('tournament_chat_messages')
          .select('id').eq('tournament_id', tId).limit(1);
        if (!chatEx || chatEx.length === 0) {
          await admin.from('tournament_chat_messages').insert([
            { tournament_id: tId, sender_id: friendIds.tournament, content: 'Bora ganhar essa! 🔥' },
            { tournament_id: tId, sender_id: friendIds.gamer, content: 'Tô treinando muito, vai ser épico!' },
            { tournament_id: tId, sender_id: ADMIN_ID, content: 'Boa sorte a todos! Que vença o melhor.' },
          ]);
        }
      }
    }

    return json({
      ok: true,
      message: 'Seed completo! Conta admin agora tem 6 amigos com biblioteca, torneios, conversas e opiniões.',
      admin: ADMIN_EMAIL,
      friends: Object.entries(friendIds).map(([persona, id]) => {
        const f = FRIENDS.find(x => x.persona === persona)!;
        return { persona, name: f.display_name, email: f.email, id };
      }),
      // Credenciais devolvidas APENAS para contas criadas nesta execução.
      // Anote agora — não são armazenadas em log nem retornadas em chamadas futuras.
      new_credentials: createdCredentials,
      counts: { biblioteca: bibCount, opinions: opCount, screenshots: scCount, anuncios: adIds.length },
    }, 200, corsHeaders);
  } catch (e) {
    console.error('seed-admin-friends error', e);
    return json({ error: (e as Error).message }, 500, corsFor(req));
  }
});

function json(b: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
