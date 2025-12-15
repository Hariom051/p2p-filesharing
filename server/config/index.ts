export const app = {
  dbUrl: process.env["DB_URL"],
  allowedOrigins:
    process.env["IS_PRODUCTION"] === "true"
      ? ["xerrasend.onrender.app"]
      : ["http://localhost:3000"],
};
