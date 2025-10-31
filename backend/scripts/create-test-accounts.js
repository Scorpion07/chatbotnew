import bcrypt from 'bcryptjs';
import { User, sequelize } from '../src/models/index.js';

async function createTestAccounts() {
  try {
    console.log('🔄 Creating test accounts...');
    
    // Ensure database is synced
    await sequelize.sync();
    
    // Clear existing test accounts (optional)
    await User.destroy({ where: {} });
    console.log('🗑️  Cleared existing accounts');
    
    const testAccounts = [
      // 10 Premium accounts
      { email: 'premium1@test.com', password: 'password123', isPremium: true },
      { email: 'premium2@test.com', password: 'password123', isPremium: true },
      { email: 'premium3@test.com', password: 'password123', isPremium: true },
      { email: 'premium4@test.com', password: 'password123', isPremium: true },
      { email: 'premium5@test.com', password: 'password123', isPremium: true },
      { email: 'premium6@test.com', password: 'password123', isPremium: true },
      { email: 'premium7@test.com', password: 'password123', isPremium: true },
      { email: 'premium8@test.com', password: 'password123', isPremium: true },
      { email: 'premium9@test.com', password: 'password123', isPremium: true },
      { email: 'premium10@test.com', password: 'password123', isPremium: true },
      
      // 2 Normal accounts
      { email: 'normal1@test.com', password: 'password123', isPremium: false },
      { email: 'normal2@test.com', password: 'password123', isPremium: false },
    ];
    
    console.log('📝 Creating accounts...');
    
    for (const account of testAccounts) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      await User.create({
        email: account.email,
        password: hashedPassword,
        isPremium: account.isPremium
      });
      
      console.log(`✅ Created: ${account.email} (${account.isPremium ? 'Premium' : 'Normal'})`);
    }
    
    console.log('\n🎉 Test accounts created successfully!');
    console.log('\n📋 Login credentials:');
    console.log('Premium accounts: premium1@test.com to premium10@test.com');
    console.log('Normal accounts: normal1@test.com, normal2@test.com');
    console.log('Password for all: password123');
    
    const totalUsers = await User.count();
    const premiumUsers = await User.count({ where: { isPremium: true } });
    
    console.log(`\n📊 Total accounts: ${totalUsers}`);
    console.log(`📊 Premium accounts: ${premiumUsers}`);
    console.log(`📊 Normal accounts: ${totalUsers - premiumUsers}`);
    
  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  }
  
  process.exit(0);
}

createTestAccounts();