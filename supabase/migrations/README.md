# Migrações do Supabase (SIGEF)

Scripts SQL versionados do banco. **Nada aqui é empacotado para o navegador** — o
front-end não importa, exibe nem copia mais nenhum SQL.

## Ordem de aplicação

| Ordem | Arquivo                              | O que faz                                                        |
| ----- | ------------------------------------ | ---------------------------------------------------------------- |
| 1     | `001_schema.sql`                     | Cria as 9 tabelas, constraints e políticas base.                 |
| 2     | `002_auth_hardening.sql`             | Hasheia as senhas (bcrypt), remove `password` e cria as RPCs de auth. |
| 3     | `003_rls_policies.sql`               | Fecha o RLS: apenas leitura pública de `spaces`/`materials`/`kits`/`notices`/`regulation`; escrita só com sessão Supabase Auth. |
| 4     | `004_sessions_and_user_listing.sql`  | Cria `app_sessions`, `sigef_login_session` (login + token), `sigef_list_users` (admin lista as contas) e `sigef_logout`. |
| 5     | `005_requesters_listing.sql`         | Cria `sigef_list_requesters`: lista docentes/alunos/servidores apenas para quem tem sessão válida, sem abrir `requesters` para `anon`. |
| 6     | `006_authenticated_sync.sql`         | Fecha o ciclo de sincronização: `sigef_list_loans`, `sigef_list_reservations`, `sigef_upsert_rows` e `sigef_delete_rows` (escrita/leitura autenticadas por token de sessão). Sem esta migração, dados adicionados/excluídos no app não chegam ao Supabase. |

`003_rls_policies.sql` **precisa** rodar depois de `001` e `002`: ele remove as
políticas permissivas criadas pelo schema e depende das funções de
`002_auth_hardening.sql`.

Aplicação pelo SQL Editor do projeto
(`https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg/sql`), um arquivo
por vez, nesta ordem.

## `deprecated/`

`deprecated/000_rls_hardening_permissivo.sql` deixava `anon` ler e escrever dados
pessoais (`USING (true)` em `requesters`, `loans`, `reservations` e `app_users`).
Substituído por `003_rls_policies.sql`. **Não execute.**

## Testes

Checklist manual: [`README_TESTES_RLS.md`](./README_TESTES_RLS.md).
