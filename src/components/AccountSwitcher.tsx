import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Media";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getStoredAccounts,
  getActiveAccount,
  switchAccount,
  removeAccount,
  addAccount,
  type StoredAccount,
} from "@/lib/accounts";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { currentUserId, setOnlineStatus } from "@/lib/postly";

export function AccountSwitcher() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<StoredAccount[]>(getStoredAccounts());
  const [activeAccount, setActiveAccount] = useState<StoredAccount | null>(getActiveAccount());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatBubble, setChatBubble] = useState<{ text: string; enabled: boolean } | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");

  useEffect(() => {
    async function loadChatBubble() {
      try {
        const uid = await currentUserId();
        const { data } = await supabase
          .from("profiles")
          .select("chat_bubble_text,chat_bubble_enabled")
          .eq("id", uid)
          .maybeSingle();
        if (data) {
          setChatBubble({
            text: data.chat_bubble_text || "",
            enabled: data.chat_bubble_enabled || false,
          });
        }
      } catch (e) {
        console.error("Failed to load chat bubble:", e);
      }
    }
    loadChatBubble();

    // Set online status
    setOnlineStatus(true);

    // Set offline on unmount
    return () => {
      setOnlineStatus(false);
    };
  }, []);

  const handleSwitchAccount = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    // If account doesn't have stored password, show password dialog
    if (!account.password) {
      setSwitchingAccountId(accountId);
      setPasswordDialogOpen(true);
      return;
    }

    try {
      await switchAccount(accountId);
      setAccounts(getStoredAccounts());
      setActiveAccount(getActiveAccount());
      toast.success("Account switched");
      navigate({ to: "/feed" });
    } catch (error: any) {
      console.error("Failed to switch account:", error);
      toast.error(error.message || "Failed to switch account");
    }
  };

  const handleSwitchWithPassword = async () => {
    if (!switchingAccountId) return;
    
    try {
      await switchAccount(switchingAccountId, switchPassword);
      setAccounts(getStoredAccounts());
      setActiveAccount(getActiveAccount());
      setPasswordDialogOpen(false);
      setSwitchingAccountId(null);
      setSwitchPassword("");
      toast.success("Account switched");
      navigate({ to: "/feed" });
    } catch (error: any) {
      console.error("Failed to switch account:", error);
      toast.error(error.message || "Failed to switch account");
    }
  };

  const handleRemoveAccount = (accountId: string) => {
    if (accounts.length === 1) {
      toast.error("Cannot remove the last account");
      return;
    }
    removeAccount(accountId);
    setAccounts(getStoredAccounts());
    setActiveAccount(getActiveAccount());
    toast.success("Account removed");
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addAccount(email, password);
      setAccounts(getStoredAccounts());
      setActiveAccount(getActiveAccount());
      setAddDialogOpen(false);
      setEmail("");
      setPassword("");
      toast.success("Account added successfully");
      window.location.reload();
    } catch (error: any) {
      console.error("Failed to add account:", error);
      toast.error(error.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar
              url={activeAccount?.avatar_url}
              name={activeAccount?.display_name || activeAccount?.username || "User"}
              size={40}
            />
            {activeAccount && (
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
            )}
            {!activeAccount && (
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-gray-400 border-2 border-background" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Accounts</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => account.id !== activeAccount?.id && handleSwitchAccount(account.id)}
            >
              <Avatar
                url={account.avatar_url}
                name={account.display_name || account.username}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{account.display_name || account.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{account.username}</p>
              </div>
              {account.id === activeAccount?.id && (
                <div className="h-2 w-2 rounded-full bg-green-500" />
              )}
              {account.id !== activeAccount?.id && accounts.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAccount(account.id);
                  }}
                >
                  ×
                </Button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {accounts.length < 5 && (
            <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
              <span className="text-green-600 dark:text-green-400">+ Add Account</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Sign in with another account to add it to your switcher. Maximum 5 accounts allowed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAccount}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Password</DialogTitle>
            <DialogDescription>
              Enter your password to switch to this account. It will be saved for future use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="switch-password">Password</Label>
              <Input
                id="switch-password"
                type="password"
                placeholder="••••••••"
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSwitchWithPassword} disabled={!switchPassword}>
              Switch Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
