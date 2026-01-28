/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    SSO_BASE_URL: process.env.SSO_BASE_URL,
    CLIENT_ID: process.env.CLIENT_ID,
  },
};

module.exports = nextConfig;
