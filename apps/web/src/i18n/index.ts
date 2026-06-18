import type { I18nResourceBundle } from "@ai-agent-workflow/i18n";
import { workbenchI18nResources } from "@ai-agent-workflow/workbench-ui";
import { webEnUs } from "./en-US";
import { webZhCn } from "./zh-CN";

export const WEB_I18N_NAMESPACE = "web";

export const webI18nResources: I18nResourceBundle<typeof WEB_I18N_NAMESPACE>[] = [
  {
    namespace: WEB_I18N_NAMESPACE,
    resources: {
      "en-US": webEnUs,
      "zh-CN": webZhCn,
    },
  },
];

export const appI18nResources: I18nResourceBundle[] = [...webI18nResources, ...workbenchI18nResources];
