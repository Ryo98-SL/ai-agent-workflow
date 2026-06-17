import { createAuthClient } from "better-auth/react";

export type WorkbenchAuthClient = ReturnType<typeof createAuthClient>;

/**
 * Better Auth browser client. `baseURL` is the auth/api server origin; the
 * client appends the default `/api/auth` base path. Requests are sent with
 * credentials so the cross-origin session cookie is included.
 */
export function createWorkbenchAuthClient(baseURL: string): WorkbenchAuthClient {
  return createAuthClient({
    baseURL,
    sessionOptions: {
      refetchOnWindowFocus: false,
    },
    fetchOptions: {
      credentials: "include",
    },
  });
}
