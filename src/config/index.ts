export default () => ({
  port: parseInt(process.env.PORT, 10) || 4000,
  db: {
    url: process.env.DATABASE_URL,
  },
  frontendUrl: process.env.FRONTEND_URL,
  auth: {
    secret: process.env.AUTH_SECRET,
    accessTokenTtl:
      parseInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 10) || 36000,
    refreshTokenTtl:
      parseInt(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS, 10) ||
      60 * 60 * 24 * 30,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ],
});
