# Supabase Setup Guide

This app uses Supabase for authentication and database functionality.

## Initial Setup

1. **Create a Supabase Project**
   - Go to [database.new](https://database.new) to create a new project
   - Wait for the project to be fully provisioned

2. **Get Your API Keys**
   - Go to [API Settings](https://supabase.com/dashboard/project/_/settings/api) in your Supabase dashboard
   - Copy your **Project URL**
   - Go to [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)
   - Copy your **Publishable (anon) key**

3. **Set Environment Variables**
   - Create a `.env` file in the root directory of your project
   - Add the following:
     ```
     EXPO_PUBLIC_SUPABASE_URL=your_project_url_here
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
     ```
   - Replace the placeholder values with your actual keys

4. **Configure OAuth Providers**

   ### Apple Sign In (iOS)
   - Follow the guide: https://supabase.com/docs/guides/auth/social-login/auth-apple
   - Enable Apple provider in Supabase Dashboard → Authentication → Providers
   - Configure your Apple Developer account settings

   ### Google Sign In
   
   **Step 1: Create Google OAuth Credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Web application" as the application type
   - Add authorized redirect URIs:
     - For development: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - For production: Your Supabase project's callback URL
   - Copy the **Client ID** and **Client Secret**
   
   **Step 2: Configure Supabase**
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable the Google provider
   - Paste your Google **Client ID** and **Client Secret**
   - Add redirect URL to "Redirect URLs" section: `voiceexpense://auth/callback`
   - Save the configuration
   
   **Step 3: Verify Deep Linking**
   - The app is already configured with the scheme `voiceexpense` in `app.json`
   - The redirect URL `voiceexpense://auth/callback` should match this scheme
   - For testing, you can also use the Expo development URL format if needed

5. **Restart Your Development Server**
   ```bash
   npx expo start --clear
   ```

## Using Supabase in Your App

Import the Supabase client anywhere in your app:

```typescript
import { supabase } from '@/utils/supabase';
```

### Authentication Examples

```typescript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session);
});
```

### Database Examples

```typescript
// Query data
const { data, error } = await supabase
  .from('expenses')
  .select('*')
  .eq('user_id', user.id);

// Insert data
const { data, error } = await supabase
  .from('expenses')
  .insert([{ description: 'Lunch', amount: 12.50 }]);

// Update data
const { data, error } = await supabase
  .from('expenses')
  .update({ amount: 15.00 })
  .eq('id', expenseId);
```

## Next Steps

- Set up your database schema in Supabase Dashboard
- Configure Row Level Security (RLS) policies
- Add your expense tables and relationships

For more information, visit the [Supabase Documentation](https://supabase.com/docs).

