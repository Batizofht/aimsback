module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('admins');
    
    // Add f_name column if it doesn't exist
    if (!tableInfo.f_name) {
      await queryInterface.addColumn('admins', 'f_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      console.log('Added f_name column to admins table');
    }
    
    // Add l_name column if it doesn't exist
    if (!tableInfo.l_name) {
      await queryInterface.addColumn('admins', 'l_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      console.log('Added l_name column to admins table');
    }
    
    // Add isSuperAdmin column if it doesn't exist
    if (!tableInfo.isSuperAdmin) {
      await queryInterface.addColumn('admins', 'isSuperAdmin', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log('Added isSuperAdmin column to admins table');
    }
    
    // Add isActive column if it doesn't exist
    if (!tableInfo.isActive) {
      await queryInterface.addColumn('admins', 'isActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      console.log('Added isActive column to admins table');
    }
    
    // Add lastLoginAt column if it doesn't exist
    if (!tableInfo.lastLoginAt) {
      await queryInterface.addColumn('admins', 'lastLoginAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      console.log('Added lastLoginAt column to admins table');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('admins', 'f_name');
    await queryInterface.removeColumn('admins', 'l_name');
    await queryInterface.removeColumn('admins', 'isSuperAdmin');
    await queryInterface.removeColumn('admins', 'isActive');
    await queryInterface.removeColumn('admins', 'lastLoginAt');
  }
};
