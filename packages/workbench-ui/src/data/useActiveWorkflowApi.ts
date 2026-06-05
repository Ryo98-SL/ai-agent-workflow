import { useMemo } from "react";
import type { WorkbenchWorkflowApi } from "../workbench/types";
import { useWorkbenchData } from "./WorkbenchDataProvider";
import { useSession } from "./useAccount";
import { createLocalWorkflowApi } from "./localWorkflowStore";

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
    () => (isAuthed ? workflowApi : createLocalWorkflowApi(workflowApi)),
    [isAuthed, workflowApi],
  );
}
