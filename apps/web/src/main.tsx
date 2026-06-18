import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { I18nProvider } from "@ai-agent-workflow/i18n";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";
import { appI18nResources, WEB_I18N_NAMESPACE } from "./i18n";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider resources={appI18nResources} defaultNamespace={WEB_I18N_NAMESPACE}>
      <RouterProvider router={router} />
    </I18nProvider>
  </React.StrictMode>,
);
