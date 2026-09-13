import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, createGroupChat, addGroupMember, type Profile } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/create-group")({
  head: () => ({
    meta: [
      { title: "Create Group — Postly" },
      { name: "description", content: "Create a group chat on Postly." },
      { property: "og:title", content: "Create Group — Postly" },
      { property: "og:description", content: "Create a group chat on Postly." },
    ],
  }),
  component: CreateGroup,
});

function CreateGroup() {
  const [name, setName] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [members, setMembers] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  async function addMember() {
    const username = memberUsername.trim();
    if (!username) return;
    
    // Check if already added
    if (members.some(m => m.username === username)) {
      toast.error("User already added");
      return;
    }

    // Check if it's the current user
    const me = await currentUserId();
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", me)
      .single();
    
    if (myProfile?.username === username) {
      toast.error("You cannot add yourself");
      return;
    }

    // Find user
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    
    if (!profile) {
      toast.error("User not found");
      return;
    }

    if (members.length >= 9) {
      toast.error("Maximum 10 members allowed");
      return;
    }

    setMembers([...members, profile as Profile]);
    setMemberUsername("");
  }

  async function create() {
    const groupName = name.trim();
    if (!groupName) {
      toast.error("Enter a group name");
      return;
    }
    if (members.length === 0) {
      toast.error("Add at least one member");
      return;
    }
    
    setBusy(true);
    try {
      const groupId = await createGroupChat(groupName);
      
      // Add all members
      for (const member of members) {
        await addGroupMember(groupId, member.id);
      }
      
      toast.success("Group created");
      navigate({ to: "/messages" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create group");
    }
    setBusy(false);
  }

  return (
    <AppShell title="Create Group">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Group Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            maxLength={50}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Add Members (max 10)</label>
          <div className="flex gap-2">
            <Input
              value={memberUsername}
              onChange={(e) => setMemberUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={(e) => e.key === "Enter" && void addMember()}
            />
            <Button onClick={addMember} variant="outline">Add</Button>
          </div>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Members ({members.length}/10)</label>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border p-2">
                  <span>{member.display_name || member.username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMembers(members.filter(m => m.id !== member.id))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={create} disabled={busy} className="w-full">
          {busy ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </AppShell>
  );
}
