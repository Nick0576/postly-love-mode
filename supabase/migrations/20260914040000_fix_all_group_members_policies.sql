-- Comprehensive fix for all group_members policies causing infinite recursion

-- Fix messages SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;
CREATE POLICY "Users can view messages in their groups" ON public.messages FOR SELECT USING (
  (group_id IS NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id)) OR
  (group_id IS NOT NULL AND group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()))
);

-- Fix group_chats SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.group_chats;
CREATE POLICY "Users can view groups they are members of" ON public.group_chats FOR SELECT USING (
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
