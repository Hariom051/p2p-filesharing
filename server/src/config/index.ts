export const app = {
  dbUrl: process.env["DB_URL"],
  allowedOrigins:
    process.env["IS_PRODUCTION"] === "true"
      ? ["xerrasend.vercel.app"]
      : ["http://localhost:3000"],
};
