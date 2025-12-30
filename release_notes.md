# LiberAudio v1.1.0 - The "Polished & Compatible" Update

We are excited to bring you a massive update focused on User Experience and wider compatibility!

## 🌟 What's New?

### 🔓 No More API Key Setup!
**Major Change:** We now host our own dedicated backend service to handle Spotify authentication.
- **Plug & Play**: You no longer need to create a Spotify Developer account or copy-paste Client IDs/Secrets.
- **Zero Configuration**: Just open the app and start downloading immediately. It's that simple.

### 🎨 Beautiful New UX (Glassmorphism)
We've completely overhauled the visual experience:
- **Sleek Overlays**: Error messages and loading states now feature a modern, blurry "frosted glass" look.
- **Smart Loading**: Loading spinners now appear elegantly *inside* your track lists.
- **Improved Buttons**: The main action buttons are now bolder and clearer.
- **Private Playlists**: Get notified if you've passed a URL that we can't access.

### 🍏 Broader macOS Support
- **Now Compatible with macOS 10.13 (High Sierra) and newer!** (Previously required 10.15+)
- We've rebuilt the app engine to support older Intel machines.

### ⚡ Smarter Spotify Backend
- **Wake-up Timer**: Using our free backend? We added a helpful timer to let you know if the server is waking up (takes ~1-2 mins).
- **Auto-Retry**: Increased timeouts to ensure your downloads don't fail just because the server is sleepy.

---

## 📥 Which Version Should I Download?

We now provide two separate versions to ensure maximum performance on your Mac.

### 1. Apple Silicon (M1, M2, M3)
> [**Universal.Music.Downloader-v1.1.0-macOS-arm64.dmg**](https://github.com/Wirthzig/universal-music-downloader/releases/latest/download/Universal.Music.Downloader-v1.1.0-macOS-arm64.dmg)

**Use this if:**
- You have a Mac with an **M1, M2, or M3 chip** (2020 or newer).
- *How to check:* Click the Apple Logo  > About This Mac. If it says "Chip: Apple M1/M2/M3", download this one.

### 2. Intel Macs (Older Models)
> [**Universal.Music.Downloader-v1.1.0-macOS-x64.dmg**](https://github.com/Wirthzig/universal-music-downloader/releases/latest/download/Universal.Music.Downloader-v1.1.0-macOS-x64.dmg)

**Use this if:**
- You have a Mac with an **Intel Processor** (Most Macs before late 2020).
- *How to check:* Click the Apple Logo  > About This Mac. If it says "Processor: Intel Core i...", download this one.

---

## 🛠️ Required Setup (One-Time Fix)

Because this app is open-source and not signed by Apple ($99/yr), macOS will quarantine it by default.

**If you see "App is damaged" or can't open it:**
1.  Move the App to your **Applications** folder.
2.  Open **Terminal**.
3.  Paste this command and hit Enter:
    ```bash
    sudo xattr -cr /Applications/Universal\ Music\ Downloader.app
    ```
4.  Enter your password (it won't show while typing) and hit Enter.
5.  Open the app!

---

### ⚠️ Legal Disclaimer
This software is a **Proof of Concept** designed strictly for educational purposes.
*   **Do not use this tool to download copyrighted content.** You must respect the Terms of Service of Spotify, SoundCloud, and YouTube.
*   The authors and contributors are **not responsible** for any misuse of this software or any legal consequences arising from its use.
*   **For Personal Use Only.** Do not distribute or sell this software.

---

### ☕ Support Us
If you enjoy the app, consider buying us a coffee! It helps us keep the backend servers awake and the updates coming.
[**Buy us a Coffee on Ko-fi**](https://ko-fi.com/liberaudio)

*Happy Downloading!* 🎵
