import bcrypt from 'bcryptjs';
import Admin from './models/Admin';

import Member from './models/Member';

export async function runSeed() {
  const adminCount = await Admin.count();
  if (adminCount === 0) {
    const hash = await bcrypt.hash('password123', 10);
    await Admin.create({
      email: 'aims@aimscapital.com',
      passwordHash: hash,
      f_name: 'Super',
      l_name: 'Admin',
      role: 'admin',
      isActive: true,
    });
    console.log('Seed: default admin created (aims@aimscapital.com / password123)');
  } else {
    console.log('Seed: admin user exists, skipping admin creation');
  }


}
  


