import { noindexMetadata } from "@/lib/seo";

/** Private pages: kept out of search engines. */
export const metadata = noindexMetadata();

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
