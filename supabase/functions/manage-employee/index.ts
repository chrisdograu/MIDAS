import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar funcionários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, display_name, phone, role, position } = body;

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      if (phone) {
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({ phone })
          .eq("id", newUser.user.id);
        if (profErr) {
          return new Response(JSON.stringify({ error: `Funcionário criado, mas o telefone não foi salvo: ${profErr.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Promote to staff — precisa checar erro E linhas afetadas: se o gatilho de
      // criação de perfil ainda não tiver inserido a linha em user_roles, o UPDATE
      // "passa" sem atualizar nada e o funcionário nasce sem cargo.
      const { data: roleRows, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .update({ role, position })
        .eq("user_id", newUser.user.id)
        .select("user_id");

      if (roleErr) {
        return new Response(JSON.stringify({ error: `Funcionário criado, mas o cargo não foi aplicado: ${roleErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!roleRows || roleRows.length === 0) {
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role, position });
        if (insErr) {
          return new Response(JSON.stringify({ error: `Funcionário criado, mas o cargo não foi aplicado: ${insErr.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    }

    if (action === "update") {
      const { user_id, role, position } = body;
      // Fetch current position to detect change
      const { data: cur } = await supabaseAdmin
        .from("user_roles")
        .select("position, role")
        .eq("user_id", user_id)
        .maybeSingle();

      const { error: updErr } = await supabaseAdmin
        .from("user_roles")
        .update({ role, position })
        .eq("user_id", user_id);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If position or role changed, invalidate active sessions to force re-login with fresh claims
      if (cur && (cur.position !== position || cur.role !== role)) {
        try {
          await supabaseAdmin.auth.admin.signOut(user_id, "global" as any);
        } catch (_e) { /* best-effort */ }
        await supabaseAdmin.from("admin_logs").insert({
          admin_id: caller.id,
          action: "employee.position_change",
          entity: "user_roles",
          entity_id: user_id,
          payload: { from: cur, to: { role, position } },
        } as any);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "delete") {
      const { user_id } = body;
      // Don't allow self-delete
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Não é possível excluir a própria conta" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação `create_batch` removida — seed em massa fica isolado nas funções `seed-*`.

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
