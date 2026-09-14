-- Add UPDATE policy for posts to allow users to update their own posts (including pinning)
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
