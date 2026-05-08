module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (table, column) => {
      const columns = await queryInterface.describeTable(table);
      return columns.hasOwnProperty(column);
    };

    // Add new columns to users table if they don't exist
    try {
      if (!(await columnExists('users', 'prompt'))) {
        await queryInterface.addColumn('users', 'prompt', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
        console.log('Added prompt column to users');
      }
    } catch (e) {
      console.log('prompt column may already exist:', e.message);
    }

    try {
      if (!(await columnExists('users', 'loveLanguages'))) {
        await queryInterface.addColumn('users', 'loveLanguages', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
        console.log('Added loveLanguages column to users');
      }
    } catch (e) {
      console.log('loveLanguages column may already exist:', e.message);
    }

    // Add notifications table columns if table exists
    try {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('notifications')) {
        if (!(await columnExists('notifications', 'title'))) {
          await queryInterface.addColumn('notifications', 'title', {
            type: Sequelize.STRING(255),
            allowNull: true,
          });
          console.log('Added title column to notifications');
        }
      }
    } catch (e) {
      console.log('notifications columns:', e.message);
    }

    console.log('Column migration completed');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    try {
      await queryInterface.removeColumn('users', 'prompt');
    } catch (e) {
      console.log('Error removing prompt column:', e.message);
    }
    
    try {
      await queryInterface.removeColumn('users', 'loveLanguages');
    } catch (e) {
      console.log('Error removing loveLanguages column:', e.message);
    }
  }
};
