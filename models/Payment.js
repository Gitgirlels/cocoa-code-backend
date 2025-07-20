module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define('Payment', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      projectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id'
        }
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      paymentMethod: {
        type: DataTypes.ENUM('stripe', 'paypal', 'afterpay', 'credit'),
        allowNull: false
      },
      paymentStatus: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending'
      },
      stripePaymentId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      transactionReference: {
        type: DataTypes.STRING,
        allowNull: true
      }
    }, {
      tableName: 'payments',
      timestamps: true,
      indexes: [
        {
          fields: ['projectId']
        },
        {
          fields: ['paymentStatus']
        }
      ]
    });
  
    return Payment;
  };
  