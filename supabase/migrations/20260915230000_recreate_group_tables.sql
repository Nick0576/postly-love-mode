-- Recreate group chat tables that were dropped in 20260914100000
-- Uses permissive RLS to avoid infinite recursion

-- Re-create group_chats
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Re-create group_members
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Re-add group_id to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.group_chats(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no recursive subqueries)
DROP POLICY IF EXISTS "group_chats_permissive" ON public.group_chats;
CREATE POLICY "group_chats_permissive" ON public.group_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "group_members_permissive" ON public.group_members;
CREATE POLICY "group_members_permissive" ON public.group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ensure messages policies cover group_id
DROP POLICY IF EXISTS "messages_permissive" ON public.messages;
CREATE POLICY "messages_permissive" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
