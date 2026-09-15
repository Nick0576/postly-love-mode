-- Button Pages Feature Migration

-- Buttons table (for button attachments on posts)
CREATE TABLE public.buttons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  appearance jsonb DEFAULT '{"color": "default", "style": "filled"}'::jsonb,
  button_page_id uuid REFERENCES public.button_pages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buttons_post_idx ON public.buttons(post_id);
CREATE INDEX buttons_user_idx ON public.buttons(user_id);
CREATE INDEX buttons_page_idx ON public.buttons(button_page_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buttons TO authenticated;
GRANT ALL ON public.buttons TO service_role;
ALTER TABLE public.buttons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buttons_read_own" ON public.buttons FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()));
CREATE POLICY "buttons_insert_own" ON public.buttons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "buttons_update_own" ON public.buttons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "buttons_delete_own" ON public.buttons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Button Pages table (custom pages)
CREATE TABLE public.button_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX button_pages_user_idx ON public.button_pages(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.button_pages TO authenticated;
GRANT ALL ON public.button_pages TO service_role;
ALTER TABLE public.button_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "button_pages_read_own" ON public.button_pages FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()));
CREATE POLICY "button_pages_insert_own" ON public.button_pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "button_pages_update_own" ON public.button_pages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "button_pages_delete_own" ON public.button_pages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Button Elements table (elements on a page)
CREATE TABLE public.button_elements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  button_page_id uuid REFERENCES public.button_pages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text', 'image', 'video', 'music', 'link', 'poll', 'question', 'button')),
  content jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0,
  link_button_id uuid REFERENCES public.buttons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX button_elements_page_idx ON public.button_elements(button_page_id);
CREATE INDEX button_elements_position_idx ON public.button_elements(button_page_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.button_elements TO authenticated;
GRANT ALL ON public.button_elements TO service_role;
ALTER TABLE public.button_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "button_elements_read_own" ON public.button_elements FOR SELECT TO authenticated USING (button_page_id IN (SELECT id FROM public.button_pages WHERE user_id = auth.uid() OR user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())));
CREATE POLICY "button_elements_insert_own" ON public.button_elements FOR INSERT TO authenticated WITH CHECK (button_page_id IN (SELECT id FROM public.button_pages WHERE user_id = auth.uid()));
CREATE POLICY "button_elements_update_own" ON public.button_elements FOR UPDATE TO authenticated USING (button_page_id IN (SELECT id FROM public.button_pages WHERE user_id = auth.uid()));
CREATE POLICY "button_elements_delete_own" ON public.button_elements FOR DELETE TO authenticated USING (button_page_id IN (SELECT id FROM public.button_pages WHERE user_id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_button_pages_updated_at
  BEFORE UPDATE ON public.button_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
