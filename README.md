# My Membership Card Wallet App

A simple private iPhone web app / PWA for storing membership cards and displaying barcodes.

## Features

- Main menu with:
  - All saved membership cards
  - Add New Card button
- Add card:
  - Card/store name
  - Optional photo of original card
  - Manual membership number entry
  - Camera/photo barcode scan attempt
  - Auto-detected barcode type when scanner succeeds
- Saved card detail:
  - Barcode display
  - Full-screen barcode mode
  - Optional original card photo
  - Notes
- Local private storage in the browser via IndexedDB
- Backup export/import as JSON

## Important limitations

- Browser-based barcode scanning is not as reliable as a native iPhone app.
- iPhone camera permissions require HTTPS hosting.
- Some retailers use rotating/dynamic barcodes or require their own app/physical card.
- If auto-scan fails, enter the membership number manually and choose Code 128 first.

## How to test locally on a computer

1. Unzip this folder.
2. Open `index.html` in a browser.
3. Manual entry and barcode generation should work.
4. Camera scanning usually requires HTTPS or localhost.

## How to make it usable on iPhone

Recommended beginner route:

1. Create a free GitHub account.
2. Create a new public or private repository.
3. Upload these files.
4. Enable GitHub Pages for the repository.
5. Open the GitHub Pages URL in Safari on iPhone.
6. Tap Share → Add to Home Screen.

## Privacy note

Your saved cards are stored locally in the browser/device. They are not sent to a backend server by this app. The current MVP uses CDN-hosted JavaScript libraries for barcode generation and scanning; the membership numbers are processed in your browser.


## Version 1.1 fix

- Fixed `Choose Existing Photo to Scan` so it opens the iPhone photo/file picker instead of forcing the camera.
- Bumped the service worker cache version so the updated app can refresh properly after being uploaded to GitHub Pages.
