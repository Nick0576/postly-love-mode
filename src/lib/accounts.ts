import { supabase } from "@/integrations/supabase/client";

const ACCOUNTS_KEY = "postly-accounts";
const ACTIVE_ACCOUNT_KEY = "postly-active-account";

export interface StoredAccount {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

export function getStoredAccounts(): StoredAccount[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStoredAccounts(accounts: StoredAccount[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getActiveAccountId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function setActiveAccountId(accountId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
}

export async function addAccount(email: string, password: string): Promise<StoredAccount> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  const session = data.session;
  if (!session) throw new Error("No session returned");

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,username,avatar_url")
    .eq("id", session.user.id)
    .maybeSingle();

  const account: StoredAccount = {
    id: session.user.id,
    email: session.user.email || email,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    display_name: profile?.display_name || "",
    username: profile?.username || "",
    avatar_url: profile?.avatar_url ?? null,
  };

  const accounts = getStoredAccounts();
  if (accounts.length >= 5) {
    throw new Error("Maximum 5 accounts allowed");
  }

  // Check if account already exists
  if (accounts.some(a => a.id === account.id)) {
    throw new Error("Account already added");
  }

  accounts.push(account);
  saveStoredAccounts(accounts);
  setActiveAccountId(account.id);
  
  return account;
}

export async function switchAccount(accountId: string): Promise<void> {
  const accounts = getStoredAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) throw new Error("Account not found");

  // Sign out current session
  await supabase.auth.signOut();

  // Set new session
  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  if (error) throw error;

  setActiveAccountId(accountId);
}

export function removeAccount(accountId: string): void {
  const accounts = getStoredAccounts();
  const filtered = accounts.filter(a => a.id !== accountId);
  saveStoredAccounts(filtered);

  // If removing active account, clear active
  if (getActiveAccountId() === accountId) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

export function getActiveAccount(): StoredAccount | null {
  const activeId = getActiveAccountId();
  if (!activeId) return null;
  const accounts = getStoredAccounts();
  return accounts.find(a => a.id === activeId) || null;
}

export async function updateAccountProfile(accountId: string): Promise<void> {
  const accounts = getStoredAccounts();
  const index = accounts.findIndex(a => a.id === accountId);
  if (index === -1) return;

  // Temporarily switch to this account to get profile
  const account = accounts[index];
  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  if (!error) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,username,avatar_url")
      .eq("id", accountId)
      .maybeSingle();

    if (profile) {
      accounts[index] = {
        ...accounts[index],
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
      };
      saveStoredAccounts(accounts);
    }
  }
}
