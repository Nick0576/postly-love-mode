-- Remove all group-related policies from messages to fix infinite recursion

-- Drop all message policies
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Group members can send group messages" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_read_own" ON public.messages;

-- Recreate only the basic direct message policies
CREATE POLICY "messages_read_own" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
);
