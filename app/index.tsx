/**
 * Authentication Screen
 * 
 * Uses Supabase for authentication with Apple and Google Sign In
 * 
 * Setup Instructions:
 * 1. Create a Supabase project at https://database.new
 * 2. Get your Project URL and Publishable (anon) key from Supabase dashboard
 * 3. Set environment variables:
 *    - EXPO_PUBLIC_SUPABASE_URL=your_project_url
 *    - EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
 * 4. Configure OAuth providers in Supabase dashboard:
 *    - Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
 *    - Google: https://supabase.com/docs/guides/auth/social-login/auth-google
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, ensureUserInDatabase } from '@/utils/supabase';

// Required for web only
WebBrowser.maybeCompleteAuthSession();

// Helper function to create session from OAuth callback URL
const createSessionFromUrl = async (url: string, authMethod: 'apple' | 'google' | 'email' = 'email') => {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;

  if (!access_token) return;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || '',
  });
  
  if (error) throw error;
  
  // Ensure user exists in database after successful authentication
  await ensureUserInDatabase(authMethod);
  
  return data.session;
};

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';

  // Handle deep links into app from email or other sources
  const url = Linking.useURL();
  useEffect(() => {
    if (url) {
      // Default to 'google' for OAuth callbacks from deep links
      createSessionFromUrl(url, 'google').then(() => {
        router.replace('/(tabs)/');
      }).catch((error) => {
        console.error('Error handling deep link:', error);
      });
    }
  }, [url]);

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Sign In', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    try {
      setLoading(true);
      
      // Step 1: Get Apple credential
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Step 2: Sign in with Supabase using Apple credential
      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          throw error;
        }

        // Ensure user exists in database after successful authentication
        await ensureUserInDatabase('apple');

        // Handle successful authentication
        console.log('Apple Sign In successful:', data);
        router.replace('/(tabs)/');
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (e: any) {
      if (e.code === 'ERR_CANCELED') {
        // User canceled the sign-in
        console.log('User canceled Apple Sign In');
      } else {
        Alert.alert('Error', 'Failed to sign in with Apple. Please try again.');
        console.error('Apple Sign In error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Create redirect URL using expo-linking
      const redirectUrl = Linking.createURL('auth/callback', {});
      console.log('Redirect URL:', redirectUrl); // Debug: check what URL is generated

      // Get Supabase OAuth URL with skipBrowserRedirect
      const { data, error: urlError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (urlError) {
        throw urlError;
      }

      if (data?.url) {
        // Open the OAuth URL in browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success') {
          await createSessionFromUrl(result.url, 'google');
          console.log('Google Sign In successful');
          router.replace('/(tabs)/');
        } else if (result.type === 'cancel') {
          console.log('User canceled Google Sign In');
        } else {
          Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during Google Sign In.');
      console.error('Google Sign In error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow users to skip authentication for now
    router.replace('/(tabs)/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ThemedView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {isSignUp ? 'Create Account' : 'Welcome'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isSignUp
              ? 'Sign up to get started'
              : 'Sign in to continue'}
          </ThemedText>
        </View>

        {/* Sign In/Sign Up Toggle */}
        <View
          style={[
            styles.toggleContainer,
            isDark && styles.toggleContainerDark,
          ]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !isSignUp && [
                styles.toggleButtonActive,
                isDark && styles.toggleButtonActiveDark,
              ],
            ]}
            onPress={() => setIsSignUp(false)}
            disabled={loading}>
            <ThemedText
              style={[
                styles.toggleText,
                !isSignUp && styles.toggleTextActive,
              ]}>
              Sign In
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isSignUp && [
                styles.toggleButtonActive,
                isDark && styles.toggleButtonActiveDark,
              ],
            ]}
            onPress={() => setIsSignUp(true)}
            disabled={loading}>
            <ThemedText
              style={[
                styles.toggleText,
                isSignUp && styles.toggleTextActive,
              ]}>
              Sign Up
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Social Sign In Buttons */}
        <View style={styles.buttonContainer}>
          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[
                styles.socialButton,
                styles.appleButton,
                isDark && styles.appleButtonDark,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              ) : (
                <>
                  <Ionicons
                    name="logo-apple"
                    size={20}
                    color={isDark ? '#000' : '#fff'}
                    style={styles.icon}
                  />
                  <ThemedText
                    style={[
                      styles.socialButtonText,
                      styles.appleButtonText,
                      isDark && styles.appleButtonTextDark,
                    ]}>
                    Continue with Apple
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google Sign In */}
          <TouchableOpacity
            style={[
              styles.socialButton,
              styles.googleButton,
              isDark && styles.googleButtonDark,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator
                color={isDark ? '#fff' : '#000'}
              />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={20}
                  color={isDark ? '#fff' : '#000'}
                  style={styles.icon}
                />
                <ThemedText
                  style={[
                    styles.socialButtonText,
                    styles.googleButtonText,
                    isDark && styles.googleButtonTextDark,
                  ]}>
                  Continue with Google
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip Button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading}>
          <ThemedText style={styles.skipText}>Skip for now</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    opacity: 0.6,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  toggleContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonActiveDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.6,
  },
  toggleTextActive: {
    opacity: 1,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 50,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleButtonDark: {
    backgroundColor: '#fff',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  googleButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  appleButtonText: {
    color: '#fff',
  },
  appleButtonTextDark: {
    color: '#000',
  },
  googleButtonText: {
    color: '#000',
  },
  googleButtonTextDark: {
    color: '#fff',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 16,
    opacity: 0.6,
    fontWeight: '500',
  },
});

