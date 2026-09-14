import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LOVE_QUESTIONS, currentUserId, type Profile } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/love")({
  head: () => ({
    meta: [
      { title: "Love Mode — Postly" },
      { name: "description", content: "A hidden Postly game: answer 20 questions and see your match." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Love Mode — Postly" },
      { property: "og:description", content: "A hidden Postly matching game." },
    ],
  }),
  component: Love,
});

function Love() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<number[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["love"],
    queryFn: async () => {
      const me = await currentUserId();
      const [{ data: rows }, { data: iFollow }, { data: followMe }] = await Promise.all([
        supabase.from("love_answers").select("user_id,answers"),
        supabase.from("follows").select("following_id").eq("follower_id", me),
        supabase.from("follows").select("follower_id").eq("following_id", me),
      ]);
      const back = new Set((followMe ?? []).map((r) => r.follower_id));
      const mutuals = new Set((iFollow ?? []).map((r) => r.following_id).filter((id) => back.has(id)));
      const mine = rows?.find((r) => r.user_id === me);
      const others = (rows ?? []).filter((r) => r.user_id !== me && mutuals.has(r.user_id));
      let matches: { profile: Profile; score: number }[] = [];
      if (mine && others.length) {
        const { data: people } = await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url")
          .in("id", others.map((o) => o.user_id));
        matches = (people ?? [])
          .map((p) => {
            const theirs = others.find((o) => o.user_id === p.id)!.answers as number[];
            const same = (mine.answers as number[]).filter((a, i) => a === theirs[i]).length;
            return { profile: p as Profile, score: Math.round((same / LOVE_QUESTIONS.length) * 100) };
          })
          .sort((a, b) => b.score - a.score);
      }
      return { me, mine: (mine?.answers as number[] | undefined) ?? null, matches, mutuals: mutuals.size };
    },
  });

  const locked = !!data && data.mutuals === 0;
  const answers = draft ?? data?.mine ?? null;
  const started = answers !== null && !locked;

  async function saveAll(list: number[]) {
    if (!data) return;
    await supabase.from("love_answers").upsert({ user_id: data.me, answers: list, updated_at: new Date().toISOString() });
    setDraft(null);
    setSaved(true);
    void qc.invalidateQueries({ queryKey: ["love"] });
    
    // Send waiting message and check for mutual submissions
    if (data.matches.length > 0) {
      for (const match of data.matches) {
        // Check if the other user has already submitted their answers
        const { data: otherAnswers } = await supabase
          .from("love_answers")
          .select("answers")
          .eq("user_id", match.profile.id)
          .single();
        
        if (otherAnswers) {
          // Both have submitted - send compatibility result to both
          const myAnswers = list;
          const theirAnswers = otherAnswers.answers as number[];
          const same = myAnswers.filter((a, i) => a === theirAnswers[i]).length;
          const score = Math.round((same / LOVE_QUESTIONS.length) * 100);
          
          // Send result to the other user
          await supabase.from("messages").insert({
            sender_id: data.me,
            recipient_id: match.profile.id,
            content: `Love Mode: You are ${score}% compatible with @${data.me}! 💕`,
            media_type: "love_result"
          });
          
          // Send result to current user
          await supabase.from("messages").insert({
            sender_id: match.profile.id,
            recipient_id: data.me,
            content: `Love Mode: You are ${score}% compatible with @${match.profile.display_name || match.profile.username}! 💕`,
            media_type: "love_result"
          });
        } else {
          // Only current user has submitted - send waiting message
          await supabase.from("messages").insert({
            sender_id: data.me,
            recipient_id: match.profile.id,
            content: "Waiting for you to submit your Love Mode answers... 💕",
            media_type: "love_waiting"
          });
        }
      }
    }
  }

  return (
    <AppShell title="Love Mode">
      {locked && (
        <div className="rounded-2xl border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Love Mode unlocks once you and another person follow each other.
          </p>
        </div>
      )}

      {!started && !locked && (
        <div className="rounded-2xl border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Answer 20 quick questions. We only compare you with people you follow who follow you back.
          </p>
          <Button className="mt-4" onClick={() => setDraft(Array(LOVE_QUESTIONS.length).fill(-1))}>
            Start
          </Button>
        </div>
      )}

      {started && (
        <div className="space-y-3">
          {LOVE_QUESTIONS.map((q, i) => (
            <div key={q} className="rounded-xl border p-3">
              <p className="text-sm font-medium">{q}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant={answers[i] === 1 ? "default" : "outline"}
                  onClick={() => {
                    const next = [...answers];
                    next[i] = 1;
                    setDraft(next);
                  }}
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant={answers[i] === 0 ? "default" : "outline"}
                  onClick={() => {
                    const next = [...answers];
                    next[i] = 0;
                    setDraft(next);
                  }}
                >
                  No
                </Button>
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <Button className="w-full" onClick={() => void saveAll(answers)}>
              Save answers
            </Button>
            {saved && data?.matches.length > 0 && (
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => navigate({ to: "/messages/$userId", params: { userId: data.matches[0].profile.id } })}
              >
                Go to chat to see results
              </Button>
            )}
          </div>
        </div>
      )}

      {!!data?.matches.length && (
        <div className="mt-6 space-y-2">
          <h2 className="font-semibold">Your matches</h2>
          {data.matches.map((m) => (
            <Link
              key={m.profile.id}
              to="/u/$username"
              params={{ username: m.profile.username }}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              <Avatar url={m.profile.avatar_url} name={m.profile.display_name || m.profile.username} size={36} />
              <span className="flex-1 truncate">{m.profile.display_name || m.profile.username}</span>
              <span className="font-bold text-primary">{m.score}%</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
