-- supabase/sql/00_schema.sql
begin;

drop view if exists public.vw_chamados_com_total;
drop view if exists public.vw_chamado_itens_detalhado;
drop view if exists public.vw_equipe_cargos;

drop table if exists public.chamado_itens cascade;
drop table if exists public.chamados cascade;
drop table if exists public.valores_equipe_cargo cascade;
drop table if exists public.cargos cascade;
drop table if exists public.equipes cascade;

create table public.equipes (
  id bigserial primary key,
  nome text not null unique
);

create table public.cargos (
  id bigserial primary key,
  nome text not null unique
);

create table public.valores_equipe_cargo (
  id bigserial primary key,
  equipe_id bigint not null references public.equipes(id) on delete cascade,
  cargo_id bigint not null references public.cargos(id) on delete cascade,
  valor_hora numeric(10,2) not null check (valor_hora >= 0),
  constraint uq_valores_equipe_cargo unique (equipe_id, cargo_id)
);

create table public.chamados (
  id text primary key,
  solicitante text not null,
  unidade text not null,
  setor text not null,
  problema text not null,
  manutencao text not null,
  prioridade text not null,
  status text not null,
  criacao timestamp not null,
  inicio timestamp null,
  finalizacao timestamp null,
  equipe_id bigint null references public.equipes(id),
  observacao text null
);

create table public.chamado_itens (
  id bigserial primary key,
  chamado_id text not null references public.chamados(id) on delete cascade,
  servico text not null,
  cargo_id bigint not null references public.cargos(id),
  quantidade numeric(10,2) not null default 1 check (quantidade >= 0),
  horas numeric(10,2) not null default 0 check (horas >= 0),
  observacao text null,
  criado_em timestamp not null default now()
);

create index idx_chamados_status on public.chamados(status);
create index idx_chamados_criacao on public.chamados(criacao desc);
create index idx_chamados_equipe_id on public.chamados(equipe_id);
create index idx_chamado_itens_chamado_id on public.chamado_itens(chamado_id);
create index idx_chamado_itens_cargo_id on public.chamado_itens(cargo_id);

insert into public.equipes (nome) values
('METALURGICO'),
('ELETRICA'),
('PREDIAL');

insert into public.cargos (nome) values
('GESTOR'),
('METALURGICO'),
('AUXILIAR'),
('ELETRICISTA'),
('PEDREIRO OU PINTOR'),
('AJUDANTE');

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 34.00 from public.equipes e join public.cargos c on c.nome = 'GESTOR' where e.nome = 'METALURGICO';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 29.00 from public.equipes e join public.cargos c on c.nome = 'METALURGICO' where e.nome = 'METALURGICO';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 18.00 from public.equipes e join public.cargos c on c.nome = 'AUXILIAR' where e.nome = 'METALURGICO';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 34.00 from public.equipes e join public.cargos c on c.nome = 'GESTOR' where e.nome = 'ELETRICA';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 29.00 from public.equipes e join public.cargos c on c.nome = 'ELETRICISTA' where e.nome = 'ELETRICA';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 18.00 from public.equipes e join public.cargos c on c.nome = 'AUXILIAR' where e.nome = 'ELETRICA';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 34.00 from public.equipes e join public.cargos c on c.nome = 'GESTOR' where e.nome = 'PREDIAL';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 29.00 from public.equipes e join public.cargos c on c.nome = 'PEDREIRO OU PINTOR' where e.nome = 'PREDIAL';

insert into public.valores_equipe_cargo (equipe_id, cargo_id, valor_hora)
select e.id, c.id, 18.00 from public.equipes e join public.cargos c on c.nome = 'AJUDANTE' where e.nome = 'PREDIAL';

create or replace view public.vw_equipe_cargos as
select
  vec.id,
  e.id as equipe_id,
  e.nome as equipe_nome,
  c.id as cargo_id,
  c.nome as cargo_nome,
  vec.valor_hora
from public.valores_equipe_cargo vec
join public.equipes e on e.id = vec.equipe_id
join public.cargos c on c.id = vec.cargo_id;

create or replace view public.vw_chamado_itens_detalhado as
select
  ci.id,
  ci.chamado_id,
  ch.equipe_id,
  e.nome as equipe,
  ci.servico,
  c.id as cargo_id,
  c.nome as cargo,
  ci.quantidade,
  vec.valor_hora,
  ci.horas,
  (ci.quantidade * vec.valor_hora * ci.horas) as valor_total,
  ci.observacao,
  ci.criado_em
from public.chamado_itens ci
join public.chamados ch on ch.id = ci.chamado_id
join public.equipes e on e.id = ch.equipe_id
join public.cargos c on c.id = ci.cargo_id
join public.valores_equipe_cargo vec
  on vec.equipe_id = ch.equipe_id
 and vec.cargo_id = ci.cargo_id;

create or replace view public.vw_chamados_com_total as
select
  ch.id,
  ch.solicitante,
  ch.unidade,
  ch.setor,
  ch.problema,
  ch.manutencao,
  ch.prioridade,
  ch.status,
  ch.criacao,
  ch.inicio,
  ch.finalizacao,
  ch.equipe_id,
  e.nome as equipe,
  ch.observacao,
  coalesce(sum(vci.valor_total), 0) as valor_total_chamado
from public.chamados ch
left join public.equipes e on e.id = ch.equipe_id
left join public.vw_chamado_itens_detalhado vci on vci.chamado_id = ch.id
group by
  ch.id,
  ch.solicitante,
  ch.unidade,
  ch.setor,
  ch.problema,
  ch.manutencao,
  ch.prioridade,
  ch.status,
  ch.criacao,
  ch.inicio,
  ch.finalizacao,
  ch.equipe_id,
  e.nome,
  ch.observacao;

alter table public.equipes enable row level security;
alter table public.cargos enable row level security;
alter table public.valores_equipe_cargo enable row level security;
alter table public.chamados enable row level security;
alter table public.chamado_itens enable row level security;

create policy "leitura publica equipes" on public.equipes for select to anon using (true);
create policy "leitura publica cargos" on public.cargos for select to anon using (true);
create policy "leitura publica valores equipe cargo" on public.valores_equipe_cargo for select to anon using (true);
create policy "leitura publica chamados" on public.chamados for select to anon using (true);
create policy "leitura publica chamado itens" on public.chamado_itens for select to anon using (true);

commit;