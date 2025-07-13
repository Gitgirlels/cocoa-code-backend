// models/Payment.js
module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define('Payment', {
      projectId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      paymentMethod: {
        type: DataTypes.ENUM('stripe', 'paypal', 'afterpay'),
        allowNull: false
      },
      paymentStatus: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      stripePaymentId: {
        type: DataTypes.STRING
      }
    }, {
      timestamps: true
    });
  
    return Payment;
  };
  