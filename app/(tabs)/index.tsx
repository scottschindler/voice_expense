import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/utils/supabase';

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

  // Format amount as whole dollars without decimals
  const formatAmount = (amount: number) => {
    return Math.round(amount).toString();
  };

  // Filter expenses based on search query
  const filteredExpenses = expenseGroups.map((group) => ({
    ...group,
    expenses: group.expenses.filter(
      (expense) =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.expenses.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Expenses
          </ThemedText>
        </View>

        {/* Search and Add Section */}
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
            style={[
              styles.addButton,
              isDark && styles.addButtonDark,
            ]}>
            <Ionicons
              name="add"
              size={24}
              color={isDark ? '#ECEDEE' : '#11181C'}
            />
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
            showsVerticalScrollIndicator={false}>
            {filteredExpenses.map((group, groupIndex) => (
              <View key={`${group.month}-${group.year}`} style={styles.expenseGroup}>
                <ThemedText style={styles.monthHeader}>
                  {group.month} {group.year}
                </ThemedText>
                {group.expenses.map((expense) => (
                  <View
                    key={expense.id}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
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
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  expenseList: {
    flex: 1,
  },
  expenseListContent: {
    paddingBottom: 100, // Space for FAB
  },
  expenseGroup: {
    marginBottom: 24,
  },
  monthHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.6,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  expenseItem: {
    marginBottom: 16,
  },
  lastExpenseItem: {
    marginBottom: 0,
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
  },
  expenseDescription: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
  },
  expenseAmount: {
    fontSize: 17,
    fontWeight: '400',
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
    opacity: 0.6,
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
