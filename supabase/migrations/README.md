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
| 7     | `007_users_as_requesters.sql`        | Toda conta de `app_users` passa a ter um solicitante correspondente em `requesters` (trigger), para docentes cadastrados fora do app aparecerem na lista. |
| 8     | `008_delete_person.sql`              | Cria `sigef_delete_person`: excluir um docente/usuário apaga também a conta em `app_users` e suas sessões (somente admin; preserva a própria conta e o último administrador). |
| 9     | `009_supabase_auth.sql`              | Move as credenciais para o Supabase Auth (`auth.users`), preservando os hashes; `app_users` vira o perfil, ligado por `auth_id`. |
| 10    | `010_staff_only_writes.sql`          | `sigef_is_staff()`: escrita e dados pessoais só para a equipe vinculada a `app_users`. |
| 11    | `011_lock_rpcs.sql`, `011b_revoke_anon_defaults.sql` | Trava as RPCs: `sigef_register_user` e `sigef_change_password` deixam de ser abertas a `anon`, limita tentativas de login e restringe o "apagar tudo" a administradores. |
| 12    | `012_password_reset_sync.sql`        | "Esqueci minha senha": grava em `app_users` o hash trocado pelo Supabase Auth. |
| 13    | `013_integridade_e_tokens.sql`       | Tokens de sessão guardados como hash SHA-256, chaves estrangeiras e campos únicos. |

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
