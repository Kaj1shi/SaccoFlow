const SUPABASE_CONFIG = {
  // Your Supabase Project URL (from Supabase dashboard > Project Settings > API)
  url: 'https://mapunkhahunxdvzqxgym.supabase.co',
  
  // Your Supabase Anonymous/Public Key (from Supabase dashboard > Project Settings > API)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcHVua2hhaHVueGR2enF4Z3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjk1OTQsImV4cCI6MjA4ODkwNTU5NH0.4pydfrrpR4ozG6FZuqdMogyTa79OUvlk0_d4kGUQg8s',
  
  // Optional: Service Role Key (for server-side operations only - keep secret!)
  // serviceKey: 'your-service-role-key-here'
};

// Instructions for setting up Supabase:

/*
STEP 1: CREATE SUPABASE PROJECT
1. Go to https://supabase.com
2. Click "Start your project" 
3. Sign in/up with GitHub/Google
4. Create new organization (if needed)
5. Create new project:
   - Project name: "SaccoFlow" or similar
   - Database password: Create a strong password
   - Region: Choose closest to your users (e.g., East Africa)
   - Wait for project to be created

STEP 2: GET YOUR CREDENTIALS
1. In your Supabase project, go to Settings > API
2. Copy the "Project URL" 
3. Copy the "anon public" key
4. Replace the values in SUPABASE_CONFIG above

STEP 3: SET UP DATABASE SCHEMA
1. Go to SQL Editor in Supabase dashboard
2. Copy the contents of: /supabase/schemas/saccoflow.sql
3. Paste and run the SQL to create all tables
4. Verify tables were created in Database section

STEP 4: CONFIGURE ROW LEVEL SECURITY (RLS)
The schema includes basic RLS policies. You may need to adjust these based on your security requirements.

STEP 5: UPDATE CONFIGURATION
Replace the placeholder values in SUPABASE_CONFIG with your actual credentials.

STEP 6: TEST THE INTEGRATION
1. Open register.html in your browser
2. Fill out the registration form
3. Check browser console for any errors
4. Open super-admin-dashboard.html
5. Verify the registration appears in the pending list

TROUBLESHOOTING:
- If you see "Supabase client not initialized" errors, check your URL/keys
- If you get permission errors, check your RLS policies
- If data doesn't appear, check the browser console for API errors
- Make sure all required tables exist in your Supabase database

SECURITY NOTES:
- Never expose your service_role key in frontend code
- Consider using environment variables for production
- Review and customize RLS policies for your security needs
- Enable additional authentication providers as needed
*/

// Export configuration
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
