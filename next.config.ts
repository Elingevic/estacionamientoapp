import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: ['172.18.52.98', 'http://[IP_ADDRESS]', 'http://localhost:3001'],
};

export default nextConfig;
