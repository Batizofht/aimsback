import 'dotenv/config';
import app from "./app";
import http from "http";
import meintoyouapp from "./config/config";
import { defineAssociations } from "./models/associations";
// Import all models to ensure they are registered
import "./models/index";
import { ContactMessage, Notification, User } from "./models/index";
import { seedAdminIfNeeded } from "./utils/seedAdmin";
import { Op } from "sequelize";

const server = http.createServer(app);

// Cleanup function to mark inactive users as offline
const cleanupInactiveUsers = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const [affectedRows] = await User.update(
      { status: 'Offline' },
      {
        where: {
          status: 'Active',
          lastActiveAt: {
            [Op.lt]: fiveMinutesAgo
          }
        }
      }
    );
    
    if (affectedRows > 0) {
      console.log(`Marked ${affectedRows} inactive users as Offline`);
    }
  } catch (error) {
    console.error('Error in cleanupInactiveUsers:', error);
  }
};

/*=========================================== PROCESS MANAGEMENT CENTER NOT ROUTE MANAGEMENT CENTER   ======================================== */
meintoyouapp.authenticate().then(async () => {
    console.log("Database connected successfully");
    
    // Define model associations
    defineAssociations();
    
    // Sync database - Sequelize will handle dependency order automatically
    // First try to sync without alter (creates tables if they don't exist)
    try {
        await ContactMessage.sync({alter:true})
        await meintoyouapp.sync({ force: false });
        console.log("Database models synchronized successfully");
        await Notification.sync({alter:true})
        await seedAdminIfNeeded();
        
        // Mark all users as offline on server start
        await User.update({ status: 'Offline' }, { where: {} });
        console.log("All users marked as Offline on server start");
        
        // Start cleanup job for inactive users
        setInterval(cleanupInactiveUsers, 60000); // Run every minute
        console.log("User status cleanup job started");
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
            // Mark all users as offline even on sync error
            try {
                await User.update({ status: 'offline' }, { where: {} });
                console.log("All users marked as offline after sync error");
            } catch (userError) {
                console.error("Error marking users offline:", userError);
            }
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

