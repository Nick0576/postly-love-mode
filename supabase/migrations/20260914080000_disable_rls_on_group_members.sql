-- Disable RLS on group_members table to stop infinite recursion
ALTER TABLE public.group_members NO FORCE ROW LEVEL SECURITY;

-- Add permissive policy for group_members
DROP POLICY IF EXISTS "group_members_permissive" ON public.group_members;
CREATE POLICY "group_members_permissive" ON public.group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
