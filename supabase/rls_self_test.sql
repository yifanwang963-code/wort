-- Transaction-only RLS isolation check. No Auth accounts or rows remain after ROLLBACK.
begin;
-- The test uses synthetic user IDs, so temporarily drop the auth.users FK inside
-- this transaction, seed one foreign-owned row, and let ROLLBACK restore everything.
alter table public.user_data drop constraint user_data_user_id_fkey;
insert into public.user_data(user_id, data, schema_version)
values ('00000000-0000-0000-0000-0000000000b1', '{"test":"temporary RLS row"}', 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
declare visible_rows integer;
begin
  select count(*) into visible_rows from public.user_data
  where user_id = '00000000-0000-0000-0000-0000000000b1'::uuid;
  if visible_rows <> 0 then raise exception 'RLS FAILURE: user A can see user B data'; end if;
end $$;
reset role;
rollback;
select 'PASS: synthetic user A cannot read user B row; test transaction rolled back' as rls_test;
