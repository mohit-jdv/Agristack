/** @type {import('next').NextConfig} */
const dataMode = process.env.AGRISTACK_DATA_MODE || process.env.NEXT_PUBLIC_AGRISTACK_DATA_MODE || "demo";

const nextConfig = {
  reactStrictMode: true,
  env: {
    AGRISTACK_DATA_MODE: dataMode,
    NEXT_PUBLIC_AGRISTACK_DATA_MODE: dataMode,
  },
};

export default nextConfig;
