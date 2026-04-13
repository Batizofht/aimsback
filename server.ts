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
    
    // Define model associations first
    defineAssociations();
    
    // Step 1: Sync all tables first (creates them if they don't exist)
    try {
        await meintoyouapp.sync({ force: false, alter: true });
        console.log("Database models synchronized successfully");
    } catch (syncError) {
        console.error("Database sync error:", syncError);
    }
    
    // Step 2: Now run ALTER queries to add columns (tables exist now)
    try {
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INTEGER NULL;');
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"hasKids\" BOOLEAN NULL;");
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"wantsKids\" BOOLEAN NULL;");
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS relationshipStatus VARCHAR(50) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS smoking VARCHAR(30) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS drinking VARCHAR(30) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS exercise VARCHAR(30) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(120) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(120) NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT NULL;');
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS religion VARCHAR(120) NULL;');
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"showReligion\" BOOLEAN DEFAULT TRUE;");
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"pets_dogs\" BOOLEAN NULL;");
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"pets_cats\" BOOLEAN NULL;");
        await meintoyouapp.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"pets_other\" BOOLEAN NULL;");
        await meintoyouapp.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS loveLanguages TEXT NULL;');
        console.log("User columns ensured");
    } catch (alterError) {
        console.error("Error adding columns:", alterError);
    }
    
    // Step 3: Sync ContactMessage and Notification with alter
    try {
        await ContactMessage.sync({ alter: true });
        await Notification.sync({ alter: true });
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
                await User.update({ status: 'Offline' }, { where: {} });
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

