# SIGEF — Sistema Integrado de Gestão da Educação Física

Aplicação web para a Coordenação de Educação Física (COEF) gerenciar espaços esportivos,
acervo de materiais, kits, reservas e empréstimos, com avisos e normas de uso.

**Stack:** React 19 · TypeScript · Vite · Tailwind 4 · Supabase (Postgres + Auth + RLS) · Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave publishable do seu projeto Supabase
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando             | O que faz                    |
| ------------------- | ---------------------------- |
| `npm run dev`       | Servidor de desenvolvimento  |
| `npm run build`     | Build de produção (`dist/`)  |
| `npm run typecheck` | Verificação de tipos (`tsc`) |
| `npm run lint`      | ESLint                       |
| `npm test`          | Testes unitários (Vitest)    |
| `npm run format`    | Prettier                     |

O CI (`.github/workflows/ci.yml`) roda typecheck, lint, testes, build e `npm audit` a cada push/PR.

## Banco de dados e segurança

As migrações em [`supabase/migrations`](supabase/migrations/README.md) devem ser aplicadas em ordem.
A chave publishable do Supabase é pública por desenho: **a proteção dos dados é o RLS**.
Antes de publicar, confirme no painel do Supabase:

- Authentication → Sign In / Providers → **"Allow new users to sign up" = OFF**;
- as migrações até a `013` aplicadas e o checklist de [`README_TESTES_RLS.md`](supabase/migrations/README_TESTES_RLS.md) executado.

## Importação de planilhas

O importador de materiais aceita `.xlsx`, `.xls` e `.csv` até 5 MB e 5.000 linhas
(ver `src/utils/excelMaterials.ts`). A biblioteca `xlsx` vem do registro oficial da SheetJS
(versão 0.20.x), pois a do npm (0.18.5) tem vulnerabilidades conhecidas.
