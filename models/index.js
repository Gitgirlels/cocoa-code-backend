const sequelize = require('../config/database'); // ✅ Import sequelize instance
const { DataTypes } = require('sequelize');

// Import models
const Client = require('./Client')(sequelize, DataTypes);
const Project = require('./Project')(sequelize, DataTypes);
const Payment = require('./Payment')(sequelize, DataTypes); // ✅ Add this line

// Define associations
Client.hasMany(Project, { foreignKey: 'clientId', onDelete: 'CASCADE' });
Project.belongsTo(Client, { foreignKey: 'clientId' });

// ✅ Define Payment associations
Project.hasOne(Payment, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Payment.belongsTo(Project, { foreignKey: 'projectId' });

module.exports = {
  sequelize,
  Client,
  Project,
  Payment // ✅ Add this to the exports
};
