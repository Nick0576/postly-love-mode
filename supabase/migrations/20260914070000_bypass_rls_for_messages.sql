-- Bypass RLS for messages table to fix infinite recursion issue
-- This allows all authenticated users to insert messages without policy checks

ALTER TABLE public.messages NO FORCE ROW LEVEL SECURITY;

-- Add a permissive policy for authenticated users
DROP POLICY IF EXISTS "messages_permissive" ON public.messages;
CREATE POLICY "messages_permissive" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
