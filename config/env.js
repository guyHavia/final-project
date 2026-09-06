import 'dotenv/config';

/** All process configuration, read once. See .env.example. */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/the-daily-web',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
  weatherApiKey: process.env.WEATHER_API_KEY,
  weatherCity: process.env.WEATHER_CITY ?? 'Tel Aviv,IL',
};
