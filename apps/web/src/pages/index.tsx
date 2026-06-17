import { ProductHomepage } from "../homepage/ProductHomepage";
import { apiBaseUrl, workflowApi } from "../lib/workflowApi";

export default function HomePage() {
  return <ProductHomepage workflowApi={workflowApi} apiBaseUrl={apiBaseUrl} />;
}
