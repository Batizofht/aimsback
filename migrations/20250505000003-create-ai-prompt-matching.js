module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes('ai_prompt_matching')) {
      await queryInterface.createTable('ai_prompt_matching', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        prompt: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        isEnabled: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        lastUpdated: {
          type: Sequelize.DATE,
          allowNull: true,
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
      console.log('Created ai_prompt_matching table');
    } else {
      console.log('ai_prompt_matching table already exists, skipping...');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_prompt_matching');
  }
};
