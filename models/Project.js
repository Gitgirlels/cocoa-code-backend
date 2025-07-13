module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    projectType: {
      type: DataTypes.ENUM('landing', 'business', 'ecommerce', 'webapp', 'custom'),
      allowNull: false
    },
    specifications: {
      type: DataTypes.TEXT
    },
    websiteType: {
      type: DataTypes.STRING
    },
    primaryColor: {
      type: DataTypes.STRING(7)
    },
    secondaryColor: {
      type: DataTypes.STRING(7)
    },
    accentColor: {
      type: DataTypes.STRING(7)
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2)
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2)
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    bookingMonth: {
      type: DataTypes.STRING
    }
  }, {
    timestamps: true
  });

  return Project;
};
