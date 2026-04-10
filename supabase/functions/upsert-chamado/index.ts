// supabase/functions/upsert-chamado/index.ts
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

  const body = await safeJson(request);

  if (
    !body.solicitante ||
    !body.unidade ||
    !body.setor ||
    !body.problema ||
    !body.manutencao ||
    !body.prioridade ||
    !body.status ||
    !body.criacao ||
    !body.equipe_id
  ) {
    return json({ error: "Campos obrigatórios não informados." }, 400);
  }

  const supabase = getAdminClient();
  const chamadoId = body.id || `CH-${Date.now()}`;

  const payload = {
    id: chamadoId,
    solicitante: body.solicitante,
    unidade: body.unidade,
    setor: body.setor,
    problema: body.problema,
    manutencao: body.manutencao,
    prioridade: body.prioridade,
    status: body.status,
    criacao: body.criacao,
    inicio: body.inicio || null,
    finalizacao: body.finalizacao || null,
    equipe_id: body.equipe_id,
    observacao: body.observacao || null
  };

  const { error } = await supabase
    .from("chamados")
    .upsert(payload, { onConflict: "id" });

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