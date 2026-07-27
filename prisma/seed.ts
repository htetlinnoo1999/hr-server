import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 70 of the most common position titles: 50 across software engineering,
// construction, and agency (marketing/creative/advertising) roles, plus 20
// general management/leadership positions applicable across any org.
const POSITION_TITLES = [
  // Software Engineering
  'Software Engineer',
  'Senior Software Engineer',
  'Junior Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile Developer',
  'DevOps Engineer',
  'Site Reliability Engineer',
  'QA Engineer',
  'Software Architect',
  'Engineering Manager',
  'Technical Lead',
  'Data Engineer',
  'Machine Learning Engineer',
  'Security Engineer',
  'VP of Engineering',
  // Construction
  'Site Engineer',
  'Civil Engineer',
  'Structural Engineer',
  'Construction Manager',
  'Project Manager',
  'Site Supervisor',
  'Foreman',
  'Estimator',
  'Quantity Surveyor',
  'Safety Officer',
  'Surveyor',
  'Architect',
  'Electrician',
  'Plumber',
  'Carpenter',
  'Heavy Equipment Operator',
  'Construction Laborer',
  // Agency
  'Account Manager',
  'Account Executive',
  'Creative Director',
  'Art Director',
  'Copywriter',
  'Graphic Designer',
  'UX/UI Designer',
  'Media Planner',
  'Media Buyer',
  'SEO Specialist',
  'Social Media Manager',
  'Content Strategist',
  'Digital Marketing Manager',
  'Public Relations Manager',
  'Business Development Manager',
  'Client Services Manager',
  // Management
  'Chief Executive Officer',
  'Chief Operating Officer',
  'Chief Financial Officer',
  'Chief Technology Officer',
  'Chief Marketing Officer',
  'Chief Human Resources Officer',
  'General Manager',
  'Operations Manager',
  'Human Resources Manager',
  'Finance Manager',
  'Sales Manager',
  'Marketing Manager',
  'Product Manager',
  'Program Manager',
  'Office Manager',
  'Regional Manager',
  'Branch Manager',
  'Team Lead',
  'Department Head',
  'Director of Operations',
];

async function main() {
  console.log('Seeding database...');

  // Create Staffly as the default (root) organization
  const peoplify = await prisma.organization.upsert({
    where: { slug: 'staffly' },
    update: {},
    create: {
      name: 'Staffly',
      slug: 'staffly',
      primaryColor: '#4F46E5',
      secondaryColor: '#818CF8',
      logo: 'https://peoplify.app/logo.png',
      isDefault: true,
    },
  });

  console.log(`Organization created: ${peoplify.name} (${peoplify.id})`);

  // Create Myanmar as the default country
  const myanmar = await prisma.country.upsert({
    where: { name: 'Myanmar' },
    update: {},
    create: { name: 'Myanmar', code: 'MM' },
  });

  console.log(`Country created: ${myanmar.name} (${myanmar.id})`);

  // Hash password for seed employees
  const passwordHash = await bcrypt.hash('asdf1234', 10);

  // Create admin employee
  const adminEmployee = await prisma.employee.upsert({
    where: { email: 'htetlinnoo19@gmail.com' },
    update: {},
    create: {
      email: 'htetlinnoo19@gmail.com',
      passwordHash,
      role: 'ADMIN',
      organizationId: peoplify.id,
      employeeCode: 'EMP-ADMIN',
      firstName: 'Htet',
      lastName: 'Lin Noo',
      salary: 0,
      countryId: myanmar.id,
    },
  });

  console.log(`Employee created: ${adminEmployee.email} (ADMIN)`);

  // Create HR manager employee
  const hrEmployee = await prisma.employee.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      email: 'test@gmail.com',
      passwordHash,
      role: 'HR_MANAGER',
      organizationId: peoplify.id,
      employeeCode: 'EMP-HR',
      firstName: 'Test',
      lastName: 'User',
      salary: 0,
      countryId: myanmar.id,
    },
  });

  console.log(`Employee created: ${hrEmployee.email} (HR_MANAGER)`);

  const { count: positionCount } = await prisma.position.createMany({
    data: POSITION_TITLES.map((title) => ({ title })),
    skipDuplicates: true,
  });

  console.log(`${positionCount} new position(s) seeded`);

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
