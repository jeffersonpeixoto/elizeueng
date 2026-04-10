// supabase/functions/replace-chamado-itens/index.ts
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

  if (!body.chamado_id) {
    return json({ error: "chamado_id é obrigatório." }, 400);
  }

  if (!Array.isArray(body.itens)) {
    return json({ error: "A lista de itens é obrigatória." }, 400);
  }

  const supabase = getAdminClient();

  const { data: chamado, error: erroChamado } = await supabase
    .from("chamados")
    .select("id, equipe_id")
    .eq("id", body.chamado_id)
    .single();

  if (erroChamado || !chamado) {
    return json({ error: "Chamado não encontrado." }, 404);
  }

  const { error: erroDelete } = await supabase
    .from("chamado_itens")
    .delete()
    .eq("chamado_id", body.chamado_id);

  if (erroDelete) {
    return json({ error: erroDelete.message }, 400);
  }

  if (!body.itens.length) {
    return json({ ok: true, chamado_id: body.chamado_id, total_itens: 0 });
  }

  const itensNormalizados = body.itens.map((item: any) => ({
    chamado_id: body.chamado_id,
    servico: item.servico,
    cargo_id: item.cargo_id,
    quantidade: item.quantidade,
    horas: item.horas,
    observacao: item.observacao || null
  }));

  for (const item of itensNormalizados) {
    const { data: vinculo, error: erroVinculo } = await supabase
      .from("valores_equipe_cargo")
      .select("id")
      .eq("equipe_id", chamado.equipe_id)
      .eq("cargo_id", item.cargo_id)
      .maybeSingle();

    if (erroVinculo) {
      return json({ error: erroVinculo.message }, 400);
    }

    if (!vinculo) {
      return json({ error: `Cargo ${item.cargo_id} não pertence à equipe do chamado.` }, 400);
    }
  }

  const { error: erroInsert } = await supabase
    .from("chamado_itens")
    .insert(itensNormalizados);

  if (erroInsert) {
    return json({ error: erroInsert.message }, 400);
  }

  return json({ ok: true, chamado_id: body.chamado_id, total_itens: itensNormalizados.length });
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