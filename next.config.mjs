/**
 * Static export so the app can be hosted on GitHub Pages (or any static host).
 * NEXT_PUBLIC_BASE_PATH is set by the Pages workflow to "/<repo-name>"; leave it
 * empty for local dev or hosting at a domain root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
    experimental: {
        optimizePackageImports: ["@untitledui/icons"],
    },
};

export default nextConfig;
