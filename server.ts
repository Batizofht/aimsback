import 'dotenv/config';
import app from "./app";
import http from "http";
import db from "./config/config";
import "./models/index";
import { runSeed } from "./seed";

const server = http.createServer(app);
const shouldRunBootMigrations = process.env.RUN_DB_BOOT_MIGRATIONS === 'true';

db.authenticate().then(async () => {
  console.log("Database connected successfully");

  try {
    if (shouldRunBootMigrations) {
      await db.sync({ alter: true });
      await runSeed();
    }
    console.log("Database models synchronized successfully");
  } catch (error) {
    console.error("Database sync error:", error);
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default server;