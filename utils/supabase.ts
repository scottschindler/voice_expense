import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment variables
// Set these in your .env file or as environment variables:
// EXPO_PUBLIC_SUPABASE_URL=your_project_url
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '⚠️ Supabase URL and/or key are missing!\n' +
    'Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.\n' +
    'Create a .env file in the root directory with these values.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Ensures a user exists in the users table after authentication.
 * Creates a new user record if one doesn't exist.
 * @param authMethod - Optional authentication method override. If not provided, will be detected from user metadata.
 */
export async function ensureUserInDatabase(authMethod?: 'apple' | 'google' | 'email') {
  try {
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting authenticated user:', userError);
      return;
    }

    if (!user.email) {
      console.error('User email is missing');
      return;
    }

    // Detect auth method from user metadata if not provided
    let detectedAuthMethod: 'apple' | 'google' | 'email' = authMethod || 'email';
    if (!authMethod && user.app_metadata?.provider) {
      const provider = user.app_metadata.provider;
      if (provider === 'apple') {
        detectedAuthMethod = 'apple';
      } else if (provider === 'google') {
        detectedAuthMethod = 'google';
      }
    }

    // Check if user already exists in the users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    // If user doesn't exist, create a new record
    if (!existingUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          auth_method: detectedAuthMethod,
          // plan defaults to 'free' in the database
          // notes_count defaults to 0 in the database
          // date_created defaults to now() in the database
        });

      if (insertError) {
        // If it's a unique constraint violation, user might have been created concurrently
        if (insertError.code === '23505') {
          console.log('User already exists (created concurrently)');
        } else {
          console.error('Error creating user in database:', insertError);
          throw insertError;
        }
      } else {
        console.log(`User created in database: ${user.email} (auth_method: ${detectedAuthMethod})`);
      }
    } else {
      console.log('User already exists in database:', user.email);
    }
  } catch (error) {
    console.error('Error ensuring user in database:', error);
    // Don't throw - we don't want to block authentication if this fails
  }
}

