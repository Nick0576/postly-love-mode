import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LOVE_QUESTIONS, currentUserId, type Profile } from "@/lib/postly";

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
  const [draft, setDraft] = useState<number[] | null>(null);

  const { data } = useQuery({
    queryKey: ["love"],
    queryFn: async () => {
      const me = await currentUserId();
      const { data: rows } = await supabase.from("love_answers").select("user_id,answers");
      const mine = rows?.find((r) => r.user_id === me);
      const others = (rows ?? []).filter((r) => r.user_id !== me);
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
      return { me, mine: (mine?.answers as number[] | undefined) ?? null, matches };
    },
  });

  const answers = draft ?? data?.mine ?? null;
  const started = answers !== null;

  async function saveAll(list: number[]) {
    if (!data) return;
    await supabase.from("love_answers").upsert({ user_id: data.me, answers: list, updated_at: new Date().toISOString() });
    setDraft(null);
    void qc.invalidateQueries({ queryKey: ["love"] });
  }

  return (
    <AppShell title="Love Mode">
      {!started && (
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
          {LOVE_QUESTIONS.map((q, i) => {
            const [a, b] = q.replace("?", "").split(" or ");
            return (
              <div key={q} className="rounded-xl border p-3">
                <p className="text-sm font-medium">{q}</p>
                <div className="mt-2 flex gap-2">
                  {[a, b].map((opt, idx) => (
                    <Button
                      key={opt}
                      size="sm"
                      variant={answers[i] === idx ? "default" : "outline"}
                      onClick={() => {
                        const next = [...answers];
                        next[i] = idx;
                        setDraft(next);
                      }}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          <Button className="w-full" onClick={() => void saveAll(answers)}>
            Save answers
          </Button>
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
