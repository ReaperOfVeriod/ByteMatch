import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// PUBLIC_URL is read at request time, not baked in at build. "/manage$" + "/manage/" rather than a bare
// "/manage" prefix, which would also block project owners whose names start with "manage".
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = config().PUBLIC_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/manage$", "/manage/", "/api/", "/auth/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
