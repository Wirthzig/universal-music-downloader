# How to Publish v1.1.0 (with Auto-Update)

## 1. Build the App
Run the build command to generate the new release assets:
```bash
npm run build
```

## 2. Locate Assets
Go to the `dist_app` folder. You will see:
- `LiberAudio-v1.1.0-macOS-arm64.dmg` (M1/M2/M3)
- `LiberAudio-v1.1.0-macOS-x64.dmg` (Intel)
- `latest-mac.yml` (CRITICAL FOR AUTO-UPDATE)

## 3. Create GitHub Release
1.  Go to **GitHub > Releases > Draft a new release**.
2.  **Tag version**: `v1.1.0`
3.  **Release title**: `LiberAudio v1.1.0`
4.  **Description**: Copy-paste the content from `release_notes.md`.

## 4. Upload Assets (CRITICAL)
You must upload **ALL THREE** files to the release:
1.  `LiberAudio-v1.1.0-macOS-arm64.dmg`
2.  `LiberAudio-v1.1.0-macOS-x64.dmg`
3.  `latest-mac.yml` <-- **The app uses this file to detect updates!**

## 5. Publish
Click **Publish release**.

---
**Note on Auto-Update**:
When users open v1.0.0, it will check the `latest-mac.yml` url on your GitHub. Since you just uploaded a new one with version 1.1.0, the app will see the difference, download the new DMG in the background, and prompt the user to restart! 🚀
