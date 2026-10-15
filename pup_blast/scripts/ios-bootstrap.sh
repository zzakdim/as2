#!/usr/bin/env bash
# One-shot iOS setup and simulator build, run on a Mac from the pup_blast folder:
#   ./scripts/ios-bootstrap.sh [--admob-app-id ca-app-pub-XXXX~YYYY]
# Needs Xcode (with a simulator runtime) and Node 20+. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v xcodebuild >/dev/null || { echo "Xcode isn't installed (xcodebuild missing). Install it from the App Store, open it once, then rerun."; exit 1; }
command -v node >/dev/null || { echo "Node isn't installed. Install Node 20+ (e.g. 'brew install node'), then rerun."; exit 1; }

echo "== npm install"
npm install

if [ ! -d ios ]; then
  echo "== npx cap add ios"
  npx cap add ios
fi

echo "== wiring (Game Center plugin, AdMob keys)"
node scripts/ios-setup.mjs "$@"

echo "== npx cap sync ios"
npx cap sync ios

echo "== simulator build (no signing needed)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/App/build \
  CODE_SIGNING_ALLOWED=NO build | tail -n 25

echo
echo "Build finished. Next, in Xcode (npx cap open ios):"
echo "  1. Signing & Capabilities: pick your team, + Game Center, + In-App Purchase."
echo "  2. Run on a simulator or your iPhone."
