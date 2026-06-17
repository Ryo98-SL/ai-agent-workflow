import { ThemeProvider } from "@workbench/theme/ThemeProvider";
import { DifyStyleStudioHome } from "./DifyStyleStudioHome";

export function HomePageDesignGallery() {
  return (
    <ThemeProvider>
      <DifyStyleStudioHome />
    </ThemeProvider>
  );
}
