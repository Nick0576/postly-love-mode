CREATE TABLE public.group_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Add group_id to messages table
ALTER TABLE public.messages ADD COLUMN group_id uuid REFERENCES public.group_chats(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_messages_group_id ON public.messages(group_id);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Policies for group_chats
CREATE POLICY "Users can view groups they are members of" ON public.group_chats FOR SELECT USING (
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create groups" ON public.group_chats FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group creators can update their groups" ON public.group_chats FOR UPDATE USING (auth.uid() = created_by);

-- Policies for group_members
CREATE POLICY "Users can view group members" ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Group creators can add members" ON public.group_members FOR INSERT WITH CHECK (
  group_id IN (SELECT id FROM public.group_chats WHERE created_by = auth.uid())
);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- Policy for messages in groups
CREATE POLICY "Users can view messages in their groups" ON public.messages FOR SELECT USING (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Group members can send messages" ON public.messages FOR INSERT WITH CHECK (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
