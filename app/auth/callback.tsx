/**
 * OAuth Callback Handler
 * 
 * This screen handles OAuth callbacks from Supabase authentication.
 * It processes the authentication tokens from the URL and sets the session.
 * 
 * Note: The main OAuth flow is handled in app/index.tsx using WebBrowser.openAuthSessionAsync.
 * This route serves as a fallback for deep links that might come from other sources.
 */

import { useEffect } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase, ensureUserInDatabase } from '@/utils/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL from params (expo-router handles deep links)
        const url = params['url'] as string || params['_'] as string;
        
        if (!url) {
          throw new Error('No callback URL found');
        }

        // Parse the URL to extract tokens
        const { params: urlParams, errorCode } = QueryParams.getQueryParams(url);

        if (errorCode) {
          throw new Error(errorCode);
        }

        const { access_token, refresh_token } = urlParams;

        if (!access_token) {
          throw new Error('No authentication tokens found in callback');
        }

        // Set the session with Supabase
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || '',
        });

        if (error) {
          throw error;
        }

        // Ensure user exists in database after successful authentication
        // Default to 'google' for OAuth callbacks
        await ensureUserInDatabase('google');

        // Navigate to main app
        router.replace('/(tabs)/');
      } catch (error: any) {
        console.error('Auth callback error:', error);
        Alert.alert(
          'Authentication Error',
          error.message || 'Failed to complete authentication. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ]
        );
      }
    };

    handleCallback();
  }, [params, router]);

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <ThemedText style={{ marginTop: 16 }}>Completing sign in...</ThemedText>
    </ThemedView>
  );
}

