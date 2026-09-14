-- Drop and recreate the group_members SELECT policy to fix infinite recursion
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;

CREATE POLICY "Users can view group members" ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);
