# Backlog

Ideas evaluated and parked for later.

## Sharing

Replacing interstitial ads with "text a friend" prompts loses money on iOS. A shared iMessage link lands on the
App Store, not in a playable game the way WeChat mini-games do, so few shares become installs. Estimate:
about 1 install per 300 prompts (roughly 50¢) against $3–6 of interstitial revenue from the same slots.

Status (1.1, build 3): 1 and 2 are built (www/js/share.js; INVITE_REWARD in main.js turns the invite reward off); 3's art is ready in native/ios/Stickers.xcstickers (store/make-stickers.cjs), the Xcode target is added by hand; 4 stays parked.
1. **Brag cards**: an optional Share button after big moments (Legendary dig, max-level pup, new world,
   new best). A card image with the pup and the App Store link, shared through the iOS share sheet.
   1–2 sessions. Needs the App Store link and the Share + Filesystem Capacitor plugins.
2. **Invite for a free dig**: once a week at the Dig Spot, rewarded only when the share sheet reports the
   share completed. Half a session alongside 1. Allowed by Apple as long as it's optional.
3. **iMessage sticker pack** of the 24 pups. 1–2 sessions, mostly Xcode. Good as an early update.
4. **Two-sided referrals** ("you both get 3 digs"): needs a server or an attribution SDK. Not before launch.
