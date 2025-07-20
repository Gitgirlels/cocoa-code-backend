const { Sequelize } = require('sequelize');

// Railway MySQL connection
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  console.log('🔗 Using DATABASE_URL for Railway MySQL');
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /EHOSTDOWN/,
        /ENETDOWN/,
        /ENETUNREACH/,
        /EAI_AGAIN/
      ],
      max: 3
    }
  });
} else {
  console.log('🔗 Using individual DB variables for local development');
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
