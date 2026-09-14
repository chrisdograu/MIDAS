// Edge Function: dispara lembretes 7d / 1d / 1h antes dos torneios começarem.
// Acionada por cron (a cada 15min). Idempotente via tournament_reminder_log.
// Requer header `x-cron-secret` com valor de TOURNAMENT_CRON_SECRET (se configurado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  'https://midias-midas.lovable.app',
  'https://id-preview--c1cfbae2-5609-422d-b6ab-69f5e8880b6d.lovable.app',
];

function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

const WINDOWS = [
  { key: "7d", min: 7 * 24 * 60 - 8, max: 7 * 24 * 60 + 8 },
  { key: "1d", min: 24 * 60 - 8, max: 24 * 60 + 8 },
  { key: "1h", min: 60 - 8, max: 60 + 8 },
];

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Segredo compartilhado — se estiver definido, exigimos header correto.
  const expected = Deno.env.get("TOURNAMENT_CRON_SECRET");
  if (expected) {
    const got = req.headers.get("x-cron-secret");
    if (got !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  let totalSent = 0;

  for (const w of WINDOWS) {
    const lowerIso = new Date(now + w.min * 60 * 1000).toISOString();
    const upperIso = new Date(now + w.max * 60 * 1000).toISOString();

    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("id, title, starts_at")
      .gte("starts_at", lowerIso)
      .lte("starts_at", upperIso)
      .in("event_state", ["scheduled", "live"]);

    for (const t of tournaments ?? []) {
      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("user_id")
        .eq("tournament_id", t.id);

      for (const p of participants ?? []) {
        const { error: insertErr } = await supabase
          .from("tournament_reminder_log")
          .insert({ tournament_id: t.id, user_id: p.user_id, reminder_window: w.key });
        if (insertErr) continue; // duplicate -> already sent

        const title =
          w.key === "7d" ? `⏳ ${t.title} começa em 7 dias`
          : w.key === "1d" ? `⏳ ${t.title} começa amanhã`
          : `🚨 ${t.title} começa em 1 hora`;

        await supabase.from("notifications").insert({
          user_id: p.user_id,
          type: "lembrete_torneio",
          title,
          body: `Início: ${new Date(t.starts_at).toLocaleString("pt-BR")}`,
          reference_type: "tournament",
          reference_id: t.id,
        });
        totalSent++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
