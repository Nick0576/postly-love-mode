-- Per-conversation chat backgrounds

CREATE TABLE public.chat_backgrounds (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_type text NOT NULL CHECK (conversation_type IN ('dm', 'group')),
  conversation_id text NOT NULL,
  background_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_type, conversation_id)
);

CREATE INDEX chat_backgrounds_user_idx ON public.chat_backgrounds(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_backgrounds TO authenticated;
GRANT ALL ON public.chat_backgrounds TO service_role;

ALTER TABLE public.chat_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_backgrounds_read_own" ON public.chat_backgrounds
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "chat_backgrounds_insert_own" ON public.chat_backgrounds
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_backgrounds_update_own" ON public.chat_backgrounds
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "chat_backgrounds_delete_own" ON public.chat_backgrounds
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
