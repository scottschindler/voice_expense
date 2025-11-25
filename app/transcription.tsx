import { ThemedText } from '@/components/themed-text';
import { categorizeText, ExpenseData } from '@/utils/openai';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TranscriptionScreen() {
  const { text } = useLocalSearchParams<{ text: string }>();
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (text) {
      handleCategorize();
    }
  }, [text]);

  const getTodayDate = () => {
    return new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  async function handleCategorize() {
    if (!text) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await categorizeText(text);
      
      // Check if result is structured data or raw string
      if (typeof result === 'object' && result !== null && 'amount' in result) {
        const expenseData = result as ExpenseData;
        // If date is null, empty, or invalid, default to today's date
        if (!expenseData.date || expenseData.date === 'null' || (typeof expenseData.date === 'string' && expenseData.date.trim() === '')) {
          expenseData.date = getTodayDate();
        }
        setExpenseData(expenseData);
      } else {
        // If it's a string, try to parse it or create default structure
        setExpenseData({
          amount: 0,
          date: getTodayDate(),
          memo: text,
          category: typeof result === 'string' ? result : 'Uncategorized',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to categorize text';
      setError(errorMessage);
      console.error('Error categorizing text:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) {
      return '';
    }
    return `$${amount.toFixed(2)}`;
  };

  /**
   * Parses a date string in format "MMM DD, YYYY" (e.g., "Apr 24, 2024") to a Date object
   * Falls back to today's date if parsing fails
   */
  const parseDateString = (dateString: string | null): Date => {
    if (!dateString) {
      return new Date();
    }

    try {
      // Try to parse the date string (format: "MMM DD, YYYY")
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        // If parsing fails, return today's date
        return new Date();
      }
      return parsedDate;
    } catch (error) {
      console.warn('Failed to parse date string:', dateString, error);
      return new Date();
    }
  };

  const handleSave = async () => {
    if (!expenseData || !text) {
      Alert.alert('Error', 'Missing expense data or transcript');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!user.email) {
        throw new Error('User email is missing');
      }

      // Parse the date string to a Date object
      const transactionDate = parseDateString(expenseData.date);
      
      // Format date as YYYY-MM-DD for PostgreSQL date type
      const dateString = transactionDate.toISOString().split('T')[0];

      // Ensure amount is not null (default to 0 if null)
      const amount = expenseData.amount ?? 0;

      // Insert the note into the database
      const { error: insertError } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          email: user.email,
          amount: amount,
          date_of_transaction: dateString,
          description: expenseData.memo || null,
          category: expenseData.category || null,
          transcript: text,
        });

      if (insertError) {
        throw new Error(`Failed to save note: ${insertError.message}`);
      }

      // Success - navigate back to home
      router.dismissAll();
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save expense';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Error saving note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            Confirm Details
          </ThemedText>
        </View>

        {/* Expense Details */}
        <View style={styles.detailsSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <ThemedText style={styles.loadingText}>Categorizing...</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleCategorize}>
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </TouchableOpacity>
            </View>
          ) : expenseData ? (
            <>
              <EditableDetailRow 
                label="Amount" 
                value={formatAmount(expenseData.amount)}
                onChangeText={(text) => {
                  // Parse amount from formatted string (remove $ and parse as number)
                  const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
                  setExpenseData({ ...expenseData, amount: numericValue });
                }}
                keyboardType="decimal-pad"
              />
              <EditableDetailRow 
                label="Date" 
                value={expenseData.date || getTodayDate()}
                onChangeText={(text) => setExpenseData({ ...expenseData, date: text })}
              />
              <EditableDetailRow 
                label="Memo" 
                value={expenseData.memo || ''}
                onChangeText={(text) => setExpenseData({ ...expenseData, memo: text })}
              />
              <EditableDetailRow 
                label="Category" 
                value={expenseData.category || ''}
                onChangeText={(text) => setExpenseData({ ...expenseData, category: text })}
              />
            </>
          ) : null}
        </View>

        {/* Cancel Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, (isSaving || !expenseData || isLoading) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!expenseData || isLoading || isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function EditableDetailRow({ 
  label, 
  value, 
  onChangeText,
  keyboardType = 'default',
}: { 
  label: string; 
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <TextInput
        style={styles.detailInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#999"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  titleContainer: {
    paddingTop: Platform.OS === 'ios' ? 20 : 32,
    paddingBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
  },
  detailsSection: {
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  detailLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
    minWidth: 80,
  },
  detailInput: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  cancelButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
  },
  saveButtonContainer: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  saveButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 17,
    opacity: 0.6,
    color: '#000',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 17,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
