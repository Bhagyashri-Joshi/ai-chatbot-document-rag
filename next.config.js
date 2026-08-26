/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // File uploads are handled with formidable via the raw request stream,
  // so the default body parser must be disabled on the upload route
  // (see pages/api/documents/upload.js -> export const config).
};

module.exports = nextConfig;
