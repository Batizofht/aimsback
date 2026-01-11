import 'dotenv/config';
import app from "./app";
import http from "http";
import meintoyouapp from "./config/config";
import { defineAssociations } from "./models/associations";
// Import all models to ensure they are registered
import "./models/index";
import { Notification } from "./models/index";
import { seedAdminIfNeeded } from "./utils/seedAdmin";

const server = http.createServer(app);

/*=========================================== PROCESS MANAGEMENT CENTER NOT ROUTE MANAGEMENT CENTER   ======================================== */
meintoyouapp.authenticate().then(async () => {
    console.log("Database connected successfully");
    
    // Define model associations
    defineAssociations();
    
    // Sync database - Sequelize will handle dependency order automatically
    // First try to sync without alter (creates tables if they don't exist)
    try {
        await meintoyouapp.sync({ force: false });
        console.log("Database models synchronized successfully");
        await Notification.sync({alter:true})
        await seedAdminIfNeeded();
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Database sync error:", err.message);
        // If sync fails, try with alter to update existing tables
        try {
            await meintoyouapp.sync({ alter: true });
            console.log("Database models updated successfully");
            await seedAdminIfNeeded();
        } catch (syncError: unknown) {
            const syncErr = syncError as Error;
            console.error("Database update error:", syncErr.message);
        }
    }
}).catch((error: unknown) => {
    const err = error as Error;
    console.error("Database connection error:", err.message);
});

const PORT = process.env.PORT || 4001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

