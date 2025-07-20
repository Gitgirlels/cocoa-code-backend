module.exports = (sequelize, DataTypes) => {
    const Client = sequelize.define('Client', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 255]
        }
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true
        }
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: [0, 20]
        }
      }
    }, {
      tableName: 'clients',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['email']
        }
      ]
    });
  
    return Client;
  };
  