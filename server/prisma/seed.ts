import { PrismaClient, Role, EventStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ──────────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@12345', SALT_ROUNDS);
  const admin = await prisma.user.create({
    data: {
      name: 'Campus Admin',
      email: 'admin@campus.edu',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      department: 'Administration',
    },
  });

  const organizerPasswordHash = await bcrypt.hash('Organizer@12345', SALT_ROUNDS);
  const organizer = await prisma.user.create({
    data: {
      name: 'Event Organizer',
      email: 'organizer@campus.edu',
      passwordHash: organizerPasswordHash,
      role: Role.ORGANIZER,
      department: 'Computer Science',
    },
  });

  const student1PasswordHash = await bcrypt.hash('Student@12345', SALT_ROUNDS);
  const student1 = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@campus.edu',
      passwordHash: student1PasswordHash,
      role: Role.STUDENT,
      department: 'Information Technology',
    },
  });

  const student2PasswordHash = await bcrypt.hash('Student@12345', SALT_ROUNDS);
  await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@campus.edu',
      passwordHash: student2PasswordHash,
      role: Role.STUDENT,
      department: 'Electronics Engineering',
    },
  });

  console.log('✅ Created 4 users (1 Admin, 1 Organizer, 2 Students)');

  // ─── Venue ──────────────────────────────────────────────────────────────────
  const venue = await prisma.venue.create({
    data: {
      name: 'Main Auditorium',
      capacity: 500,
      location: 'Block A, Ground Floor',
      isAvailable: true,
    },
  });

  console.log('✅ Created 1 Venue');

  // ─── Events ─────────────────────────────────────────────────────────────────
  const event1 = await prisma.event.create({
    data: {
      title: 'National Hackathon 2026',
      description:
        'A 36-hour coding marathon open to all students. Build innovative solutions for real-world campus problems. Prizes worth ₹1,00,000 await!',
      category: 'Hackathon',
      venueId: venue.id,
      startTime: new Date('2026-12-01T09:00:00Z'),
      endTime: new Date('2026-12-02T21:00:00Z'),
      capacity: 200,
      waitlistCapacity: 50,
      status: EventStatus.APPROVED,
      organizerId: organizer.id,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: 'AI & ML Workshop',
      description:
        'Hands-on workshop on Machine Learning fundamentals and practical AI applications using Python and TensorFlow. Bring your laptops!',
      category: 'Workshop',
      venueId: venue.id,
      startTime: new Date('2026-11-20T10:00:00Z'),
      endTime: new Date('2026-11-20T17:00:00Z'),
      capacity: 80,
      waitlistCapacity: 20,
      status: EventStatus.APPROVED,
      organizerId: organizer.id,
    },
  });

  console.log('✅ Created 2 Events');

  // ─── Sample Registration ─────────────────────────────────────────────────────
  await prisma.registration.create({
    data: {
      userId: student1.id,
      eventId: event1.id,
      status: 'CONFIRMED',
    },
  });

  console.log('✅ Created 1 sample Registration');

  // ─── Audit Log ──────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      performedBy: admin.id,
      action: 'SEED_DATABASE',
      details: { message: 'Initial database seed executed successfully' },
    },
  });

  console.log('✅ Created 1 AuditLog entry');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Seed credentials:');
  console.log('  Admin:     admin@campus.edu      / Admin@12345');
  console.log('  Organizer: organizer@campus.edu  / Organizer@12345');
  console.log('  Student 1: alice@campus.edu      / Student@12345');
  console.log('  Student 2: bob@campus.edu        / Student@12345');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
