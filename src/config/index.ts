export default () => ({
  port: parseInt(process.env.PORT, 10) || 4000,
  db: {
    url: process.env.DATABASE_URL,
  },
  frontendUrl: process.env.FRONTEND_URL,
  jwtSecret: process.env.AUTH_SECRET,
  allowedOrigins: ['http://localhost:3000'],
});
