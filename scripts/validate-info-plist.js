#!/usr/bin/env node

/**
 * Validates iOS Info.plist configuration to catch missing permission strings
 * before submitting to App Store Connect.
 * 
 * This script checks app.json for required Info.plist keys based on:
 * - APIs used in the app
 * - Dependencies that may require permissions
 * - Common Apple requirements
 */

const fs = require('fs');
const path = require('path');

// Required Info.plist keys and their descriptions
// Add more as you discover them or add new features
const REQUIRED_KEYS = {
  // Privacy permissions (required if APIs are referenced, even indirectly)
  NSPhotoLibraryUsageDescription: {
    required: true,
    reason: 'Required if any dependency references photo library APIs (e.g., expo-image, image pickers)',
    checkDependencies: ['expo-image']
  },
  NSPhotoLibraryAddUsageDescription: {
    required: false,
    reason: 'Required if app saves photos to library',
    checkDependencies: []
  },
  NSCameraUsageDescription: {
    required: false,
    reason: 'Required if app uses camera',
    checkDependencies: []
  },
  NSMicrophoneUsageDescription: {
    required: true,
    reason: 'Required for audio recording',
    checkDependencies: ['expo-audio', 'expo-av']
  },
  NSSpeechRecognitionUsageDescription: {
    required: true,
    reason: 'Required for speech recognition',
    checkDependencies: ['expo-speech-recognition']
  },
  NSLocationWhenInUseUsageDescription: {
    required: false,
    reason: 'Required if app accesses location',
    checkDependencies: []
  },
  NSLocationAlwaysUsageDescription: {
    required: false,
    reason: 'Required if app accesses location in background',
    checkDependencies: []
  },
  NSContactsUsageDescription: {
    required: false,
    reason: 'Required if app accesses contacts',
    checkDependencies: []
  },
  NSCalendarsUsageDescription: {
    required: false,
    reason: 'Required if app accesses calendar',
    checkDependencies: []
  },
  NSRemindersUsageDescription: {
    required: false,
    reason: 'Required if app accesses reminders',
    checkDependencies: []
  },
  NSMotionUsageDescription: {
    required: false,
    reason: 'Required if app accesses motion data',
    checkDependencies: []
  },
  NSBluetoothAlwaysUsageDescription: {
    required: false,
    reason: 'Required if app uses Bluetooth',
    checkDependencies: []
  },
  NSBluetoothPeripheralUsageDescription: {
    required: false,
    reason: 'Required if app uses Bluetooth (iOS 12 and earlier)',
    checkDependencies: []
  },
  NSFaceIDUsageDescription: {
    required: false,
    reason: 'Required if app uses Face ID directly (not needed for Apple Sign In)',
    checkDependencies: []
  },
  // Other required keys
  ITSAppUsesNonExemptEncryption: {
    required: true,
    reason: 'Required by Apple for App Store submissions',
    checkDependencies: []
  }
};

function readPackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function readAppJson() {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    throw new Error('app.json not found');
  }
  return JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
}

function checkDependencies(packageJson, keyConfig) {
  if (!keyConfig.checkDependencies || keyConfig.checkDependencies.length === 0) {
    return true; // No dependency check needed
  }
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  return keyConfig.checkDependencies.some(dep => 
    Object.keys(allDeps).some(pkg => pkg === dep || pkg.startsWith(dep + '/'))
  );
}

function validateInfoPlist() {
  console.log('🔍 Validating iOS Info.plist configuration...\n');
  
  const packageJson = readPackageJson();
  const appJson = readAppJson();
  
  const infoPlist = appJson?.expo?.ios?.infoPlist || {};
  const errors = [];
  const warnings = [];
  
  // Check each required key
  for (const [key, config] of Object.entries(REQUIRED_KEYS)) {
    const hasDependency = config.checkDependencies && config.checkDependencies.length > 0 
      ? checkDependencies(packageJson, config)
      : false;
    const isPresent = key in infoPlist;
    const value = infoPlist[key];
    
    // Check if key is required (either marked as required OR dependency that requires it is present)
    const isRequired = config.required || (hasDependency && config.checkDependencies.length > 0);
    
    if (isRequired && !isPresent) {
      errors.push({
        key,
        reason: config.reason,
        hasDependency,
        message: `Missing required key: ${key}`
      });
    } else if (isRequired && isPresent && typeof value === 'string' && value.trim().length === 0) {
      errors.push({
        key,
        reason: config.reason,
        message: `Empty value for required key: ${key}`
      });
    } else if (isPresent && typeof value === 'string' && value.trim().length < 10) {
      warnings.push({
        key,
        message: `Value for ${key} is very short (${value.length} chars). Apple recommends descriptive purpose strings.`
      });
    }
  }
  
  // Check for common issues
  if (infoPlist.ITSAppUsesNonExemptEncryption === undefined) {
    errors.push({
      key: 'ITSAppUsesNonExemptEncryption',
      reason: 'Required by Apple for App Store submissions',
      message: 'Missing required key: ITSAppUsesNonExemptEncryption'
    });
  }
  
  // Print results
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All Info.plist checks passed!\n');
    return true;
  }
  
  if (errors.length > 0) {
    console.error('❌ Errors found:\n');
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error.message}`);
      console.error(`   Reason: ${error.reason}`);
      if (error.hasDependency) {
        console.error(`   Note: A dependency requires this permission`);
      }
      console.error('');
    });
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:\n');
    warnings.forEach((warning, index) => {
      console.warn(`${index + 1}. ${warning.message}\n`);
    });
  }
  
  if (errors.length > 0) {
    console.error('\n💡 Tip: Add missing keys to app.json under expo.ios.infoPlist');
    console.error('   Example:');
    console.error('   "infoPlist": {');
    console.error('     "NSPhotoLibraryUsageDescription": "Your purpose string here"');
    console.error('   }');
    console.error('');
    return false;
  }
  
  return true;
}

// Run validation
if (require.main === module) {
  try {
    const isValid = validateInfoPlist();
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

module.exports = { validateInfoPlist };

