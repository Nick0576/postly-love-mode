import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { type Profile, isUserOnline } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/u/$username/followers")({
  component: FollowersList,
});

function FollowersList() {
  const { username } = Route.useParams();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username")
        .eq("username", username)
        .single();
      return data as Profile;
    },
  });

  const { data: followers } = useQuery({
    queryKey: ["followers", username],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id,profiles!follows_follower_id_fkey(*)")
        .eq("following_id", profile?.id);
      return data?.map(f => f.profiles) as Profile[] || [];
    },
  });

  return (
    <AppShell title="Followers">
      <div className="space-y-3">
        {followers?.map((user) => (
          <Link
            key={user.id}
            to="/u/$username"
            params={{ username: user.username }}
            className="flex items-center gap-3 rounded-xl border p-3 block"
          >
            <div className="relative">
              <Avatar url={user.avatar_url} name={user.display_name || user.username} size={48} />
              {isUserOnline(user) && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
              )}
              {!isUserOnline(user) && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-gray-400 border-2 border-background" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.display_name || user.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </Link>
        ))}
        {!followers?.length && (
          <p className="text-sm text-muted-foreground">No followers yet.</p>
        )}
      </div>
    </AppShell>
  );
}
