import { RuntimeValidationError } from "../errors";
import type { ToolRuntime } from "./types";

/** Built-in: current date/time formatted in a timezone. */
export const currentTimeRuntime: ToolRuntime = {
  provider: "builtin",
  providerId: "builtin",
  toolName: "currentTime",
  execute(params) {
    const timeZone = (typeof params.timezone === "string" && params.timezone) || "UTC";
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());
    } catch {
      throw new RuntimeValidationError(`Current Time tool has an invalid timezone "${timeZone}".`);
    }
    return {
      output: formatted,
      data: { timezone: timeZone, iso: new Date().toISOString(), formatted },
      logMetadata: { timezone: timeZone },
    };
  },
};
