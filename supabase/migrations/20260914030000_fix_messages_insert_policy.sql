-- Fix messages INSERT policy to allow direct messages without checking group_members
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;

-- Allow sending direct messages (where group_id is NULL) or group messages (where user is a member)
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
  (group_id IS NULL AND auth.uid() = sender_id) OR
  (group_id IS NOT NULL AND group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()))
);
