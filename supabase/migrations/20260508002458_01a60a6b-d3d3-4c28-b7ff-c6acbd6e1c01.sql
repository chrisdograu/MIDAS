drop policy if exists "Users can delete own sent messages" on public.mensagens;
create policy "Users can delete own sent messages"
on public.mensagens
for delete
to authenticated
using (auth.uid() = sender_id);