import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
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
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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
        setReceiptImageUri((note as any).receipt_image_url || null);
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

  // Request permissions for image picker
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant photo library access to attach receipts.');
        }
      }
    })();
  }, []);

  // Function to pick image from library
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setReceiptImageUri(imageUri);
        await uploadImageToSupabase(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Function to upload image to Supabase Storage
  const uploadImageToSupabase = async (imageUri: string) => {
    try {
      setIsUploadingImage(true);

      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated. Please log in again.');
      }

      if (!id) {
        throw new Error('Expense ID is missing');
      }

      // Read the image file
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${id}_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        // If upload fails, clear the local URI so we don't try to save it
        console.error('Upload error:', uploadError);
        setReceiptImageUri(null);
        Alert.alert(
          'Upload Failed',
          'Could not upload image to cloud storage. Please try again or continue without the image.',
        );
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setReceiptImageUri(urlData.publicUrl);
      } else {
        // If we can't get the URL, clear the state
        setReceiptImageUri(null);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      // Clear the image state on error
      setReceiptImageUri(null);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Function to remove image
  const removeImage = () => {
    Alert.alert(
      'Remove Receipt',
      'Are you sure you want to remove this receipt image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setReceiptImageUri(null),
        },
      ],
    );
  };

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

      // Only include receipt_image_url if it's a valid URL (not a local file URI)
      // Check if it's a valid URL (starts with http:// or https://)
      const isValidImageUrl = receiptImageUri && 
        (receiptImageUri.startsWith('http://') || receiptImageUri.startsWith('https://'));

      // Build update object conditionally
      const updateData: any = {
        amount: numericAmount,
        date_of_transaction: dateString,
        description: memo || null,
        category: category || null,
      };

      // Only add receipt_image_url if column exists and we have a valid URL
      // We'll try to include it, but if the column doesn't exist, Supabase will ignore it
      if (isValidImageUrl) {
        updateData.receipt_image_url = receiptImageUri;
      } else if (receiptImageUri === null) {
        // Explicitly set to null to clear existing images
        updateData.receipt_image_url = null;
      }

      // Update the note in the database
      const { error: updateError } = await supabase
        .from('notes')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        // Check if error is about missing column
        if (updateError.message.includes('receipt_image_url') || 
            updateError.message.includes('schema cache')) {
          // Column doesn't exist - update without the image URL
          const { error: retryError } = await supabase
            .from('notes')
            .update({
              amount: numericAmount,
              date_of_transaction: dateString,
              description: memo || null,
              category: category || null,
            })
            .eq('id', id);

          if (retryError) {
            throw new Error(`Failed to update expense: ${retryError.message}`);
          }
          
          // Show warning that image wasn't saved
          if (isValidImageUrl) {
            Alert.alert(
              'Update Successful',
              'Expense updated, but receipt image could not be saved. Please add the receipt_image_url column to your database.',
              [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ],
            );
            return;
          }
        } else {
          throw new Error(`Failed to update expense: ${updateError.message}`);
        }
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
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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

          {/* Receipt Image Section */}
          <View style={styles.receiptSection}>
            <ThemedText style={styles.receiptLabel}>Receipt</ThemedText>
            {receiptImageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: receiptImageUri }} style={styles.receiptImage} />
                <View style={styles.imageActions}>
                  <TouchableOpacity
                    style={styles.imageButton}
                    onPress={pickImage}
                    disabled={isUploadingImage}>
                    {isUploadingImage ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={20} color="#007AFF" />
                        <Text style={styles.imageButtonText}>Change</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.imageButton, styles.removeButton]}
                    onPress={removeImage}
                    disabled={isUploadingImage}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    <Text style={[styles.imageButtonText, styles.removeButtonText]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImage}
                disabled={isUploadingImage}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color="#007AFF" />
                    <Text style={styles.addImageText}>Attach Receipt</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
        </ScrollView>
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
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
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
  receiptSection: {
    marginBottom: 32,
  },
  receiptLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
    marginBottom: 12,
  },
  addImageButton: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addImageText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#007AFF',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    backgroundColor: '#F9F9F9',
  },
  imageActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
  },
  removeButton: {
    backgroundColor: '#FFF0F0',
  },
  imageButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
  removeButtonText: {
    color: '#FF3B30',
  },
});

