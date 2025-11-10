import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Conditionally import expo-speech-recognition (only available in development builds, not Expo Go)
let ExpoSpeechRecognitionModule: any = null;
try {
  if (Platform.OS !== 'web') {
    const speechRecognition = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule = speechRecognition.ExpoSpeechRecognitionModule;
  }
} catch (e) {
  // Module not available (e.g., in Expo Go)
  // This is expected in Expo Go - the module requires a development build
  console.log('expo-speech-recognition not available (requires development build)');
}

export default function RecordScreen() {
  const [transcription, setTranscription] = useState('');
  const [isStopped, setIsStopped] = useState(false);
  const colorScheme = useColorScheme();
  const router = useRouter();
  const waveformAnimations = useRef<Animated.Value[]>(
    Array.from({ length: 50 }, () => new Animated.Value(0.3))
  ).current;
  const isRecordingRef = useRef(false);

  // Create audio recorder with high quality preset
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Set up speech recognition event listeners
  useEffect(() => {
    // Check if module is available (may not be in Expo Go)
    if (!ExpoSpeechRecognitionModule || !ExpoSpeechRecognitionModule.addListener) {
      return;
    }

    // Set up event listeners for speech recognition results
    const resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
      if (event.results && event.results.length > 0) {
        // Get the most recent result
        const latestResult = event.results[event.results.length - 1];
        const transcript = latestResult.transcript || '';
        
        if (transcript) {
          setTranscription(transcript);
          console.log('Partial transcription:', transcript);
        }

        if (event.isFinal) {
          console.log('Final transcription:', transcript);
        }
      }
    });

    const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
      console.error('Speech recognition error:', event.error, event.message);
    });

    return () => {
      resultSubscription?.remove();
      errorSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Request permissions and set audio mode
    (async () => {
      // Request audio recording permissions
      const audioStatus = await requestRecordingPermissionsAsync();
      if (!audioStatus.granted) {
        console.log('Permission to access microphone was denied');
        return;
      }

      // Request speech recognition permissions
      try {
        if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.requestPermissionsAsync) {
          const speechStatus = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!speechStatus.granted) {
            console.log('Speech recognition permission denied');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to request speech recognition permissions:', error);
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      // Auto-start recording when component mounts
      startRecording();
    })();

    // Cleanup on unmount
    return () => {
      stopRecording();
    };
  }, []);

  // Animate waveform bars
  useEffect(() => {
    if (recorderState.isRecording) {
      const animations = waveformAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.3 + 0.1,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        );
      });

      animations.forEach((anim) => anim.start());

      return () => {
        animations.forEach((anim) => anim.stop());
      };
    } else {
      waveformAnimations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [recorderState.isRecording]);

  async function startRecording() {
    try {
      // Prepare and start audio recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      isRecordingRef.current = true;
      setTranscription(''); // Reset transcription
      setIsStopped(false); // Reset stopped state

      // Start speech recognition
      try {
        if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.start) {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
          console.log('Speech recognition started');
        } else {
          console.log('Speech recognition module not available (requires development build)');
        }
      } catch (speechErr) {
        console.error('Failed to start speech recognition:', speechErr);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    try {
      isRecordingRef.current = false;

      // Stop speech recognition
      try {
        if (ExpoSpeechRecognitionModule && ExpoSpeechRecognitionModule.stop) {
          ExpoSpeechRecognitionModule.stop();
          console.log('Speech recognition stopped');
        }
      } catch (speechErr) {
        console.error('Error stopping speech recognition:', speechErr);
      }

      // Stop audio recording - check if recorder is actually recording
      if (recorderState.isRecording) {
        // Get the URI before stopping (the recorder becomes invalid after stop)
        let recordingUri: string | null = null;
        try {
          recordingUri = audioRecorder.uri || null;
        } catch (uriErr) {
          // URI might not be available yet, that's okay
          console.log('Could not get recording URI before stop:', uriErr);
        }
        
        await audioRecorder.stop();
        
        // Log the recording URI if we got it before stopping
        if (recordingUri) {
          console.log('Recording saved at:', recordingUri);
        }
      }

      // Log final transcription when stopping
      if (transcription) {
        console.log('Final transcription on stop:', transcription);
      }

      // Mark recording as stopped
      setIsStopped(true);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  const handleCancel = () => {
    stopRecording();
    router.back();
  };

  const handleMicPress = () => {
    if (recorderState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleExpenseIt = () => {
    if (transcription) {
      router.push({
        pathname: '/transcription',
        params: { text: transcription },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ThemedView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            New Expense
          </ThemedText>
        </View>

        {/* Transcription - Centered in middle of screen */}
        <View style={styles.transcriptionContainer}>
          {transcription ? (
            <ThemedText style={styles.transcriptionText}>
              {transcription}
            </ThemedText>
          ) : (
            <ThemedText style={[styles.transcriptionText, styles.placeholder]}>
              Listening...
            </ThemedText>
          )}
        </View>

        {/* Waveform Visualization */}
        <View style={styles.waveformContainer}>
          {waveformAnimations.map((anim, index) => {
            const isCenter = index === Math.floor(waveformAnimations.length / 2);
            const distanceFromCenter = Math.abs(index - waveformAnimations.length / 2);
            const maxDistance = waveformAnimations.length / 2;
            const opacity = 1 - distanceFromCenter / maxDistance;

            const baseHeight = isCenter ? 40 : 24;
            const minHeight = 8;
            const scaleY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [minHeight / baseHeight, 1],
            });

            return (
              <View
                key={index}
                style={[
                  styles.waveformBarContainer,
                  { height: baseHeight, opacity: recorderState.isRecording ? opacity : 0.3 },
                ]}>
                <Animated.View
                  style={[
                    styles.waveformBar,
                    {
                      height: baseHeight,
                      transform: [{ scaleY }],
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Microphone/Stop Button or Expense It Button */}
        <View style={styles.micContainer}>
          {recorderState.isRecording ? (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleMicPress}
              activeOpacity={0.8}>
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          ) : isStopped && transcription ? (
            <TouchableOpacity
              style={styles.expenseButton}
              onPress={handleExpenseIt}
              activeOpacity={0.8}>
              <Text style={styles.expenseButtonText}>Expense It</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleMicPress}
              activeOpacity={0.8}>
              <Ionicons name="mic" size={32} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
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
  cancelButton: {
    alignSelf: 'flex-start',
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
  },
  transcriptionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  transcriptionText: {
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
  },
  placeholder: {
    opacity: 0.5,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 60,
    marginBottom: 60,
    gap: 3,
  },
  waveformBarContainer: {
    justifyContent: 'flex-end',
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#007AFF',
    borderRadius: 1.5,
  },
  micContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  expenseButton: {
    width: 200,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  expenseButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
