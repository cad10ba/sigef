# SIGEF — Checklist de teste da RLS

Script a aplicar: [`supabase_rls_policies.sql`](./supabase_rls_policies.sql) (rode **por último**, depois de qualquer script de schema/auth).

## 0. Preparação

A chave usada é a **publishable** (a mesma do bundle — ela é pública por design). Nunca use a `service_role` aqui: ela ignora a RLS e o teste perde o sentido.

```bash
export SUPABASE_URL="https://hvzvhqgfcozaprywordg.supabase.co"
export PUBLISHABLE_KEY="sb_publishable_q19GlvrpfNFaSTSbwhmDtw_uirJ3PNW"

# helper: mostra status + corpo
q() { curl -s -o /tmp/body -w "%{http_code}\n" "$@"; cat /tmp/body; echo; }
```

Resultados aceitáveis para tabela sensível, **sem sessão**:

- `401` / `403` com `{"code":"42501","message":"permission denied for table ..."}` → privilégio revogado (melhor caso);
- `200 []` → RLS ativa e nenhuma política liberou linhas;
- **FALHA** se vier `200` com qualquer registro.

## 1. Sem sessão (anon) — tabelas públicas

| # | Comando | Esperado |
|---|---------|----------|
| 1 | `q "$SUPABASE_URL/rest/v1/spaces?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` com dados |
| 2 | `q "$SUPABASE_URL/rest/v1/materials?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` |
| 3 | `q "$SUPABASE_URL/rest/v1/kits?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` |
| 4 | `q "$SUPABASE_URL/rest/v1/notices?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` |
| 5 | `q "$SUPABASE_URL/rest/v1/regulation?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` |
| 6 | `q "$SUPABASE_URL/rest/v1/categories?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `200` (só se a tabela existir) |

## 2. Sem sessão (anon) — dados pessoais e patrimônio

| # | Comando | Esperado |
|---|---------|----------|
| 7 | `q "$SUPABASE_URL/rest/v1/requesters?select=*&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `401/403` ou `200 []` |
| 8 | `q "$SUPABASE_URL/rest/v1/loans?select=*&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `401/403` ou `200 []` |
| 9 | `q "$SUPABASE_URL/rest/v1/reservations?select=*&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `401/403` ou `200 []` |
| 10 | `q "$SUPABASE_URL/rest/v1/app_users?select=*&limit=1" -H "apikey: $PUBLISHABLE_KEY"` | `401/403` ou `200 []` (**nunca** `password_hash`) |
| 11 | `curl -s -D- -o /dev/null -X HEAD "$SUPABASE_URL/rest/v1/requesters" -H "apikey: $PUBLISHABLE_KEY" -H "Prefer: count=exact" \| grep -i content-range` | `*/0` (zero linhas) |

## 3. Sem sessão (anon) — escrita

| # | Comando | Esperado |
|---|---------|----------|
| 12 | `q -X POST "$SUPABASE_URL/rest/v1/spaces" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"id":"test-anon","name":"x","type":"y"}'` | `401/403` (anon só tem SELECT) |
| 13 | `q -X POST "$SUPABASE_URL/rest/v1/requesters" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"id":"x","name":"x","type":"aluno","registration":"1","course_or_department":"x","email":"x@x","phone":"0"}'` | `401/403` |
| 14 | `q -X PATCH "$SUPABASE_URL/rest/v1/loans?id=eq.QUALQUER_ID" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"status":"devolvido"}'` | `401/403` ou `200 []` (nenhuma linha afetada) |
| 15 | `q -X DELETE "$SUPABASE_URL/rest/v1/loans?id=eq.QUALQUER_ID" -H "apikey: $PUBLISHABLE_KEY"` | `401/403` |

> Substitua `QUALQUER_ID` por um id que exista. O termo NÃO pode desaparecer: confirme depois com `select count(*)` no SQL Editor.

## 4. Sem sessão (anon) — RPC SECURITY DEFINER

| # | Comando | Esperado |
|---|---------|----------|
| 16 | `q -X POST "$SUPABASE_URL/rest/v1/rpc/sigef_login" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"p_identifier":"naoexiste@x","p_password":"x"}'` | `200 {"success":false,"message":"Credenciais inválidas..."}` (mesma resposta de senha errada) |
| 17 | `q -X POST "$SUPABASE_URL/rest/v1/rpc/sigef_register_user" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"p_id":"esc-1","p_name":"Escalada","p_role":"admin","p_registration":"esc-1","p_email":"esc1@example.com","p_role_label":"Admin","p_password":"senha123"}'` | `200 {"success":false,"message":"Somente administradores podem criar contas de administrador."}` — **não** pode criar o admin |
| 18 | `q -X POST "$SUPABASE_URL/rest/v1/rpc/sigef_change_password" -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"p_user_id":"user-admin","p_current_password":"errada","p_new_password":"x1234"}'` | `200 {"success":false,...}` (senha atual errada) |

> Se o teste 17 criar a conta, a função ainda é a versão antiga: reaplique a seção 8 do script.

## 5. Com sessão (authenticated)

Para testar a camada autenticada é preciso um usuário do **Supabase Auth** (o login por RPC do SIGEF não cria sessão). Crie em *Authentication → Users* e promova quando necessário:

```sql
-- promoção a admin (o JWT só carrega o papel após novo login)
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'admin@instituicao.br';
```

```bash
export EMAIL="usuario@instituicao.br"
export PASSWORD="senha-do-usuario"
export TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
```

| # | Comando | Esperado |
|---|---------|----------|
| 19 | `q "$SUPABASE_URL/rest/v1/requesters?select=*&limit=1" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN"` | `200` com dados |
| 20 | `q "$SUPABASE_URL/rest/v1/loans?select=id&limit=1" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN"` | `200` |
| 21 | `q -X DELETE "$SUPABASE_URL/rest/v1/loans?id=eq.QUALQUER_ID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN"` | `401/403` — DELETE continua bloqueado |
| 22 | `q "$SUPABASE_URL/rest/v1/app_users?select=id,role&limit=5" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN"` | admin: `200`; outros: `200 []` |
| 23 | `q -X PATCH "$SUPABASE_URL/rest/v1/loans?id=eq.QUALQUER_ID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"requester_name":"Alterado"}'` | `401/403` (campos do termo são imutáveis) |
| 24 | `q -X PATCH "$SUPABASE_URL/rest/v1/loans?id=eq.QUALQUER_ID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"notes":"Vistoria ok"}'` | `204` (devolução/observação continuam editáveis) |

## 6. Conferência no SQL Editor

```sql
-- todas devem vir rls_ativa = true
select relname, relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and relname in ('spaces','materials','kits','requesters','loans',
                   'reservations','notices','app_users','regulation','categories')
 order by 1;

-- todos devem vir false, exceto se você decidir outro desenho
select has_table_privilege('anon','public.requesters','select')      as anon_requesters,
       has_table_privilege('anon','public.loans','select')           as anon_loans,
       has_table_privilege('anon','public.reservations','select')    as anon_reservations,
       has_table_privilege('anon','public.app_users','select')       as anon_app_users,
       has_table_privilege('authenticated','public.loans','delete')  as auth_loans_delete;

-- inventário final de políticas
select tablename, policyname, roles, cmd from pg_policies
 where schemaname = 'public' order by 1, 2;
```

## 7. Impacto no app (leia antes de aplicar)

O SIGEF autentica pela RPC `sigef_login` e fala com o Supabase usando a chave publishable **sem sessão**. Depois deste script:

- continuam funcionando: login por RPC, cadastro de contas operacionais, troca de senha, leitura das tabelas públicas;
- param de sincronizar com a nuvem: `requesters`, `loans`, `reservations` e `app_users` — a tela "Sincronizar" passa a mostrar erro/0 registros;
- o app segue utilizável porque o estado vive no `localStorage` (offline-first), mas os dados ficam só na máquina.

Para retomar a sincronização com segurança, o cliente precisa de sessão do Supabase Auth:

1. trocar a autenticação do app para `supabase.auth.signInWithPassword` (o bcrypt do `app_users` pode ser migrado ou o login passa a ser 100% Supabase Auth);
2. criar os usuários institucionais em *Authentication → Users* e gravar o papel em `app_metadata.role`;
3. só então remover a RPC de login.

## 8. Pendências de segurança fora da RLS

- A senha do administrador está em texto puro nos scripts do repositório (`supabase_auth_hardening.sql`, `supabase_schema.sql`). **Troque essa senha** e não comite senha real.
- `sigef_login` não cria sessão: a "sessão" do SIGEF hoje é o objeto do `localStorage`, que o usuário pode editar. A fronteira real de dados passa a ser o Supabase Auth.
- Sem rate limit na RPC de login: qualquer pessoa pode tentar senhas sem sessão.
