module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("notification_campaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(250),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("push", "email", "both"),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("draft", "scheduled", "sending", "sent", "failed"),
        allowNull: false,
        defaultValue: "draft",
      },
      recipientType: {
        type: Sequelize.ENUM("all", "verified", "premium", "free", "specific"),
        allowNull: false,
        defaultValue: "all",
      },
      recipientCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      scheduledAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "admin",
      },
      createdById: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      sentCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      specificUserIds: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("notification_campaigns");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_campaigns_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_campaigns_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_campaigns_recipientType";');
  },
};
