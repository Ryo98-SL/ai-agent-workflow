import { createElement, type ComponentType } from "react";
import type { RouteObject } from "react-router-dom";

/**
 * Convention-based routing. Every `src/pages/**\/*.tsx` file that default-exports
 * a component becomes a route — no central registration to keep in sync.
 *
 * File → path mapping:
 *   pages/index.tsx                  → /
 *   pages/design/workflow-list.tsx   → /design/workflow-list
 *   pages/design/[id].tsx            → /design/:id   (bracket = dynamic segment)
 */
const modules = import.meta.glob<{ default: ComponentType }>("./pages/**/*.tsx", { eager: true });

function fileToPath(file: string): string {
  const path = file
    .replace(/^\.\/pages/, "")
    .replace(/\.tsx$/, "")
    .replace(/\/index$/, "")
    .replace(/\[([^\]]+)\]/g, ":$1"); // [id] → :id
  return path === "" ? "/" : path;
}

export const routes: RouteObject[] = Object.entries(modules)
  .filter(([, mod]) => Boolean(mod.default))
  .map(([file, mod]) => ({ path: fileToPath(file), element: createElement(mod.default) }));
