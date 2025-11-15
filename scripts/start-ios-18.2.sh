#!/bin/bash

# Script to start Expo with iOS 18.2 simulator

echo "Setting up iOS 18.2 simulator..."

# Shut down iOS 18.4 simulator if it's running
xcrun simctl shutdown "Expo iPhone 18.4" 2>/dev/null || true

# Find an iOS 18.2 simulator device name (format: "iPhone 15 (iOS 18.2)")
IOS_18_2_DEVICE=$(xcrun simctl list devices available | grep -i "iPhone.*18\.2" | head -1 | sed -E 's/^[[:space:]]*([^(]+\([^)]+\)).*/\1/' | xargs)

if [ -z "$IOS_18_2_DEVICE" ]; then
    echo "Error: No iOS 18.2 simulator found"
    echo "Available iOS simulators:"
    xcrun simctl list devices available | grep -i "iPhone"
    exit 1
fi

echo "Booting iOS 18.2 simulator: $IOS_18_2_DEVICE"
xcrun simctl boot "$IOS_18_2_DEVICE" 2>/dev/null || echo "Simulator may already be booted"

# Open Simulator app
open -a Simulator

# Wait a moment for simulator to be ready
sleep 2

echo "Clearing Metro cache..."
rm -rf .metro
rm -rf node_modules/.cache

echo "Starting Expo..."
npx expo start --ios --clear

