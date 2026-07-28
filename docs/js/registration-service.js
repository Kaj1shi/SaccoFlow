// ── registration-service.js ─────────────────────────────────────────────────
// Handles SACCO registration via Supabase REST API.
// Requires: supabase-client.js loaded first.

(function () {
  'use strict';

  var svc = {

    // ── Helper: get client or throw ─────────────────────────────────────────
    _db: function () {
      if (!window.SupabaseClient) throw new Error('SupabaseClient not loaded. Ensure supabase-client.js is included before registration-service.js.');
      return window.SupabaseClient;
    },

    _genRegNumber: function () {
      var year   = new Date().getFullYear();
      var rand   = Math.floor(Math.random() * 100000).toString();
      while (rand.length < 5) rand = '0' + rand;
      return 'REG-' + year + '-' + rand;
    },

    // ── Submit a new SACCO registration ────────────────────────────────────
    submitRegistration: async function (formData) {
      var db  = this._db();
      var regNumber = this._genRegNumber();

      try {
        // ── Step 0: Check for existing email to prevent duplicates ──────────
        var existingCheck = await db.select('institutions', {
          select:  'id,email',
          filters: ['email=eq.' + formData.email],
          single:  true,
        });
        
        if (existingCheck.error && existingCheck.error.code !== 'PGRST116') { // PGRST116 = not found
          throw new Error(existingCheck.error.message);
        }
        
        if (existingCheck.data) {
          throw new Error('This email address is already registered. Please use a different email or contact support.');
        }

        // ── Step 1: Insert institution row ──────────────────────────────────
        var instResult = await db.insert('institutions', {
          name:                formData.name,
          registration_number: regNumber,
          phone:               formData.phone,
          email:               formData.email,
          status:              'inactive', // Fixed: use 'inactive' instead of 'pending' to match sacco_status enum
          // NOTE: pass the object directly — the REST client JSON-encodes the
          // whole row, so stringifying here double-encodes it and jsonb stores
          // a string instead of an object (breaking settings->>'contact_person').
          settings:            {
            contact_person:      formData.contactPerson,
            members_range:       formData.membersRange || '',
            registration_source: 'web_form',
            submitted_at:        new Date().toISOString(),
          },
        }, { single: true });

        if (instResult.error) {
          throw new Error(instResult.error.message);
        }

        var institution = instResult.data;

        // ── Step 2: Create Supabase Auth user with user-provided password ────────
        var authResult = await db.auth.signUp(formData.email, formData.password, {
          full_name:      formData.contactPerson,
          phone:          formData.phone,
          institution_id: institution.id,
          role:           'admin',
        });

        if (authResult.error) {
          // Roll back institution row
          await db.delete('institutions', 'id=eq.' + institution.id);
          
          // Handle specific auth errors
          var errorMsg = authResult.error.message.toLowerCase();
          if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
            throw new Error('Too many registration attempts. Please wait a few minutes and try again, or use a different email address.');
          } else if (errorMsg.includes('already registered') || errorMsg.includes('user already registered')) {
            throw new Error('This email address is already registered. Please use a different email or contact support.');
          } else {
            throw new Error(authResult.error.message);
          }
        }

        var authUser = authResult.data && (authResult.data.user || authResult.data);
        // GoTrue sometimes returns the user object at the top level; other
        // times under .user. Normalize to an object that has .id.
        if (authUser && !authUser.id && authResult.data && authResult.data.id) {
          authUser = authResult.data;
        }

        if (!authUser || !authUser.id) {
          await db.delete('institutions', 'id=eq.' + institution.id);
          throw new Error(
            'Registration created your SACCO but Auth did not return a user id ' +
            '(often caused by email confirmation / rate limits). Please try again or contact support.'
          );
        }

        // ── Step 3: Insert public profile row ────────────────────────────────
        // REQUIRED: without this row the user cannot access the dashboard
        // ("Your account has no dashboard profile").
        // A DB trigger (handle_new_auth_user) also creates this row; the
        // explicit insert keeps older databases working and fails loudly.
        var nameParts = (formData.contactPerson || '').trim().split(/\s+/);
        var profileResult = await db.insert('users', {
          id:             authUser.id,
          institution_id: institution.id,
          email:          formData.email,
          password_hash:  'supabase_auth', // real auth lives in auth.users; column is NOT NULL
          first_name:     nameParts[0] || 'Admin',
          last_name:      nameParts.slice(1).join(' ') || '',
          phone:          formData.phone,
          role:           'admin',
          is_active:      false, // activated when the SACCO is approved
        }, { single: true });

        if (profileResult.error) {
          // Duplicate from the trigger is fine (23505); anything else is fatal.
          var code = String(profileResult.error.code || '');
          var msg  = String(profileResult.error.message || '');
          if (code !== '23505' && msg.toLowerCase().indexOf('duplicate') === -1) {
            console.error('[RegistrationService] Profile insert FAILED:', profileResult.error.message);
            // Roll back institution so we don't leave an orphan SACCO with no login.
            await db.delete('institutions', 'id=eq.' + institution.id);
            throw new Error(
              'Your account was created but its dashboard profile could not be saved (' +
              profileResult.error.message +
              '). Please contact support before trying to log in.'
            );
          }
        }

        // ── Step 4: Create admin notification (fire-and-forget) ─────────────
        // notifications has no institution_id column; 'system' is a valid enum type.
        db.insert('notifications', {
          title:    'New SACCO Registration',
          message:  formData.name + ' submitted a registration request. Contact: ' + formData.contactPerson + ' (' + formData.email + ')',
          type:     'system',
          is_read:  false,
          metadata: {
            institution_id: institution.id,
            contact_person: formData.contactPerson,
            email:          formData.email,
            phone:          formData.phone,
          },
        }).catch(function (e) {
          console.warn('[RegistrationService] Notification skipped:', e.message);
        });

        return db.handleSuccess(
          { institution: institution, registrationNumber: regNumber },
          'Registration submission'
        );

      } catch (err) {
        return db.handleError(err, 'registration submission');
      }
    },

    // ── Pending registrations (super admin view) ────────────────────────────
    getPendingRegistrations: async function () {
      var db = this._db();
      try {
        var result = await db.select('institutions', {
          select:  '*,users(id,email,first_name,last_name,phone,role)',
          filters: ['status=eq.inactive'], // Fixed: use 'inactive' instead of 'pending'
          order:   'created_at.desc',
        });
        if (result.error) throw new Error(result.error.message);
        return db.handleSuccess(result.data, 'fetching pending registrations');
      } catch (err) {
        return db.handleError(err, 'fetching pending registrations');
      }
    },

    // ── Approve a registration ───────────────────────────────────────────────
    approveRegistration: async function (institutionId) {
      var db = this._db();
      try {
        var filter = 'id=eq.' + institutionId;

        var instResult = await db.update('institutions',
          { status: 'active', updated_at: new Date().toISOString() },
          filter, { single: true }
        );
        if (instResult.error) throw new Error(instResult.error.message);

        var userResult = await db.update('users',
          { is_active: true, updated_at: new Date().toISOString() },
          'institution_id=eq.' + institutionId,
          { single: true }
        );
        if (userResult.error) throw new Error(userResult.error.message);

        var branchResult = await db.insert('branches', {
          institution_id: institutionId,
          name:           'Main Branch',
          code:           'MAIN',
          address:        'To be updated',
          is_main_branch: true,
          status:         'active',
          manager_id:     userResult.data && userResult.data.id,
        }, { single: true });
        if (branchResult.error) throw new Error(branchResult.error.message);

        // Approval notification — fire-and-forget
        db.insert('notifications', {
          institution_id: institutionId,
          title:          'Registration Approved',
          message:        'Your SACCO has been approved. You can now log in to your dashboard.',
          type:           'approval',
          is_read:        false,
        }).catch(function (e) {
          console.warn('[RegistrationService] Approval notification skipped:', e.message);
        });

        return db.handleSuccess({
          institution: instResult.data,
          user:        userResult.data,
          branch:      branchResult.data,
        }, 'registration approval');

      } catch (err) {
        return db.handleError(err, 'registration approval');
      }
    },

    // ── Reject a registration ────────────────────────────────────────────────
    rejectRegistration: async function (institutionId, reason) {
      var db = this._db();
      try {
        var getResult = await db.select('institutions', {
          select:  'name,email',
          filters: ['id=eq.' + institutionId],
          single:  true,
        });
        var delResult = await db.delete('institutions', 'id=eq.' + institutionId);
        if (delResult.error) throw new Error(delResult.error.message);
        console.log('[RegistrationService] Rejected:', getResult.data && getResult.data.name, '| Reason:', reason || 'none');
        return db.handleSuccess({ institution: getResult.data }, 'registration rejection');
      } catch (err) {
        return db.handleError(err, 'registration rejection');
      }
    },

    // ── Internal helpers ─────────────────────────────────────────────────────
    _genTempPassword: function () {
      // Generates a cryptographically random 24-char password.
      // The user will reset this via the confirmation email link.
      if (window.crypto && window.crypto.getRandomValues) {
        var arr = new Uint8Array(18);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, function(b) { return b.toString(16).padStart(2,'0'); }).join('');
      }
      // Fallback for very old browsers
      return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
    },
  };

  window.registrationService = svc;
  console.log('[RegistrationService] Loaded.');
})();
