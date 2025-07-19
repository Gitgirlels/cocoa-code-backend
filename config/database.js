const { Sequelize } = require('sequelize');

// Railway provides DATABASE_URL for MySQL
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  // Production: Use DATABASE_URL from Railway
  console.log('🔗 Using DATABASE_URL for connection');
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    logging: false, // Set to console.log to debug if needed
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Development: Use individual environment variables
  console.log('🔗 Using individual DB variables for connection');
  sequelize = new Sequelize(
    process.env.DB_NAME || 'cocoa_code_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

module.exports = sequelize;