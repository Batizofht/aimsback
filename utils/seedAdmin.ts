import bcrypt from 'bcryptjs'
import Admin from '../models/Admin'
import Role from '../models/Role'
import AdminRole from '../models/AdminRole'

export const seedAdminIfNeeded = async () => {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    return
  }

  // Create Super Admin role if it doesn't exist
  let superAdminRole = await Role.findOne({ where: { slug: 'super-admin' } })
  if (!superAdminRole) {
    superAdminRole = await Role.create({
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full system access with all permissions',
      permissions: ['*'],
      isActive: true,
    })
    console.log('[RBAC] Created Super Admin role')
  }

  // Create Staff role if it doesn't exist
  let staffRole = await Role.findOne({ where: { slug: 'staff' } })
  if (!staffRole) {
    staffRole = await Role.create({
      name: 'Staff',
      slug: 'staff',
      description: 'Staff member with customizable permissions',
      permissions: ['users'],
      isActive: true,
    })
    console.log('[RBAC] Created Staff role')
  }

  // Check if admin exists
  let admin = await Admin.findOne({ where: { email } })
  
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10)
    admin = await Admin.create({ 
      email, 
      passwordHash,
      isSuperAdmin: true,
      isActive: true,
      f_name: 'Super',
      l_name: 'Admin'
    })
    console.log('[RBAC] Seeded admin account:', email)
  }

  // Assign Super Admin role to the admin if not already assigned
  const existingAssignment = await AdminRole.findOne({
    where: { adminId: admin.id, roleId: superAdminRole.id }
  })

  if (!existingAssignment) {
    await AdminRole.create({
      adminId: admin.id,
      roleId: superAdminRole.id,
      assignedBy: admin.id
    })
    console.log('[RBAC] Assigned Super Admin role to:', email)
  }
}
