// supabase/functions/delete-chamado/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({}, 200);
  }

  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const adminPin = request.headers.get("x-admin-pin");
  const expectedPin = Deno.env.get("ADMIN_DELETE_PIN");

  if (!expectedPin || adminPin !== expectedPin) {
    return json({ error: "PIN administrativo inválido." }, 401);
  }

  const supabase = getAdminClient();
  const body = await safeJson(request);
  const chamadoId = body?.id;

  if (!chamadoId) {
    return json({ error: "ID do chamado é obrigatório." }, 400);
  }

  const { error } = await supabase
    .from("chamados")
    .delete()
    .eq("id", chamadoId);

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ ok: true, id: chamadoId });
});

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl!, serviceRoleKey!);
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}