import { useMemo } from "react";
import type { WorkbenchWorkflowApi } from "../workbench/types";
import { useWorkbenchData } from "./WorkbenchDataProvider";
import { useSession } from "./useAccount";
import { createLocalWorkflowApi } from "./localWorkflowStore";

const localWorkflowApiCache = new WeakMap<WorkbenchWorkflowApi, WorkbenchWorkflowApi>();

function getLocalWorkflowApi(serverApi: WorkbenchWorkflowApi): WorkbenchWorkflowApi {
  const cached = localWorkflowApiCache.get(serverApi);
  if (cached) {
    return cached;
  }
  const localApi = createLocalWorkflowApi(serverApi);
  localWorkflowApiCache.set(serverApi, localApi);
  return localApi;
}

/**
 * Returns the workflow API matching the current auth state: the server-backed
 * client when signed in, a localStorage-backed adapter when anonymous. The
 * identity changes when auth flips, which triggers AppWorkbench to reload from
 * the new source.
 */
export function useActiveWorkflowApi(): WorkbenchWorkflowApi {
  const { workflowApi } = useWorkbenchData();
  const { data } = useSession();
  const isAuthed = Boolean(data?.user);

  return useMemo(
    () => (isAuthed ? workflowApi : getLocalWorkflowApi(workflowApi)),
    [isAuthed, workflowApi],
  );
}
