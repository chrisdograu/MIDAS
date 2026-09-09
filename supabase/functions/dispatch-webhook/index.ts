// Edge Function: dispara webhooks para todas as URLs em `integration_webhooks`
// cujo `event` bate com o evento recebido e `active = true`.
//
// Chamada SEMPRE do servidor (SQL trigger via pg_net) — nunca do client, para
// não expor o segredo interno nem os segredos dos webhooks cadastrados.
//
// Payload esperado:
//   { event: string, payload: any }
// Header obrigatório:
//   x-dispatch-secret: <valor de WEBHOOK_DISPATCH_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const expected = Deno.env.get("WEBHOOK_DISPATCH_SECRET");
  if (expected) {
    const got = req.headers.get("x-dispatch-secret");
    if (got !== expected) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 }); }
  const event = String(body?.event || "").trim();
  const payload = body?.payload ?? null;
  if (!event) return new Response(JSON.stringify({ error: "Missing event" }), { status: 400 });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: hooks, error } = await supa
    .from("integration_webhooks")
    .select("id, url, secret")
    .eq("active", true)
    .eq("event", event);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: Array<{ id: string; status: string }> = [];
  await Promise.all((hooks || []).map(async (h: any) => {
    let status = "failed";
    try {
      const res = await fetch(h.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(h.secret ? { "X-Webhook-Secret": h.secret } : {}),
        },
        body: JSON.stringify({ event, at: new Date().toISOString(), payload }),
        signal: AbortSignal.timeout(8000),
      });
      status = res.ok ? `ok ${res.status}` : `http ${res.status}`;
    } catch (e: any) {
      status = `error: ${String(e?.message || e).slice(0, 120)}`;
    }
    await supa
      .from("integration_webhooks")
      .update({ last_test_status: status, last_test_at: new Date().toISOString() })
      .eq("id", h.id);
    results.push({ id: h.id, status });
  }));

  return new Response(JSON.stringify({ event, dispatched: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
