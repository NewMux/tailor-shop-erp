import { authApi } from "@/lib/auth";
import { getPasswordResetToken } from "@/lib/authCallback";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

type CachedUser = { id: number; name: string | null; email: string | null; role: "user" | "admin" };
const CACHED_USER_KEY = "al-hussam-erp-last-user";

function readCachedUser(): CachedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CachedUser>;
    if (typeof value.id !== "number" || (value.role !== "user" && value.role !== "admin")) return null;
    return { id: value.id, name: typeof value.name === "string" ? value.name : null, email: typeof value.email === "string" ? value.email : null, role: value.role };
  } catch {
    return null;
  }
}

function clearCachedUser() {
  try { window.localStorage.removeItem(CACHED_USER_KEY); } catch { /* Ignore storage failures during auth transitions. */ }
}

export function useAuth() {
  const utils = trpc.useUtils();
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<CachedUser | null>(() => readCachedUser());

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hasSession === true && !recoveryMode,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refreshSession = useCallback(async () => {
    try {
      const authenticated = await authApi.session();
      setHasSession(authenticated);
      if (!authenticated) {
        setCachedUser(null);
        clearCachedUser();
        utils.auth.me.setData(undefined, null);
      }
    } catch {
      setHasSession(false);
    }
  }, [utils]);

  useEffect(() => {
    let active = true;
    const token = getPasswordResetToken(window.location.search);
    if (token) {
      setResetToken(token);
      setRecoveryMode(true);
      setHasSession(false);
    } else {
      void refreshSession();
    }

    const handleAuthChanged = () => {
      if (active) void refreshSession().then(() => utils.auth.me.invalidate());
    };
    window.addEventListener("auth-changed", handleAuthChanged);
    return () => {
      active = false;
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, [refreshSession, utils]);

  useEffect(() => {
    if (!meQuery.data) return;
    const nextUser: CachedUser = { id: meQuery.data.id, name: meQuery.data.name, email: meQuery.data.email, role: meQuery.data.role };
    setCachedUser(nextUser);
    try { window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(nextUser)); } catch { /* Offline storage may be unavailable. */ }
  }, [meQuery.data]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
      setHasSession(false);
      setCachedUser(null);
      clearCachedUser();
      utils.auth.me.setData(undefined, null);
    } finally {
      setLoggingOut(false);
    }
  }, [utils]);

  const completeRecovery = useCallback(async () => {
    setRecoveryMode(false);
    setResetToken(null);
    setCallbackError(null);
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.hash}`);
    setHasSession(true);
    await utils.auth.me.invalidate();
  }, [utils]);

  const offlineFallback = typeof navigator !== "undefined" && !navigator.onLine && meQuery.isError ? cachedUser : null;
  const effectiveUser = meQuery.data ?? offlineFallback;
  const state = useMemo(
    () => ({
      user: effectiveUser,
      loading: hasSession === null || (hasSession === true && meQuery.isLoading) || loggingOut,
      error: meQuery.error ?? null,
      isAuthenticated: hasSession === true && Boolean(effectiveUser),
    }),
    [effectiveUser, hasSession, meQuery.error, meQuery.isLoading, loggingOut]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    callbackError,
    recoveryMode,
    resetToken,
    completeRecovery,
  };
}
