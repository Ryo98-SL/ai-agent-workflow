import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { WorkbenchWorkflowApi } from "../workbench/types";
import { createWorkbenchAuthClient, type WorkbenchAuthClient } from "./authClient";

type WorkbenchDataValue = {
  workflowApi: WorkbenchWorkflowApi;
  authClient: WorkbenchAuthClient;
  /** Bumped to ask AppWorkbench to re-list workflows (e.g. after import). */
  workflowRefreshNonce: number;
  requestWorkflowRefresh: () => void;
};

const WorkbenchDataContext = createContext<WorkbenchDataValue | null>(null);

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export type WorkbenchDataProviderProps = {
  workflowApi: WorkbenchWorkflowApi;
  apiBaseUrl: string;
  children: ReactNode;
};

export function WorkbenchDataProvider({ workflowApi, apiBaseUrl, children }: WorkbenchDataProviderProps) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const authClient = useMemo(() => createWorkbenchAuthClient(apiBaseUrl), [apiBaseUrl]);
  const [workflowRefreshNonce, setWorkflowRefreshNonce] = useState(0);
  const requestWorkflowRefresh = useCallback(() => setWorkflowRefreshNonce((n) => n + 1), []);
  const value = useMemo<WorkbenchDataValue>(
    () => ({ workflowApi, authClient, workflowRefreshNonce, requestWorkflowRefresh }),
    [workflowApi, authClient, workflowRefreshNonce, requestWorkflowRefresh],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WorkbenchDataContext.Provider value={value}>{children}</WorkbenchDataContext.Provider>
    </QueryClientProvider>
  );
}

export function useWorkbenchData(): WorkbenchDataValue {
  const value = useContext(WorkbenchDataContext);
  if (!value) {
    throw new Error("useWorkbenchData must be used within a WorkbenchDataProvider.");
  }
  return value;
}

export function useWorkbenchAuthClient(): WorkbenchAuthClient {
  return useWorkbenchData().authClient;
}
