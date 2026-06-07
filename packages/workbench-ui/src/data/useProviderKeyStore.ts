import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCreateProviderKey, useDeleteProviderKey, useProviderKeys, useSession } from "./useAccount";

/** A stored key as surfaced to the UI — never carries the plaintext secret. */
export type ProviderKeyEntry = {
  id: string;
  provider: string;
  label: string;
  last4: string;
};

export type ProviderKeyStore = {
  /** All stored keys for the current actor (server-backed or in-memory). */
  keys: ProviderKeyEntry[];
  /** Keys scoped to a single provider. */
  keysForProvider: (provider: string) => ProviderKeyEntry[];
  createKey: (input: { provider: string; label: string; apiKey: string }) => Promise<ProviderKeyEntry>;
  deleteKey: (id: string) => Promise<void>;
  /**
   * Anonymous-only: the plaintext key for run-time injection. Returns undefined
   * for authed users (the server resolves their keys by id) and unknown ids.
   */
  getApiKey: (id: string) => string | undefined;
  isLoading: boolean;
  isMutating: boolean;
  /** True when keys persist server-side; false for the in-memory anon store. */
  isPersisted: boolean;
  isAnon: boolean;
};

// ---------------------------------------------------------------------------
// Anonymous in-memory store. Plaintext keys live here for the session only and
// are intentionally never persisted to localStorage or the workflow file.
// ---------------------------------------------------------------------------

type AnonKeyRecord = ProviderKeyEntry & { apiKey: string };

let anonKeys: AnonKeyRecord[] = [];
const anonListeners = new Set<() => void>();

function emitAnonChange() {
  for (const listener of anonListeners) {
    listener();
  }
}

function subscribeAnon(listener: () => void) {
  anonListeners.add(listener);
  return () => {
    anonListeners.delete(listener);
  };
}

function getAnonSnapshot() {
  return anonKeys;
}

function last4Of(apiKey: string) {
  return apiKey.slice(-4) || apiKey;
}

function randomId() {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripSecret(record: AnonKeyRecord): ProviderKeyEntry {
  return { id: record.id, provider: record.provider, label: record.label, last4: record.last4 };
}

/**
 * Unified provider-key access. Authenticated users read/write encrypted keys on
 * the server; anonymous users get an in-memory store (lost on reload) so the
 * same multi-key UI works without an account.
 */
export function useProviderKeyStore(): ProviderKeyStore {
  const { data: session } = useSession();
  const isAnon = !session?.user;

  const serverQuery = useProviderKeys();
  const createServerKey = useCreateProviderKey();
  const deleteServerKey = useDeleteProviderKey();

  const anonSnapshot = useSyncExternalStore(subscribeAnon, getAnonSnapshot, getAnonSnapshot);

  const keys = useMemo<ProviderKeyEntry[]>(() => {
    if (isAnon) {
      return anonSnapshot.map(stripSecret);
    }
    return (serverQuery.data?.keys ?? []).map((key) => ({
      id: key.id,
      provider: key.provider,
      label: key.label,
      last4: key.last4,
    }));
  }, [isAnon, anonSnapshot, serverQuery.data]);

  const keysForProvider = useCallback(
    (provider: string) => keys.filter((key) => key.provider === provider),
    [keys],
  );

  const createKey = useCallback<ProviderKeyStore["createKey"]>(
    async ({ provider, label, apiKey }) => {
      if (isAnon) {
        const entry: AnonKeyRecord = { id: randomId(), provider, label, last4: last4Of(apiKey), apiKey };
        anonKeys = [...anonKeys, entry];
        emitAnonChange();
        return stripSecret(entry);
      }
      const { key } = await createServerKey.mutateAsync({ provider, label, apiKey });
      return { id: key.id, provider: key.provider, label: key.label, last4: key.last4 };
    },
    [isAnon, createServerKey],
  );

  const deleteKey = useCallback<ProviderKeyStore["deleteKey"]>(
    async (id) => {
      if (isAnon) {
        anonKeys = anonKeys.filter((key) => key.id !== id);
        emitAnonChange();
        return;
      }
      await deleteServerKey.mutateAsync(id);
    },
    [isAnon, deleteServerKey],
  );

  const getApiKey = useCallback(
    (id: string) => (isAnon ? anonSnapshot.find((key) => key.id === id)?.apiKey : undefined),
    [isAnon, anonSnapshot],
  );

  return {
    keys,
    keysForProvider,
    createKey,
    deleteKey,
    getApiKey,
    isLoading: isAnon ? false : serverQuery.isLoading,
    isMutating: createServerKey.isPending || deleteServerKey.isPending,
    isPersisted: !isAnon,
    isAnon,
  };
}
