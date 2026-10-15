/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Native or Postgres-bound packages stay plain Node requires instead of being bundled.
  serverExternalPackages: ["@resvg/resvg-js", "pg-boss", "postgres"],
  // Badge text is measured and drawn with these fonts at run time.
  outputFileTracingIncludes: {
    "/api/compat/**": ["./src/assets/fonts/**"],
    "/docs/**": ["./docs/**", "./CONTRIBUTING.md"],
    "/sitemap.xml": ["./docs/**", "./CONTRIBUTING.md"],
    "/opengraph-image": ["./node_modules/geist/dist/fonts/geist-sans/*.ttf", "./node_modules/geist/dist/fonts/geist-mono/*.ttf"],
    "/[owner]/[repo]/opengraph-image": [
      "./node_modules/geist/dist/fonts/geist-sans/*.ttf",
      "./node_modules/geist/dist/fonts/geist-mono/*.ttf",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
