-- Fix messages INSERT policy to avoid recursion for direct messages

-- Drop the problematic group message policy
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;

-- Create a new policy that only applies to group messages (group_id IS NOT NULL)
CREATE POLICY "Group members can send group messages" ON public.messages FOR INSERT WITH CHECK (
  group_id IS NOT NULL AND group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);

-- Ensure the original direct message policy exists
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
