-- Disable RLS on all group-related tables to eliminate infinite recursion

-- Disable RLS on group_chats
ALTER TABLE public.group_chats NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_chats_permissive" ON public.group_chats;
CREATE POLICY "group_chats_permissive" ON public.group_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Disable RLS on group_members
ALTER TABLE public.group_members NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_members_permissive" ON public.group_members;
CREATE POLICY "group_members_permissive" ON public.group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Disable RLS on messages
ALTER TABLE public.messages NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_permissive" ON public.messages;
CREATE POLICY "messages_permissive" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
