import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize with empty/default values
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [memo, setMemo] = useState('');
  const [category, setCategory] = useState('');

  function getTodayDate() {
    return new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  function formatDateForDisplay(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return getTodayDate();
    }
  }

  /**
   * Parses a date string in format "MMM DD, YYYY" (e.g., "Apr 24, 2024") to a Date object
   * Falls back to today's date if parsing fails
   */
  const parseDateString = (dateString: string | null): Date => {
    if (!dateString) {
      return new Date();
    }

    try {
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        return new Date();
      }
      return parsedDate;
    } catch (error) {
      console.warn('Failed to parse date string:', dateString, error);
      return new Date();
    }
  };

  // Fetch expense data on mount
  useEffect(() => {
    const fetchExpense = async () => {
      if (!id) {
        Alert.alert('Error', 'Expense ID is missing');
        router.back();
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: note, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !note) {
          throw new Error(fetchError?.message || 'Expense not found');
        }

        // Populate form with existing data
        setAmount(note.amount?.toString() || '');
        setDate(formatDateForDisplay(note.date_of_transaction));
        setMemo(note.description || '');
        setCategory(note.category || '');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load expense';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
        console.error('Error fetching expense:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpense();
  }, [id, router]);

  const handleSave = async () => {
    // Validate amount
    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
    if (numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!id) {
      Alert.alert('Error', 'Expense ID is missing');
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

      // Parse the date string to a Date object
      const transactionDate = parseDateString(date);
      
      // Format date as YYYY-MM-DD for PostgreSQL date type
      const dateString = transactionDate.toISOString().split('T')[0];

      // Update the note in the database
      const { error: updateError } = await supabase
        .from('notes')
        .update({
          amount: numericAmount,
          date_of_transaction: dateString,
          description: memo || null,
          category: category || null,
        })
        .eq('id', id);

      if (updateError) {
        throw new Error(`Failed to update expense: ${updateError.message}`);
      }

      // Success - navigate back to home
      router.back();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update expense';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Error updating expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <ThemedText style={styles.loadingText}>Loading expense...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              Edit Expense
            </ThemedText>
          </View>

          {/* Expense Details */}
          <View style={styles.detailsSection}>
            <EditableDetailRow 
              label="Amount" 
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="$0.00"
            />
            <EditableDetailRow 
              label="Date" 
              value={date}
              onChangeText={setDate}
              placeholder="Enter date"
            />
            <EditableDetailRow 
              label="Memo" 
              value={memo}
              onChangeText={setMemo}
              placeholder="Enter description"
            />
            <EditableDetailRow 
              label="Category" 
              value={category}
              onChangeText={setCategory}
              placeholder="Enter category"
            />
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
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function EditableDetailRow({ 
  label, 
  value, 
  onChangeText,
  keyboardType = 'default',
  placeholder,
}: { 
  label: string; 
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <TextInput
        style={styles.detailInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 17,
    opacity: 0.6,
    color: '#000',
  },
});

