/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Native or Postgres-bound packages stay plain Node requires instead of being bundled.
  serverExternalPackages: ["@resvg/resvg-js", "pg-boss", "postgres"],
  // Badge text is measured and drawn with these fonts at run time.
  outputFileTracingIncludes: { "/api/compat/**": ["./src/assets/fonts/**"] },
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
