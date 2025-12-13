import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Expense {
  id: string;
  day: number;
  month: number;
  description: string;
  amount: number;
}

interface ExpenseGroup {
  month: string;
  year: number;
  expenses: Expense[];
}

interface Note {
  id: string;
  user_id: string;
  email: string;
  amount: number;
  date_of_transaction: string;
  description: string | null;
  category: string | null;
  transcript: string | null;
  created_at: string;
}

const transformNotesToExpenseGroups = (notes: Note[]): ExpenseGroup[] => {
  // Group notes by month and year
  const grouped = notes.reduce((acc, note) => {
    const date = new Date(note.date_of_transaction);
    const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const year = date.getFullYear();
    const day = date.getDate();
    
    const key = `${month}-${year}`;
    
    if (!acc[key]) {
      acc[key] = {
        month,
        year,
        expenses: [],
      };
    }
    
    acc[key].expenses.push({
      id: note.id,
      day,
      month: date.getMonth() + 1, // getMonth() returns 0-11, so add 1
      description: note.description || note.transcript || 'No description',
      amount: Number(note.amount),
    });
    
    return acc;
  }, {} as Record<string, ExpenseGroup>);

  // Convert to array and sort by date (newest first)
  return Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    const monthOrder: Record<string, number> = {
      'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
      'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
      'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
    };
    return monthOrder[b.month] - monthOrder[a.month];
  });
};

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseGroups, setExpenseGroups] = useState<ExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        setExpenseGroups([]);
        return;
      }

      // Fetch notes for the current user, ordered by date (newest first)
      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date_of_transaction', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
        setExpenseGroups([]);
        return;
      }

      // Transform notes into expense groups
      const groups = transformNotesToExpenseGroups(notes || []);
      setExpenseGroups(groups);
    } catch (error) {
      console.error('Error in fetchNotes:', error);
      setExpenseGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    
    // Set up real-time subscription for notes changes
    const notesSubscription = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
        },
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      notesSubscription.unsubscribe();
    };
  }, [fetchNotes]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  // Format amount with two decimal places
  const formatAmount = (amount: number) => {
    return amount.toFixed(2);
  };

  // Store refs for swipeable components to close them
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  // Handle edit expense - navigate to edit screen with expense ID
  const handleEditExpense = (expenseId: string) => {
    // Close the swipeable
    const swipeable = swipeableRefs.current.get(expenseId);
    if (swipeable) {
      swipeable.close();
    }
    
    // Navigate to edit screen with expense ID
    router.push({
      pathname: '/edit-expense',
      params: { id: expenseId },
    });
  };

  // Delete expense from Supabase
  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', expenseId);

      if (error) {
        console.error('Error deleting expense:', error);
        Alert.alert('Error', 'Failed to delete expense. Please try again.');
        return;
      }

      // Close the swipeable
      const swipeable = swipeableRefs.current.get(expenseId);
      if (swipeable) {
        swipeable.close();
      }

      // Refresh the list
      fetchNotes();
    } catch (error) {
      console.error('Error in handleDeleteExpense:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  // Render delete action for swipeable (swipe left)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    expenseId: string
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteExpense(expenseId)}
          activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render edit action for swipeable (swipe right)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    expenseId: string
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [-80, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.editAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditExpense(expenseId)}
          activeOpacity={0.8}>
          <Ionicons name="create-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Filter expenses based on search query
  const filteredExpenses = expenseGroups.map((group) => ({
    ...group,
    expenses: group.expenses.filter(
      (expense) =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.expenses.length > 0);

  // Handle CSV export
  const handleExportCSV = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Please log in to export your data.');
        return;
      }

      // Fetch all notes for the current user
      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date_of_transaction', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
        Alert.alert('Error', 'Failed to fetch expenses. Please try again.');
        return;
      }

      if (!notes || notes.length === 0) {
        Alert.alert('No Data', 'You have no expenses to export.');
        return;
      }

      // Create CSV header
      const csvHeader = 'ID,Date,Amount,Description,Category,Transcript,Email,Created At\n';
      
      // Convert notes to CSV rows
      const csvRows = notes.map((note) => {
        // Escape commas and quotes in CSV values
        const escapeCSV = (value: any) => {
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          // If value contains comma, quote, or newline, wrap in quotes and escape quotes
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        };

        return [
          escapeCSV(note.id),
          escapeCSV(note.date_of_transaction),
          escapeCSV(note.amount),
          escapeCSV(note.description),
          escapeCSV(note.category),
          escapeCSV(note.transcript),
          escapeCSV(note.email),
          escapeCSV(note.created_at),
        ].join(',');
      });

      // Combine header and rows
      const csvContent = csvHeader + csvRows.join('\n');

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `expenses_${timestamp}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      // Write file (UTF-8 is the default encoding)
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Expenses',
        });
      } else {
        Alert.alert('Success', `CSV file saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GestureHandlerRootView style={styles.statusBarBackground}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ThemedView style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <ThemedText type="title" style={styles.title}>
                  Expenses
                </ThemedText>
                <TouchableOpacity
                  style={[
                    styles.exportButton,
                    isDark && styles.exportButtonDark,
                  ]}
                  onPress={handleExportCSV}
                  disabled={loading}
                  activeOpacity={0.7}>
                  <Ionicons 
                    name="download-outline" 
                    size={24} 
                    color={isDark ? '#ECEDEE' : '#007AFF'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

          {/* Search Section */}
          <View style={styles.searchSection}>
            <View
              style={[
                styles.searchBar,
                isDark && styles.searchBarDark,
              ]}>
              <Ionicons
                name="search"
                size={18}
                color={isDark ? '#9BA1A6' : '#687076'}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  isDark && styles.searchInputDark,
                ]}
                placeholder="Search"
                placeholderTextColor={isDark ? '#9BA1A6' : '#687076'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.7}
              onPress={() => router.push('/add-expense')}>
              <Ionicons name="add" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {/* Expense List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? '#ECEDEE' : '#11181C'} />
            </View>
          ) : filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                {searchQuery ? 'No expenses found' : 'No expenses yet'}
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              style={styles.expenseList}
              contentContainerStyle={styles.expenseListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {filteredExpenses.map((group, groupIndex) => (
                <View key={`${group.month}-${group.year}`} style={styles.expenseGroup}>
                  <ThemedText style={styles.monthHeader}>
                    {group.month} {group.year}
                  </ThemedText>
                  {group.expenses.map((expense) => (
                    <Swipeable
                      key={expense.id}
                      ref={(ref) => {
                        if (ref) {
                          swipeableRefs.current.set(expense.id, ref);
                        } else {
                          swipeableRefs.current.delete(expense.id);
                        }
                      }}
                      renderRightActions={(progress, dragX) =>
                        renderRightActions(progress, dragX, expense.id)
                      }
                      renderLeftActions={(progress, dragX) =>
                        renderLeftActions(progress, dragX, expense.id)
                      }
                      overshootRight={false}
                      overshootLeft={false}
                      friction={2}>
                      <View
                        style={[
                          styles.expenseItem,
                          groupIndex === filteredExpenses.length - 1 &&
                            expense.id === group.expenses[group.expenses.length - 1].id &&
                            styles.lastExpenseItem,
                        ]}>
                        <View style={styles.expenseContent}>
                          <ThemedText style={styles.expenseDate}>
                            {expense.month}/{expense.day}
                          </ThemedText>
                          <ThemedText style={styles.expenseDescription}>
                            {expense.description}
                          </ThemedText>
                          <ThemedText style={styles.expenseAmount}>
                            ${formatAmount(expense.amount)}
                          </ThemedText>
                        </View>
                      </View>
                    </Swipeable>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Floating Action Button */}
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/record')}>
            <Ionicons name="mic" size={28} color="#fff" />
          </TouchableOpacity>
        </ThemedView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  statusBarBackground: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 48,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
  },
  exportButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  exportButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  searchBarDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#11181C',
    padding: 0,
  },
  searchInputDark: {
    color: '#ECEDEE',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseList: {
    flex: 1,
  },
  expenseListContent: {
    paddingBottom: 100, // Space for FAB
    overflow: 'visible',
  },
  expenseGroup: {
    marginBottom: 24,
    overflow: 'visible',
  },
  monthHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#555',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  expenseItem: {
    marginBottom: 24,
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  lastExpenseItem: {
    marginBottom: 8,
  },
  deleteAction: {
    width: 80,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 80,
    height: 50,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  editAction: {
    width: 80,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    width: 80,
    height: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  expenseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  expenseDate: {
    fontSize: 17,
    fontWeight: '400',
    minWidth: 50,
    color: '#000',
  },
  expenseDescription: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
  },
  expenseAmount: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    color: '#555',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
