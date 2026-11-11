-- 011b — O Supabase concede EXECUTE direto ao anon em funções novas.
-- Retira esse acesso das funções criadas na 011.
revoke execute on function public.sigef_register_user(text, text, text, text, text, text, text) from anon;
revoke execute on function public.sigef_change_password(text, text, text) from anon;
revoke execute on function public.sigef_current_app_user_id() from anon;
revoke execute on function public.sigef_is_app_admin() from anon;
