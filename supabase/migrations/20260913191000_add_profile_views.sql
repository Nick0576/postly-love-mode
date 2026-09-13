CREATE TABLE public.profile_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(viewer_id, viewed_user_id)
);

CREATE INDEX idx_profile_views_viewed_user_id ON public.profile_views(viewed_user_id);
CREATE INDEX idx_profile_views_viewed_at ON public.profile_views(viewed_at);

ALTER TABLE public.profiles ADD COLUMN profile_view_history_enabled boolean DEFAULT true;

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile views" ON public.profile_views FOR SELECT USING (
  viewed_user_id = auth.uid()
);

CREATE POLICY "Users can insert profile views" ON public.profile_views FOR INSERT WITH CHECK (
  viewer_id = auth.uid()
);

CREATE POLICY "Users can update profile views" ON public.profile_views FOR UPDATE USING (
  viewer_id = auth.uid()
);
