module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    phone: {
      type: DataTypes.STRING
    }
  }, {
    timestamps: true
  });

  return Client;
};

