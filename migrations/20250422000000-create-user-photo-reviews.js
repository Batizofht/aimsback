module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if UserPhotoReviews table exists
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes('UserPhotoReviews')) {
      await queryInterface.createTable('UserPhotoReviews', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        photoRejectReason: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        photoSubmittedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        photoReviewedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        rejectionNotifiedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        photoReviewerId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        heldNotifications: {
          type: Sequelize.JSON,
          defaultValue: [],
        },
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
      });

      await queryInterface.addIndex('UserPhotoReviews', ['userId']);
      await queryInterface.addIndex('UserPhotoReviews', ['photoSubmittedAt']);
    }

    // Check if photoStatus column exists
    const columns = await queryInterface.describeTable('users');
    if (!columns.photostatus && !columns.photoStatus) {
      await queryInterface.addColumn('users', 'photoStatus', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      });

      // Migrate existing users with photos to approved
      await queryInterface.sequelize.query(
        `UPDATE users SET "photoStatus" = 'approved' WHERE profile IS NOT NULL`
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('users');
    if (columns.photostatus || columns.photoStatus) {
      await queryInterface.removeColumn('users', 'photoStatus');
    }
    const tables = await queryInterface.showAllTables();
    if (tables.includes('UserPhotoReviews')) {
      await queryInterface.dropTable('UserPhotoReviews');
    }
  },
};
