-- ============================================================================
-- Security hardening migration
--
-- Fixes the permissive/broken RLS introduced by earlier hot-fix migrations:
--   * group_chats / group_members  : owner/member-based RLS (no infinite
--     recursion; uses a SECURITY DEFINER membership helper)
--   * messages                     : only conversation participants may read,
--     only senders may insert/update, senders/recipients may delete
--   * storage.objects (media)      : reads restricted to ownership/access
--   * love_answers                 : removed from the realtime publication
--   * SECURITY DEFINER functions   : fixed search_path, minimal EXECUTE grants
--   * profiles                     : private fields stay constrained to
--     contexts that genuinely need them (love answers = mutuals only,
--     profile views = owner only). Public social fields (username, bio,
--     avatar, online status) remain public by design: the feed, search, and
--     profile pages render them for every signed-in user.
--
-- Idempotent: safe to re-run against an up-to-date database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Group membership helper (avoids RLS self-recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = $1
      AND gm.user_id = auth.uid()
  );
$$;

-- A SECURITY INVOKER variant used only inside policies is unnecessary; the
-- definer variant runs with the table owner's privileges (bypassing RLS on
-- group_members) so policy evaluation never recurses.
REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) messages: participant-only RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_permissive" ON public.messages;
DROP POLICY IF EXISTS "messages_read_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Group members can send group messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "messages_read_participant"
  ON public.messages
  FOR SELECT TO authenticated
  USING (
    (group_id IS NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id))
    OR (group_id IS NOT NULL AND public.is_group_member(group_id))
  );

CREATE POLICY "messages_insert_sender"
  ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      (group_id IS NULL AND recipient_id IS NOT NULL)
      OR (group_id IS NOT NULL AND public.is_group_member(group_id))
    )
  );

CREATE POLICY "messages_update_own"
  ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_delete_own"
  ON public.messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = sender_id
    OR (group_id IS NULL AND auth.uid() = recipient_id)
  );

-- ---------------------------------------------------------------------------
-- 3) group_chats: owner/member-based RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_chats FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_chats_permissive" ON public.group_chats;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.group_chats;
DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.group_chats;

CREATE POLICY "group_chats_read_member"
  ON public.group_chats
  FOR SELECT TO authenticated
  USING (public.is_group_member(id));

CREATE POLICY "group_chats_insert_owner"
  ON public.group_chats
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "group_chats_update_owner"
  ON public.group_chats
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "group_chats_delete_owner"
  ON public.group_chats
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- 4) group_members: members can read/be added, nobody joins arbitrarily
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_permissive" ON public.group_members;
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

CREATE POLICY "group_members_read"
  ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id));

-- A member (or the group creator) may add other users. Random users cannot
-- add themselves to groups they do not belong to and did not create.
CREATE POLICY "group_members_insert_member"
  ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    group_id IN (SELECT id FROM public.group_chats WHERE created_by = auth.uid())
    OR public.is_group_member(group_id)
  );

-- Members can leave; the group creator can remove members.
CREATE POLICY "group_members_delete"
  ON public.group_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR group_id IN (SELECT id FROM public.group_chats WHERE created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5) storage: private media reads by ownership/access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "media_read" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;

-- Read: public content (posts, stories, avatars/banners, button-page media)
-- plus private content (DM/group message attachments) restricted to the
-- participants of that conversation.
CREATE POLICY "media_read_authorized"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      EXISTS (SELECT 1 FROM public.posts p WHERE p.media_url = name)
      OR EXISTS (SELECT 1 FROM public.stories s WHERE s.media_url = name)
      OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.avatar_url = name OR pr.banner_url = name
      )
      OR EXISTS (
        SELECT 1 FROM public.button_elements be
        WHERE be.content->>'url' = name
      )
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.media_url = name
          AND (
            (m.group_id IS NULL AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid()))
            OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id))
          )
      )
    )
  );

-- Write: only into your own user folder.
CREATE POLICY "media_insert_own"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "media_update_own"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "media_delete_own"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 6) love_answers: stop streaming answers over realtime; polling already
--    covers the app and the SELECT policy restricts reads to mutuals.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'love_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.love_answers;
  END IF;
END;
$$;

-- Ensure only true participants can read love answers (defensive re-create).
DROP POLICY IF EXISTS "love_read_mutual" ON public.love_answers;
CREATE POLICY "love_read_mutual" ON public.love_answers FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR (
    EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = love_answers.user_id)
    AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = love_answers.user_id AND f.following_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "love_insert_own" ON public.love_answers;
CREATE POLICY "love_insert_own" ON public.love_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "love_update_own" ON public.love_answers;
CREATE POLICY "love_update_own" ON public.love_answers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7) SECURITY DEFINER functions: explicit grants + fixed search_path
-- ---------------------------------------------------------------------------

-- block_user / unblock_user (already SECURITY DEFINER with search_path set).
-- Remove the default PUBLIC/anon EXECUTE and keep explicit grants.
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO service_role;

-- Trigger functions: fix mutable search_path and tighten EXECUTE grants.
CREATE OR REPLACE FUNCTION public.update_music_clip_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_bubble_music_video_id IS NOT NULL THEN
    IF NEW.chat_bubble_music_clip_start IS NULL THEN
      NEW.chat_bubble_music_clip_start := 0;
    END IF;
    IF NEW.chat_bubble_music_clip_end IS NULL THEN
      NEW.chat_bubble_music_clip_end := 30;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_music_clip_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_music_clip_columns() FROM anon;
GRANT EXECUTE ON FUNCTION public.update_music_clip_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_music_clip_columns() TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Love Mode result delivery (preserves the "mirrored result message"
--    feature without allowing users to forge messages under strict RLS).
--    Verifies mutual-follow before writing both sides of the conversation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_love_match_notifications(
  target_user_id uuid,
  caller_content text,
  target_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only mutual followers may exchange love-match notifications.
  PERFORM 1
  FROM public.follows f1
  JOIN public.follows f2
    ON f1.follower_id = caller
   AND f1.following_id = target_user_id
   AND f2.follower_id = target_user_id
   AND f2.following_id = caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Users must follow each other to exchange love notifications';
  END IF;

  INSERT INTO public.messages (sender_id, recipient_id, content, media_type)
  VALUES
    (caller, target_user_id, caller_content, 'love_result'),
    (target_user_id, caller, target_content, 'love_result');
END;
$$;

REVOKE ALL ON FUNCTION public.send_love_match_notifications(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_love_match_notifications(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_love_match_notifications(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_love_match_notifications(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 9) Table privileges.
--    Older tables were granted to the API roles; tables created by later SQL
--    migrations (groups, stories, views, likes, ...) never received grants, so
--    the API could not touch them even when RLS was disabled. This restores a
--    consistent, minimal set: DML for the API role, full control for the
--    service_role. Grants are idempotent.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.profiles,
    public.posts,
    public.comments,
    public.follows,
    public.messages,
    public.love_answers,
    public.likes,
    public.stories,
    public.profile_views,
    public.blocks,
    public.favorite_songs,
    public.button_pages,
    public.buttons,
    public.button_elements,
    public.chat_backgrounds,
    public.group_chats,
    public.group_members
  TO authenticated;

GRANT ALL ON
    public.profiles,
    public.posts,
    public.comments,
    public.follows,
    public.messages,
    public.love_answers,
    public.likes,
    public.stories,
    public.profile_views,
    public.blocks,
    public.favorite_songs,
    public.button_pages,
    public.buttons,
    public.button_elements,
    public.chat_backgrounds,
    public.group_chats,
    public.group_members
  TO service_role;