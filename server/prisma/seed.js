import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - be careful in production!)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🗑️  Clearing existing data...');
    
    // Delete in correct order to respect foreign key constraints
    await prisma.report.deleteMany({});
    await prisma.like.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.blog.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('✅ Existing data cleared');
  }

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@blog.com' },
    update: {
      // Update admin data if exists
      password: adminPassword,
      name: 'Admin User',
      bio: 'System Administrator',
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: 'admin@blog.com',
      username: 'admin',
      password: adminPassword,
      name: 'Admin User',
      bio: 'System Administrator',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created/updated:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Username: ${admin.username}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   Password: admin123 (Please change this in production!)`);

  // Verify the admin was created
  const adminCheck = await prisma.user.findUnique({
    where: { email: 'admin@blog.com' },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
    }
  });

  if (adminCheck) {
    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📋 Database Summary:');
    console.log(`   Total Users: 1 (1 admin)`);
    console.log(`   Total Blogs: 0`);
    console.log(`   Total Comments: 0`);
    console.log(`   Total Reports: 0`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Admin: admin@blog.com / admin123');
    
    console.log('\n⚠️  Important Notes:');
    console.log('   1. Only admin user is seeded');
    console.log('   2. Regular users should register via /api/auth/register');
    console.log('   3. Admin can create blogs via /api/blogs (POST)');
    console.log('   4. Change admin password immediately in production!');
  } else {
    throw new Error('Failed to create admin user');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });