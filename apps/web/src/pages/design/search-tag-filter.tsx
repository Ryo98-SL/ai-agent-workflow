import { ThemeProvider } from "@ai-agent-workflow/workbench-ui";
import { SearchTagFilterGallery } from "../../homepage/SearchTagFilterGallery";

export default function SearchTagFilterDesignPage() {
  return (
    <ThemeProvider>
      <SearchTagFilterGallery />
    </ThemeProvider>
  );
}
