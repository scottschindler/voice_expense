import { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Expense {
  id: string;
  day: number;
  description: string;
  amount: number;
}

interface ExpenseGroup {
  month: string;
  year: number;
  expenses: Expense[];
}

// Sample data matching the screenshot
const sampleExpenses: ExpenseGroup[] = [
  {
    month: 'APRIL',
    year: 2024,
    expenses: [
      { id: '1', day: 17, description: 'Office Supplies', amount: 15.0 },
      { id: '2', day: 16, description: 'Dinner with Client', amount: 42.0 },
      { id: '3', day: 15, description: 'Lunch', amount: 8.99 },
      { id: '4', day: 15, description: 'Flight', amount: 114.0 },
    ],
  },
  {
    month: 'MARCH',
    year: 2024,
    expenses: [
      { id: '5', day: 28, description: 'Software Subscription', amount: 19.99 },
    ],
  },
];

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Calculate total expenses
  const totalExpenses = sampleExpenses.reduce((sum, group) => {
    return sum + group.expenses.reduce((groupSum, expense) => groupSum + expense.amount, 0);
  }, 0);

  // Format amount with comma as decimal separator (as shown in screenshot)
  const formatAmount = (amount: number) => {
    return amount.toFixed(2).replace('.', ',');
  };

  // Filter expenses based on search query
  const filteredExpenses = sampleExpenses.map((group) => ({
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

        {/* Total Expenses */}
        <View style={styles.totalSection}>
          <ThemedText style={styles.totalText}>
            Total {formatAmount(totalExpenses)}
          </ThemedText>
        </View>

        {/* Expense List */}
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
                    <ThemedText style={styles.expenseDay}>{expense.day}</ThemedText>
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
  totalSection: {
    marginBottom: 20,
  },
  totalText: {
    fontSize: 17,
    fontWeight: '600',
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
  expenseDay: {
    fontSize: 17,
    fontWeight: '400',
    minWidth: 30,
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
  fab: {
    position: 'absolute',
    bottom: 24,
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
