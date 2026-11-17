import { ProductFactsPage } from "@/components/sections/markets/product-facts-page";
import { productFactsMetadata } from "@/lib/product-facts-seo";

export const metadata = productFactsMetadata("en");

export default function Page() {
  return <ProductFactsPage />;
}
