-- 012 — "Esqueci minha senha": depois que o Supabase Auth troca a senha,
-- o app grava o mesmo hash em app_users (usado na troca de senha interna).
create or replace function public.sigef_set_own_password_hash(p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    if auth.uid() is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada.');
    end if;
    if length(btrim(coalesce(p_new_password, ''))) < 8 then
        return jsonb_build_object('success', false, 'message', 'A senha deve ter pelo menos 8 caracteres.');
    end if;
    update public.app_users
       set password_hash = crypt(btrim(p_new_password), gen_salt('bf', 10))
     where auth_id = auth.uid();
    return jsonb_build_object('success', found);
end;
$$;
revoke all on function public.sigef_set_own_password_hash(text) from public, anon;
grant execute on function public.sigef_set_own_password_hash(text) to authenticated, service_role;
