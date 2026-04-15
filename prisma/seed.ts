import { PrismaClient } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Peoplify as the default (root) organization
  const peoplify = await prisma.organization.upsert({
    where: { slug: 'peoplify' },
    update: {},
    create: {
      name: 'Peoplify',
      slug: 'peoplify',
      primaryColor: '#4F46E5',
      secondaryColor: '#818CF8',
      logo: 'https://peoplify.app/logo.png',
      isDefault: true,
    },
  });

  console.log(`Organization created: ${peoplify.name} (${peoplify.id})`);

  // Hash password for seed users
  const passwordHash = await bcrypt.hash('asdf1234', 10);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'htetlinnoo19@gmail.com' },
    update: {},
    create: {
      email: 'htetlinnoo19@gmail.com',
      passwordHash,
      role: 'ADMIN',
      organizationId: peoplify.id,
    },
  });

  console.log(`User created: ${adminUser.email} (ADMIN)`);

  // Create HR manager user
  const hrUser = await prisma.user.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      email: 'test@gmail.com',
      passwordHash,
      role: 'HR_MANAGER',
      organizationId: peoplify.id,
    },
  });

  console.log(`User created: ${hrUser.email} (HR_MANAGER)`);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
