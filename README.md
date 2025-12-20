# Universal Music Downloader: The Complete Encyclopedia

**Version**: 1.0.0
**License**: MIT (Educational Use Only)
**Maintainers**: Alexander Wirths
**Documentation Date**: December 2025

---

## 📖 Table of Contents

1.  [Part 1: The Product Manual](#part-1-the-product-manual)
    *   [Introduction](#11-introduction)
    *   [Core Features](#12-core-features)
    *   [Supported Platforms](#13-supported-platforms)
    *   [Installation Guide](#14-installation-guide)
2.  [Part 2: System Architecture](#part-2-system-architecture)
    *   [High-Level Design](#21-high-level-design)
    *   [The "Split-Brain" Model](#22-the-split-brain-model)
    *   [Data Flow Diagrams](#23-data-flow-diagrams)
3.  [Part 3: The Codebase Encyclopedia](#part-3-the-codebase-encyclopedia)
    *   [Directory Structure](#31-directory-structure)
    *   [Electron Backend (`electron/`)](#32-electron-backend)
    *   [React Frontend (`src/`)](#33-react-frontend)
4.  [Part 4: The Engineering Course](#part-4-the-engineering-course)
    *   [Module 1: The Stack](#41-module-1-the-stack)
    *   [Module 2: IPC Bridges](#42-module-2-ipc-bridges)
    *   [Module 3: Child Processes](#43-module-3-child-processes)
    *   [Module 4: Search Algorithms](#44-module-4-search-algorithms)
    *   [Module 5: Self-Healing Binary](#45-module-5-self-healing-binary)
5.  [Part 5: Troubleshooting & FAQ](#part-5-troubleshooting--faq)
    *   [Common Errors](#51-common-errors)
    *   [Debugging Tips](#52-debugging-tips)
6.  [Part 6: API Reference](#part-6-api-reference)
    *   [IPC Channels](#61-ipc-channels)
    *   [Type Definitions](#62-type-definitions)

---

# Part 1: The Product Manual

## 1.1 Introduction
The **Universal Music Downloader** is a sophisticated desktop application engineered to bridge the gap between streaming metadata and local audio files. In an era where music is rented, this tool empowers users to own their library by converting Spotify playlists, SoundCloud tracks, and YouTube videos into high-quality, metadata-tagged M4A files.

Unlike web convertors which operate in a legal gray area on remote servers, this application runs **entirely locally** on your machine. It utilizes the power of your own CPU and Bandwidth, ensuring privacy and speed.

## 1.2 Core Features

### 🎵 Multi-Platform Support
We treat every platform as a first-class citizen.
-   **Spotify**: The metadata source. We read playlists and tracks, then heuristically find the best audio match on YouTube.
-   **SoundCloud**: Direct downloading. We bypass the need for a search engine by pulling audio directly from SoundCloud's CDN.
-   **YouTube**: The universal backend. We can download raw video audio or entire playlists.

### 🧠 Smart Selection Engine
Managing a 500-song playlist is hard. We made it easy.
-   **"Select New"**: A proprietary algorithm that diffs the current playlist against your local download history. One click selects only the songs you *don't* have.
-   **"Select All/None"**: Standard bulk operations for power users.

### 🎨 Visual Themes
Context switching is expensive for the brain. We use color psychology to orient the user instantly.
-   **Spotify View**: Deep Green & Black (Cyberpunk/Hacker aesthetic).
-   **SoundCloud View**: Vibrant Orange & Black (Ink-on-Paper aesthetic).
-   **YouTube View**: Bold Red & White (Clean/Minimalist aesthetic).

### 🛡️ Robust Binary Management
The application comes with `yt-dlp` built-in, but it also knows how to fix it.
-   **Auto-Update**: If the binary is outdated, it fetches a new one.
-   **Integrity Check**: If the binary is corrupt (0-byte file), it deletes and redownloads it.
-   **Permission Fixer**: It automatically runs `chmod +x` and removes macOS quarantine flags.

## 1.3 Supported Platforms

| Platform | Input Types | Download Method | Metadata Quality |
| :--- | :--- | :--- | :--- |
| **Spotify** | Playlists, Albums, Tracks | Heuristic Search (spot2yt) | ⭐⭐⭐⭐⭐ (Perfect) |
| **SoundCloud** | Tracks, Sets, Profiles | Direct Stream Extraction | ⭐⭐⭐⭐ (Good) |
| **YouTube** | Videos, Playlists, Shorts | Direct Stream Extraction | ⭐⭐⭐ (Variable) |

## 1.4 Installation Guide

### Prerequisites
1.  **Node.js**: You must have Node.js v16 or higher installed. (Recommended: v18 LTS).
2.  **Git**: To clone the repository.
3.  **OS**: macOS (Intel or M1/M2/M3) or Windows 10/11.

### Step-by-Step Setup
1.  **Clone the Repo**
    ```bash
    git clone https://github.com/alexanderwirths/spotify-downloader-electron.git
    cd spotify-downloader-electron
    ```

2.  **Install Dependencies**
    We use `npm` to manage packages.
    ```bash
    npm install
    ```
    *Note: This might take a few minutes as it downloads Electron binaries.*

3.  **Start Development Mode**
    ```bash
    npm run dev
    ```
    This command will:
    -   Start the Vite Dev Server on port 5173.
    -   Compile the TypeScript Backend.
    -   Launch the Electron Window.

4.  **Build for Production**
    To create a `.dmg` or `.exe` file:
    ```bash
    npm run build
    ```
    The output will be in the `/dist` or `/release` folder.

---

# Part 2: System Architecture

## 2.1 High-Level Design
The application follows a **Monolithic Desktop Client** architecture.

```mermaid
graph TD
    User[User] --> UI[React Frontend]
    UI --> Bridge[Context Bridge / IPC]
    Bridge --> Main[Electron Main Process]
    Main --> FS[File System]
    Main --> Net[Internet / APIs]
    Main --> Child[Child Process (yt-dlp)]
    Child --> YouTube[YouTube Servers]
    Child --> SoundCloud[SoundCloud Servers]
```

## 2.2 The "Split-Brain" Model
Electron applications are unique because they run two separate environments simultaneously. Understanding this is critical for debugging.

### Zone A: The Renderer (The "Frontend")
-   **Environment**: Chromium (web browser).
-   **Capabilities**: Rendering HTML, CSS, JS.
-   **Limitations**: No file access, no shell access. Sandbox enabled.
-   **Files**: `src/**/*.tsx`, `src/**/*.css`.

### Zone B: The Main Process (The "Backend")
-   **Environment**: Node.js.
-   **Capabilities**: Full Operating System access.
-   **Limitations**: No UI rendering (cannot display HTML).
-   **Files**: `electron/main.ts`, `electron/preload.ts`.

## 2.3 Data Flow Diagrams

### Flow: Searching for a Song
1.  **User** types "Eminem" in `SpotifyView.tsx`.
2.  **React** calls `window.electronAPI.search('Eminem')`.
3.  **Bridge** passes message to `ipcMain`.
4.  **Main** spawns `yt-dlp --print-json "ytsearch5:Eminem"`.
5.  **Child Process** returns JSON string via `stdout`.
6.  **Main** parses JSON and applies **Heuristic Filters**.
7.  **Main** returns the best URL to **Renderer**.
8.  **React** updates state `setSongs(...)`.

---

# Part 3: The Codebase Encyclopedia

This section documents every critical file in the project.

## 3.1 Directory Structure
```
.
├── electron/           # The Node.js Backend
│   ├── main.ts         # The Entry Point & Logic Core
│   └── preload.ts      # The Secure Bridge
├── src/                # The React Frontend
│   ├── assets/         # Images and Static Files
│   ├── components/     # UI Components (Views)
│   ├── utils/          # Helper Functions
│   ├── App.tsx         # Root Component & Router
│   └── main.tsx        # React Entry Point
├── package.json        # Dependencies & Scripts
└── tsconfig.json       # TypeScript Configuration
```

## 3.2 Electron Backend (`electron/`)

### File: `electron/main.ts`
**Role**: The Brain.
**Lines**: ~350

#### Key Functions:

1.  **`createWindow()`**
    *   Initializes the `BrowserWindow`.
    *   Sets secure preferences: `nodeIntegration: false`, `contextIsolation: true`.
    *   Hides the native title bar (`titleBarStyle: 'hidden'`) for custom CSS header.

2.  **`downloadYtDlp()`**
    *   **Purpose**: Ensures the downloader binary exists and is executable.
    *   **Logic**:
        *   Checks if file exists at `app.getPath('userData')/yt-dlp`.
        *   **CRITICAL**: Checks file size. If `< 30MB`, it assumes corruption and deletes it.
        *   Downloads from `github.com/yt-dlp/yt-dlp/releases/latest`.
        *   Runs `chmod 755` (Unix permission for Read+Execute).
        *   Runs `xattr -d com.apple.quarantine` (macOS Gatekeeper bypass).

3.  **`ipcMain.handle('search-youtube')`**
    *   **Input**: `{ artist: string, title: string }`
    *   **Process**:
        *   Constructs query: `"{Artist} - {Title}"`.
        *   Spawns `yt-dlp` in search mode (`ytsearch5:`).
        *   **Tier 1 Match**: Checks for " - Topic" channel match.
        *   **Tier 2 Match**: Checks for Official Channel match.
    *   **Output**: A valid YouTube URL.

4.  **`ipcMain.handle('download-song')`**
    *   **Input**: `{ url, folder, artist, title }`.
    *   **Process**:
        *   Spawns `yt-dlp` in download mode.
        *   Arguments:
            *   `-x`: Extract Audio.
            *   `--audio-format m4a`: Best quality/compatibility ratio.
            *   `--postprocessor-args`: Injects Spotify Metadata into FFmpeg.

### File: `electron/preload.ts`
**Role**: The Diplomat.
**Lines**: ~20

#### Responsibilities:
*   Imports `ipcRenderer` (which is dangerous).
*   Exposes a tailored API `electronAPI` via `contextBridge.exposeInMainWorld`.
*   **Why?**: This prevents the Frontend from doing random things like `require('fs').delete('/')`. It can *only* call the specific functions we exposed.

## 3.3 React Frontend (`src/`)

### File: `src/App.tsx`
**Role**: The Router.
**Lines**: ~50
*   Manages the state `activeView`: `'SPLIT' | 'SPOTIFY' | 'SOUNDCLOUD' | 'YOUTUBE'`.
*   Conditionally renders the appropriate component based on state.
*   Passed `onBack` handlers to child components to return to the `SplitScreen`.

### File: `src/components/SpotifyView.tsx`
**Role**: Spotify Downloader UI.
**Lines**: ~400
*   **State**: `playlistUrl`, `songs[]`, `statusMsg`.
*   **API Usage**: Calls Spotify Web API to get metadata.
*   **Selection Logic**:
    *   `selectAll()`: Sets `isSelected = true` for all.
    *   `selectNew()`: Uses `HistoryManager` to filter out existing IDs.

### File: `src/components/SoundCloudView.tsx`
**Role**: SoundCloud Downloader UI.
**Lines**: ~250
*   **Theme**: Hardcoded Orange/Black (`#ff5500`).
*   **Difference**: Does not perform a "Search". It treats the input URL as the Direct Download source.
*   **Parsing**: Includes fallback logic to parse Song Title from the URL slug if JSON fails.

### File: `src/components/YoutubeView.tsx`
**Role**: YouTube Downloader UI.
**Lines**: ~250
*   **Theme**: Hardcoded Red/White (`#ff0000`).
*   **Features**: Supports Playlist URLs and Single Video URLs.

### File: `src/utils/historyManager.ts`
**Role**: Deduplication Logic.
**Lines**: ~30
*   Wraps `localStorage`.
*   Uses a `Set<string>` for O(1) complexity lookups.
*   Key: `global_download_history`.

---

# Part 4: The Engineering Course

Welcome to the **Masterclass**. Here we explain the "Why" behind the "What".

## 4.1 Module 1: The Stack
*Why did we choose Electron + React + Vite?*

### The Problem
We need to run a Python script (`yt-dlp`) and FFmpeg. Browsers cannot do this. We need an OS-level runtime.

### The Candidates
1.  **Python (Tkinter/PyQt)**: Good backend, ugly UI. Hard to distribute to non-coders.
2.  **Native (Swift/C#)**: Platform lock-in. We want Windows & Mac support.
3.  **Electron**: The Holy Grail. Web UI (Beautiful) + Node Backend (Powerful) + Cross Platform.

### Why Vite?
Create-React-App is dead. Webpack is slow. Vite uses **Native ES Modules** in the browser during development. This means the server starts in 200ms, not 20s.

## 4.2 Module 2: IPC Bridges
*How to talk through walls.*

The Main Process and Renderer Process are in separate memory spaces. They cannot share variables. They must send **Messages**.

**The Pattern**: `Invoke` and `Handle`.
1.  **Renderer**: "I invoke 'download-song' with data X."
    ```js
    ipcRenderer.invoke('download-song', data)
    ```
2.  **Main**: "I handle 'download-song'. I will process data X and return Y."
    ```js
    ipcMain.handle('download-song', (e, data) => { return result; })
    ```

**Security Warning**: Never use `ipcRenderer.sendSync`. It freezes the UI until the backend replies. Always use `invoke` (Async/Promise).

## 4.3 Module 3: Child Processes
*Taking control of the Operating System.*

Node.js is single-threaded. If we ran the download in the main thread, the entire app would freeze.
Instead, we **Spawn** a child process.

```javascript
const { spawn } = require('child_process');
const child = spawn('yt-dlp', ['url']);
```

This acts like opening a separate Terminal window that runs in the background. Node then connects a pipe to that terminal's `stdout` (Output) and `stderr` (Error) streams.

**Real-Time Data**:
We listen to the data events:
```javascript
child.stdout.on('data', (chunk) => {
    console.log("Progress:", chunk.toString());
});
```
This is how we get the percentage bars in the UI.

## 4.4 Module 4: Search Algorithms
*The "Hotel California" Problem.*

Searching YouTube is fuzzy. We need exactness.

### The Algorithm Deconstructed
We use a **Waterfall Heuristic**.

**Level 1: The "Topic" Channel**
YouTube auto-generates "Topic" channels for music distribution.
*   Pattern: `Artist Name - Topic`
*   Confidence: 100%
*   We use Regex to normalize: `uploader.replace(' - Topic', '') === artist`.

**Level 2: The Official Channel**
*   Pattern: `ArtistNameVEVO` or `OfficialArtistName`.
*   Confidence: 80%
*   We use fuzzy inclusion: `uploader.includes(artist)`.

**Level 3: Popularity**
*   If we scan 5 results and none match the artist name, we assume the top result is the correct one (e.g., a viral hit or only version available).

## 4.5 Module 5: Self-Healing Binary
*Software Rots. We fight back.*

Binaries like `yt-dlp` update weekly. If our app ships with version 1.0, it will break in a month when YouTube changes their API.

### The Auto-Updater Logic
1.  **On Launch**: We check the file modification date or size.
2.  **Corruption**: We found that users often had 0-byte files due to interrupted downloads. We added a check: `if (size < 30MB) delete()`.
3.  **Fetch**: We pull directly from GitHub Releases. This ensures the app acts like a "Browser" for the latest binary, rather than a static package.

---

# Part 5: Troubleshooting & FAQ

## 5.1 Common Errors

### Error: `spawn Unknown system error -8`
*   **Cause**: The binary format is wrong for the CPU (e.g., running Intel binary on M1 Mac) OR the binary is corrupt (0 bytes).
*   **Fix**: Delete the `yt-dlp` file in `~/Library/Application Support/SpotifyDownloader`. Restart app.

### Error: `EACCES` or `Permission Denied`
*   **Cause**: The OS blocked the execution.
*   **Fix**: The app tries to fix this with `chmod 755`. If that fails, run `chmod +x path/to/binary` manually in terminal.

### Error: "App is damaged and can't be opened"
*   **Cause**: macOS Gatekeeper.
*   **Fix**: Run `xattr -cr /Applications/SpotifyDownloader.app`.

## 5.2 Debugging Tips
1.  **Open DevTools**: Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows) in the app window.
    *   Look at the **Console** tab for frontend errors.
2.  **Check Terminal Output**: When running `npm run dev`, the Main process logs print to your VS Code terminal, NOT the browser console. Look there for backend errors.

---

# Part 6: API Reference

## 6.1 IPC Channels

### `fetch-metadata`
*   **Direction**: Renderer -> Main
*   **Payload**: `url: string`
*   **Returns**: `Promise<{ success: boolean, tracks: Track[] }>`
*   **Description**: Scans a generic URL (SC/YT) and returns flat metadata.

### `search-youtube`
*   **Direction**: Renderer -> Main
*   **Payload**: `{ artist: string, title: string }`
*   **Returns**: `Promise<string>` (The YouTube URL)
*   **Description**: Performs the Tiered Heuristic search.

### `download-song`
*   **Direction**: Renderer -> Main
*   **Payload**: `{ url, folder, artist, title }`
*   **Returns**: `Promise<{ success: boolean }>`
*   **Description**: Triggers the `yt-dlp` download with metadata injection.

### `select-folder`
*   **Direction**: Renderer -> Main
*   **Payload**: None
*   **Returns**: `Promise<string | null>`
*   **Description**: Opens the native OS "Select Directory" dialog.

### `init-dependencies`
*   **Direction**: Renderer -> Main
*   **Payload**: None
*   **Returns**: `Promise<{ success: true }>`
*   **Description**: Triggers the binary check/download sequence found in `main.ts`.

---

**End of Documentation**
*Generated by Antigravity*
