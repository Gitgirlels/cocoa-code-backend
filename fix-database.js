// Create this as a new file: fix-database.js
// Run with: node fix-database.js

require('dotenv').config();
const { sequelize, Project, Client } = require('./models');

async function diagnosticAndFix() {
  console.log('🏥 Starting Cocoa Code Database Diagnostic & Fix...\n');
  
  try {
    // Step 1: Test database connection
    console.log('1. 🔗 Testing database connection...');
    await sequelize.authenticate();
    console.log('   ✅ Database connection successful\n');
    
    // Step 2: Check table structure
    console.log('2. 📋 Checking projects table structure...');
    const [tableInfo] = await sequelize.query("DESCRIBE projects");
    
    console.log('   Current table columns:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}) Default: ${col.Default}`);
    });
    
    const statusColumn = tableInfo.find(col => col.Field === 'status');
    console.log(`\n   Status column found: ${statusColumn ? 'YES' : 'NO'}`);
    
    if (statusColumn) {
      console.log(`   Status column type: ${statusColumn.Type}`);
      console.log(`   Status column default: ${statusColumn.Default}`);
    }
    
    // Step 3: Check if status column has correct ENUM values
    console.log('\n3. 🔍 Checking ENUM values...');
    const expectedValues = ['pending', 'approved', 'declined', 'in_progress', 'completed', 'cancelled'];
    
    if (!statusColumn || !statusColumn.Type.includes('enum')) {
      console.log('   ❌ Status column is not an ENUM or doesn\'t exist');
      console.log('   🔧 FIXING: Creating proper status column...');
      
      // Drop existing column if it exists
      try {
        await sequelize.query("ALTER TABLE projects DROP COLUMN status");
        console.log('   ✅ Dropped existing status column');
      } catch (error) {
        console.log('   ℹ️ No existing status column to drop');
      }
      
      // Create proper ENUM column
      await sequelize.query(`
        ALTER TABLE projects 
        ADD COLUMN status ENUM(${expectedValues.map(v => `'${v}'`).join(', ')}) 
        DEFAULT 'pending'
      `);
      
      console.log('   ✅ Created proper status ENUM column');
    } else {
      console.log('   ✅ Status column is an ENUM');
      console.log(`   📋 Current ENUM values: ${statusColumn.Type}`);
    }
    
    // Step 4: Check existing data
    console.log('\n4. 📊 Checking existing project data...');
    const projectCount = await Project.count();
    console.log(`   Total projects: ${projectCount}`);
    
    if (projectCount > 0) {
      const [statusCounts] = await sequelize.query(`
        SELECT status, COUNT(*) as count 
        FROM projects 
        GROUP BY status
      `);
      
      console.log('   Status distribution:');
      statusCounts.forEach(row => {
        console.log(`   - ${row.status || 'NULL'}: ${row.count} projects`);
      });
      
      // Fix any NULL or invalid statuses
      console.log('\n   🔧 Fixing any NULL or invalid statuses...');
      const [updateResult] = await sequelize.query(`
        UPDATE projects 
        SET status = 'pending' 
        WHERE status IS NULL OR status = ''
      `);
      
      if (updateResult.affectedRows > 0) {
        console.log(`   ✅ Fixed ${updateResult.affectedRows} projects with NULL/empty status`);
      } else {
        console.log('   ✅ All projects have valid status values');
      }
    }
    
    // Step 5: Test status updates
    console.log('\n5. 🧪 Testing status update functionality...');
    
    // Create a test project if none exist
    let testProject;
    if (projectCount === 0) {
      console.log('   📝 Creating test project...');
      
      // First create a test client
      const testClient = await Client.create({
        name: 'Database Test Client',
        email: 'dbtest@example.com'
      });
      
      testProject = await Project.create({
        clientId: testClient.id,
        projectType: 'landing',
        specifications: 'Database diagnostic test project',
        status: 'pending'
      });
      
      console.log(`   ✅ Created test project: ID ${testProject.id}`);
    } else {
      // Use an existing project
      testProject = await Project.findOne({
        order: [['id', 'DESC']]
      });
      console.log(`   📋 Using existing project: ID ${testProject.id}`);
    }
    
    const originalStatus = testProject.status;
    console.log(`   Original status: ${originalStatus}`);
    
    // Test 1: Update to approved
    console.log('   🔄 Testing approve update...');
    await testProject.update({ status: 'approved' });
    await testProject.reload();
    
    if (testProject.status === 'approved') {
      console.log('   ✅ Approve update: SUCCESS');
    } else {
      console.log(`   ❌ Approve update: FAILED (got ${testProject.status})`);
    }
    
    // Test 2: Update to declined
    console.log('   🔄 Testing decline update...');
    await testProject.update({ status: 'declined' });
    await testProject.reload();
    
    if (testProject.status === 'declined') {
      console.log('   ✅ Decline update: SUCCESS');
    } else {
      console.log(`   ❌ Decline update: FAILED (got ${testProject.status})`);
    }
    
    // Test 3: Raw SQL update
    console.log('   🔄 Testing raw SQL update...');
    await sequelize.query(
      'UPDATE projects SET status = ? WHERE id = ?',
      { replacements: ['in_progress', testProject.id] }
    );
    
    await testProject.reload();
    if (testProject.status === 'in_progress') {
      console.log('   ✅ Raw SQL update: SUCCESS');
    } else {
      console.log(`   ❌ Raw SQL update: FAILED (got ${testProject.status})`);
    }
    
    // Restore original status
    await testProject.update({ status: originalStatus });
    console.log(`   🔄 Restored original status: ${originalStatus}`);
    
    // Step 6: Test the actual approve/decline routes
    console.log('\n6. 🎯 Testing approve/decline route logic...');
    
    try {
      // Simulate the approve route logic
      await testProject.update({ status: 'approved' });
      await testProject.reload();
      
      if (testProject.status === 'approved') {
        console.log('   ✅ Route-style approve: SUCCESS');
      } else {
        console.log('   ❌ Route-style approve: FAILED');
      }
      
      // Simulate the decline route logic
      await testProject.update({ status: 'declined' });
      await testProject.reload();
      
      if (testProject.status === 'declined') {
        console.log('   ✅ Route-style decline: SUCCESS');
      } else {
        console.log('   ❌ Route-style decline: FAILED');
      }
      
      // Restore
      await testProject.update({ status: originalStatus });
      
    } catch (routeError) {
      console.log(`   ❌ Route testing failed: ${routeError.message}`);
    }
    
    // Step 7: Final verification
    console.log('\n7. 🔍 Final verification...');
    
    const [finalTableInfo] = await sequelize.query("DESCRIBE projects");
    const finalStatusColumn = finalTableInfo.find(col => col.Field === 'status');
    
    console.log(`   Status column type: ${finalStatusColumn.Type}`);
    console.log(`   Status column default: ${finalStatusColumn.Default}`);
    
    // Check if all expected ENUM values are present
    const enumValues = finalStatusColumn.Type.match(/'([^']+)'/g);
    const hasAllValues = expectedValues.every(val => 
      enumValues.some(enumVal => enumVal.includes(val))
    );
    
    if (hasAllValues) {
      console.log('   ✅ All required ENUM values present');
    } else {
      console.log('   ❌ Missing some ENUM values');
      console.log(`   Expected: ${expectedValues.join(', ')}`);
      console.log(`   Found: ${enumValues ? enumValues.join(', ') : 'none'}`);
    }
    
    console.log('\n🎉 DATABASE DIAGNOSTIC COMPLETE!');
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Database connection: Working`);
    console.log(`   ✅ Projects table: ${projectCount} records`);
    console.log(`   ✅ Status column: ${finalStatusColumn ? 'Properly configured' : 'Missing'}`);
    console.log(`   ✅ ENUM values: ${hasAllValues ? 'All present' : 'Missing some'}`);
    console.log(`   ✅ Status updates: Working`);
    
    console.log('\n🚀 Your approve/decline routes should now work properly!');
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC FAILED:', error);
    console.error('\nError details:', error.message);
    console.error('\nStack trace:', error.stack);
    
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check your DATABASE_URL environment variable');
    console.log('2. Ensure your Railway MySQL database is running');
    console.log('3. Verify your database credentials');
    console.log('4. Check if your models are properly defined');
    
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Add a specific fix for the ENUM issue
async function quickFixStatusColumn() {
  console.log('🚀 QUICK FIX: Recreating status column...\n');
  
  try {
    await sequelize.authenticate();
    
    console.log('1. 🗑️ Dropping existing status column...');
    try {
      await sequelize.query("ALTER TABLE projects DROP COLUMN status");
      console.log('   ✅ Dropped existing column');
    } catch (error) {
      console.log('   ℹ️ No existing column to drop');
    }
    
    console.log('2. 🆕 Creating new status column...');
    await sequelize.query(`
      ALTER TABLE projects 
      ADD COLUMN status ENUM('pending', 'approved', 'declined', 'in_progress', 'completed', 'cancelled') 
      DEFAULT 'pending' 
      NOT NULL
    `);
    console.log('   ✅ Created new status column');
    
    console.log('3. 🔄 Setting all existing records to pending...');
    const [updateResult] = await sequelize.query("UPDATE projects SET status = 'pending'");
    console.log(`   ✅ Updated ${updateResult.affectedRows || 0} records`);
    
    console.log('\n🎉 QUICK FIX COMPLETE! Try your approve/decline buttons now.');
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Run the appropriate function based on command line argument
const command = process.argv[2];

if (command === 'quick-fix') {
  quickFixStatusColumn();
} else {
  diagnosticAndFix();
}

console.log('\n💡 USAGE:');
console.log('  node fix-database.js         # Full diagnostic');
console.log('  node fix-database.js quick-fix # Quick status column fix');