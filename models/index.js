const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// Import models
const Client = require('./Client')(sequelize, DataTypes);
const Project = require('./Project')(sequelize, DataTypes);
const Payment = require('./Payment')(sequelize, DataTypes);

// Define associations
Client.hasMany(Project, { 
  foreignKey: 'clientId', 
  onDelete: 'CASCADE',
  as: 'projects'
});

Project.belongsTo(Client, { 
  foreignKey: 'clientId',
  as: 'client'
});

Project.hasMany(Payment, { 
  foreignKey: 'projectId', 
  onDelete: 'CASCADE',
  as: 'payments'
});

Payment.belongsTo(Project, { 
  foreignKey: 'projectId',
  as: 'project'
});

module.exports = {
  sequelize,
  Client,
  Project,
  Payment
};