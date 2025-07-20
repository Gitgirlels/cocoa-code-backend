module.exports = (sequelize, DataTypes) => {
    const Project = sequelize.define('Project', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      clientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'clients',
          key: 'id'
        }
      },
      projectType: {
        type: DataTypes.ENUM('landing', 'business', 'ecommerce', 'webapp', 'custom', 'service-only'),
        allowNull: false,
        defaultValue: 'custom'
      },
      specifications: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      websiteType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      primaryColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        validate: {
          is: /^#[0-9A-Fa-f]{6}$/i
        }
      },
      secondaryColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        validate: {
          is: /^#[0-9A-Fa-f]{6}$/i
        }
      },
      accentColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        validate: {
          is: /^#[0-9A-Fa-f]{6}$/i
        }
      },
      basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      totalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'pending'
      },
      bookingMonth: {
        type: DataTypes.STRING,
        allowNull: true
      }
    }, {
      tableName: 'projects',
      timestamps: true,
      indexes: [
        {
          fields: ['clientId']
        },
        {
          fields: ['status']
        },
        {
          fields: ['bookingMonth']
        }
      ]
    });
  
    return Project;
  };
  