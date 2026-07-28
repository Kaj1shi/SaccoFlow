# SACCO Roles and Permissions - Complete Guide

## 🎯 Clear Role Distinction

### **👔 SACCO Admin (System Users)**
**Table**: `users` - System administrators who manage the SACCO

**📋 Role Types**:
```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'member', 'auditor');
```

**🔐 Key Characteristics**:
- **System login access** - Can access SaccoFlow dashboard
- **Administrative privileges** - Manage operations and settings
- **Staff employees** - SACCO employees and managers
- **Full system access** - Based on role permissions

**👥 Admin Roles Breakdown**:
1. **`admin`** - Super admin, full system control
2. **`manager`** - Branch manager, operational control
3. **`cashier`** - Financial transactions, member services
4. **`auditor`** - Compliance and audit functions
5. **`member`** - Basic staff access (limited privileges)

---

### **👥 SACCO Members (Customers)**
**Table**: `members` - SACCO customers/members

**📋 Status Types**:
```sql
CREATE TYPE member_status AS ENUM ('active', 'pending', 'suspended', 'inactive');
```

**🔐 Key Characteristics**:
- **Customer accounts** - People who save/borrow from SACCO
- **No system login** - Cannot access SaccoFlow dashboard
- **Member services** - Savings, loans, transactions
- **Personal data** - KYC information, accounts, loans

**📊 Member Data Includes**:
- **Personal info**: Name, DOB, gender, national ID
- **Contact details**: Phone, email, address
- **Member number**: Unique SACCO member ID
- **Accounts**: Savings accounts, loans, transactions
- **Emergency contacts**: Next of kin information

---

## 🔄 Registration Flow

### **🚀 SACCO Registration Process**
1. **Registration Form** → Creates `institutions` record + `users` record (admin)
2. **Super Admin Approval** → Changes institution status to 'active'
3. **Admin Setup** → First admin can log in and manage SACCO
4. **Member Onboarding** → Admin adds `members` (customers) to the system

### **📊 Data Flow Example**
```sql
-- New SACCO registration
institutions: { id: 'inst-123', name: 'Test SACCO', status: 'inactive' }
users: { id: 'user-456', institution_id: 'inst-123', role: 'admin', email: 'admin@test.com' }

-- After approval and member onboarding
institutions: { id: 'inst-123', status: 'active' }
users: { id: 'user-456', role: 'admin', is_active: true }
members: { id: 'mem-789', institution_id: 'inst-123', member_number: 'MEM001', status: 'active' }
```

---

## 🔐 Permission Matrix

| **Role** | **Can Login** | **Can Manage** | **Can View** | **Primary Function** |
|----------|---------------|----------------|--------------|---------------------|
| **admin** | ✅ | All system data | All system data | SACCO management |
| **manager** | ✅ | Branch operations | Branch data | Branch oversight |
| **cashier** | ✅ | Member services | Member accounts | Daily operations |
| **auditor** | ✅ | Audit reports | All data (read-only) | Compliance |
| **member** | ❌ | N/A | N/A | Customer only |

---

## 🛡️ Security Implications

### **🔒 Admin Security**
- **System access** - Can access SaccoFlow dashboard
- **Data management** - Can view/modify sensitive data
- **Operational control** - Can approve loans, manage accounts
- **Audit trail** - All actions logged and tracked

### **🔒 Member Security**
- **No system access** - Cannot access admin dashboard
- **Data privacy** - Personal information protected
- **Account security** - Financial data isolated
- **Access control** - Only through admin interaction

---

## 📋 Current Registration Implementation

### **✅ What We Have Now**
```javascript
// Registration creates:
1. institutions record (SACCO entity)
2. users record (first admin with role='admin')
3. auth.users record (Supabase authentication)

// After approval:
- institution.status = 'active'
- users.is_active = true
- users.email_verified_at = now()
```

### **🔄 What's Next**
```javascript
// Member onboarding (to be implemented):
1. Admin logs into dashboard
2. Adds new members through member management
3. Creates member records in members table
4. Sets up savings accounts and loans
```

---

## 🎯 Best Practices

### **✅ Admin Management**
- **Role-based access** - Different permissions for different roles
- **Audit logging** - Track all admin actions
- **Session security** - Secure login and logout
- **Data validation** - Proper input validation and sanitization

### **✅ Member Management**
- **KYC compliance** - Proper identity verification
- **Data privacy** - Protect sensitive member information
- **Account security** - Secure financial transactions
- **Regulatory compliance** - Follow banking regulations

---

## 🔧 Implementation Notes

### **📊 Database Design**
- **Clear separation** - `users` vs `members` tables
- **Proper relationships** - Foreign keys maintain data integrity
- **Status tracking** - Both tables have status fields
- **Audit trails** - Created/updated timestamps

### **🔐 Authentication**
- **Admin users** - Use Supabase Auth for system login
- **Members** - No direct authentication (admin-mediated)
- **Session management** - Secure token-based sessions
- **Password security** - Proper hashing and validation

This design ensures **clear role separation** and **proper security boundaries** between SACCO administrators and members!
