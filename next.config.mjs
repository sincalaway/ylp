/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  outputFileTracingIncludes: { '/*': ['./content/**/*'] }
}
export default nextConfig
