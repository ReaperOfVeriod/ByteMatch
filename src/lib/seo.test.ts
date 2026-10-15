import { afterEach, describe, expect, it } from "vitest";
import { resetConfig } from "./config";
import { breadcrumbJsonLd, DOCS_SEO, gameJsonLd, projectJsonLd, siteMetadata } from "./seo";
import { DOCS } from "./docs";

const withEnv = (vars: Record<string, string>) => {
  Object.assign(process.env, vars);
  resetConfig();
};

afterEach(() => {
  delete process.env.GOOGLE_SITE_VERIFICATION;
  delete process.env.BING_SITE_VERIFICATION;
  delete process.env.PUBLIC_URL;
  resetConfig();
});

describe("site metadata", () => {
  it("has no verification tags unless they're configured", () => {
    withEnv({ PUBLIC_URL: "https://bytematch.dev" });
    expect(siteMetadata().verification).toBeUndefined();
  });

  it("renders Google's and Bing's verification tags from the environment", () => {
    withEnv({ PUBLIC_URL: "https://bytematch.dev", GOOGLE_SITE_VERIFICATION: "g-token", BING_SITE_VERIFICATION: "b-token" });
    expect(siteMetadata().verification).toEqual({ google: "g-token", other: { "msvalidate.01": "b-token" } });
  });

  it("has search copy for every docs page the site serves", () => {
    for (const d of DOCS) expect(DOCS_SEO[d.slug], d.slug).toBeDefined();
  });
});

describe("structured data", () => {
  it("builds breadcrumbs from home, with absolute URLs", () => {
    withEnv({ PUBLIC_URL: "https://bytematch.dev" });
    expect(breadcrumbJsonLd([{ name: "Docs", path: "/docs" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ByteMatch", item: "https://bytematch.dev/" },
        { "@type": "ListItem", position: 2, name: "Docs", item: "https://bytematch.dev/docs" },
      ],
    });
  });

  it("describes a game and links its projects' datasets", () => {
    withEnv({ PUBLIC_URL: "https://bytematch.dev" });
    const ld = gameJsonLd({
      slug: "ratchet-and-clank",
      title: "Ratchet & Clank",
      year: 2002,
      platforms: ["ps2"],
      projects: [{ owner: "OpenRAC", repo: "rac1-decomp", name: "Ratchet & Clank (PAL)" }],
    });
    expect(ld).toMatchObject({
      "@type": "CollectionPage",
      about: { "@type": "VideoGame", name: "Ratchet & Clank", gamePlatform: ["PlayStation 2"], datePublished: "2002" },
      hasPart: [{ "@type": "Dataset", "@id": "https://bytematch.dev/OpenRAC/rac1-decomp#dataset" }],
    });
  });

  it("names a project dataset's creator", () => {
    withEnv({ PUBLIC_URL: "https://bytematch.dev" });
    const ld = projectJsonLd({ owner: "OpenRAC", repo: "rac1-decomp", name: "Ratchet & Clank" });
    expect(ld.creator).toEqual({ "@type": "Organization", name: "OpenRAC", url: "https://github.com/OpenRAC" });
    expect(String(ld.description).length).toBeGreaterThanOrEqual(50);
  });
});
