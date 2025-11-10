import { ThemedText } from '@/components/themed-text';
import { categorizeText, ExpenseData } from '@/utils/openai';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TranscriptionScreen() {
  const { text } = useLocalSearchParams<{ text: string }>();
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const handleSave = () => {
    // TODO: Save expense data to database/storage
    // Dismiss all modals and navigate to home as full screen
    router.dismissAll();
    router.replace('/(tabs)');
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
              <DetailRow label="Amount" value={formatAmount(expenseData.amount)} />
              <DetailRow label="Date" value={expenseData.date || getTodayDate()} />
              <DetailRow label="Memo" value={expenseData.memo} />
              <DetailRow label="Category" value={expenseData.category} />
            </>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              // TODO: Implement edit functionality
              console.log('Edit pressed');
            }}>
            <Text style={styles.buttonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              // TODO: Implement delete functionality
              router.back();
            }}>
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={!expenseData || isLoading}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{value}</ThemedText>
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
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  editButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    flex: 1,
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
