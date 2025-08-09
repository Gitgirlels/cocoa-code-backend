// FIXED VERSION: config/database.js
// This fixes the Railway MySQL connection issues

const { Sequelize } = require('sequelize');

// Railway MySQL connection with enhanced error handling
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
      connectTimeout: 120000,  // ✅ INCREASED: 2 minutes
      acquireTimeout: 120000,  // ✅ INCREASED: 2 minutes
      timeout: 120000,         // ✅ INCREASED: 2 minutes
      // ✅ ADD: IPv6 support for Railway
      family: 0  
    },
    pool: {
      max: 10,          // ✅ INCREASED: More connections
      min: 2,           // ✅ INCREASED: Keep minimum connections alive
      acquire: 120000,  // ✅ INCREASED: 2 minutes to get connection
      idle: 30000,      // ✅ DECREASED: Close idle connections faster
      evict: 10000,     // ✅ ADD: Check for idle connections every 10s
      handleDisconnects: true,  // ✅ ADD: Auto-reconnect
      validate: true    // ✅ ADD: Validate connections
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
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 5  // ✅ INCREASED: More retry attempts
    },
    // ✅ ADD: Additional error handling
    define: {
      charset: 'utf8',
      collate: 'utf8_general_ci'
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
        max: 10,
        min: 2,
        acquire: 120000,
        idle: 30000,
        evict: 10000,
        handleDisconnects: true,
        validate: true
      }
    }
  );
}

// ✅ ADD: Connection test with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      console.log(`✅ Database connection established successfully (attempt ${i + 1})`);
      return true;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) {
        console.error('🚨 All database connection attempts failed!');
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
    }
  }
};

// ✅ ADD: Connection monitoring
sequelize.addHook('beforeConnect', (config) => {
  console.log('🔄 Attempting database connection...');
});

sequelize.addHook('afterConnect', (connection, config) => {
  console.log('✅ Database connection established');
});

sequelize.addHook('beforeDisconnect', (connection) => {
  console.log('🔌 Database disconnecting...');
});

// ✅ ADD: Export test function
module.exports = { sequelize, testConnection };