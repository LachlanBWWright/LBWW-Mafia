export default {
  schema: "./prisma/schema.prisma",
  db: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrate: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
};
