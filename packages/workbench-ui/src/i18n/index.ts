import type { I18nResourceBundle } from "@ai-agent-workflow/i18n";
import { workbenchEnUs } from "./en-US";
import { workbenchZhCn } from "./zh-CN";

export const WORKBENCH_I18N_NAMESPACE = "workbench";

export const workbenchI18nResources: I18nResourceBundle<typeof WORKBENCH_I18N_NAMESPACE>[] = [
  {
    namespace: WORKBENCH_I18N_NAMESPACE,
    resources: {
      "en-US": workbenchEnUs,
      "zh-CN": workbenchZhCn,
    },
  },
];
