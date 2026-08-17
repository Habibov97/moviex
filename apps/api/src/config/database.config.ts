import { registerAs } from '@nestjs/config';

export default registerAs('db', () => ({
  dbUrl: process.env.DATABASE_URL,
}));
