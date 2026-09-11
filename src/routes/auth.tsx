import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import icon from "@/assets/postly-icon.png.asset.json";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Postly" },
      { name: "description", content: "Log in or create your free Postly account." },
      { property: "og:title", content: "Sign in — Postly" },
      { property: "og:description", content: "Log in or create your free Postly account." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/feed" });
      } else if (mode === "signup") {
        const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (clean.length < 3) throw new Error("Username needs at least 3 letters or numbers.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { username: clean, display_name: clean },
          },
        });
        if (error) throw error;
        setMsg("Account created. Check your email to confirm, then log in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setMsg("Password reset link sent to your email.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-soft">
        <div className="flex flex-col items-center gap-2">
          <img src={icon.url} alt="Postly" className="h-14 w-14 rounded-2xl" />
          <h1 className="text-xl font-bold">
            {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
        </div>

        {mode === "signup" && (
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
        )}

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Sign up" : "Send reset link"}
        </Button>

        <div className="flex justify-between text-sm text-muted-foreground">
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create account" : "Have an account?"}
          </button>
          <button type="button" onClick={() => setMode("forgot")}>
            Forgot password
          </button>
        </div>
      </form>
    </div>
  );
}
