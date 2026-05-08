module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes('admin_roles')) {
      await queryInterface.createTable('admin_roles', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        adminId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'admins',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        roleId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'roles',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        assignedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'admins',
            key: 'id',
          },
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      
      // Add unique index on adminId + roleId
      await queryInterface.addIndex('admin_roles', ['adminId', 'roleId'], {
        unique: true,
        name: 'admin_roles_adminId_roleId_unique'
      });
      
      console.log('Created admin_roles table');
    } else {
      console.log('admin_roles table already exists, skipping...');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('admin_roles');
  }
};
