CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX blocks_blocked_idx ON public.blocks (blocked_id);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_read_own" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Function to block a user and remove follows
CREATE OR REPLACE FUNCTION public.block_user(blocked_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert block
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), blocked_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  
  -- Remove follow relationship both ways
  DELETE FROM public.follows 
  WHERE (follower_id = auth.uid() AND following_id = blocked_user_id)
     OR (follower_id = blocked_user_id AND following_id = auth.uid());
END;
$$;

-- Function to unblock a user
CREATE OR REPLACE FUNCTION public.unblock_user(blocked_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.blocks 
  WHERE blocker_id = auth.uid() AND blocked_id = blocked_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
