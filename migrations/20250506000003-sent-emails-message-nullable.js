module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("sent_emails", "message", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("sent_emails", "message", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },
};
