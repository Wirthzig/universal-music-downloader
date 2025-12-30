import { execFile, spawn } from 'child_process';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Dependency Manager ---
const APP_SUPPORT = app.getPath('userData');
const YT_DLP_PATH = path.join(APP_SUPPORT, 'yt-dlp');
const FFMPEG_PATH = path.join(APP_SUPPORT, 'ffmpeg');

// --- YTMusic API Setup ---
let ytmusic: any = null;
let isYtMusicReady = false;
const searchCache = new Map<string, string>();
let lastSearchTime = 0;

// URLs
const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
// Static FFmpeg build for macOS (Universal or 64-bit)
const FFMPEG_URL = 'https://evermeet.cx/ffmpeg/getrelease/zip';

const downloadFile = (url: string, dest: string) => {
    return new Promise<void>((resolve, reject) => {
        const handleResponse = (response: any) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                if (response.headers.location) {
                    // Fix: Resolve relative URLs against the current URL logic
                    const nextUrl = new URL(response.headers.location, url).href;
                    console.log(`[Main] Redirecting to: ${nextUrl}`);
                    https.get(nextUrl, handleResponse).on('error', reject);
                    return;
                }
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        };
        https.get(url, handleResponse).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

const setupYtDlp = async () => {
    console.log(`[Main] Checking yt-dlp at: ${YT_DLP_PATH}`);
    if (fs.existsSync(YT_DLP_PATH)) {
        const stats = fs.statSync(YT_DLP_PATH);
        if (stats.size > 30 * 1024 * 1024) {
            fs.chmodSync(YT_DLP_PATH, '755');
            // Remove quarantine
            await new Promise<void>(res => execFile('xattr', ['-d', 'com.apple.quarantine', YT_DLP_PATH], () => res()));
            return;
        }
        fs.unlinkSync(YT_DLP_PATH);
    }

    console.log('[Main] Downloading yt-dlp...');
    await downloadFile(YT_DLP_URL, YT_DLP_PATH);
    fs.chmodSync(YT_DLP_PATH, '755');
};

const setupFFmpeg = async () => {
    console.log(`[Main] Checking ffmpeg at: ${FFMPEG_PATH}`);
    if (fs.existsSync(FFMPEG_PATH)) {
        // Simple check
        const stats = fs.statSync(FFMPEG_PATH);
        if (stats.size > 10 * 1024 * 1024) {
            fs.chmodSync(FFMPEG_PATH, '755');
            // Remove quarantine
            await new Promise<void>(res => execFile('xattr', ['-d', 'com.apple.quarantine', FFMPEG_PATH], () => res()));
            return;
        }
        fs.unlinkSync(FFMPEG_PATH);
    }

    console.log('[Main] Downloading ffmpeg...');
    const zipPath = path.join(APP_SUPPORT, 'ffmpeg.zip');
    await downloadFile(FFMPEG_URL, zipPath);

    console.log('[Main] Unzipping ffmpeg...');
    // Use system unzip
    await new Promise<void>((resolve, reject) => {
        const child = spawn('unzip', ['-o', zipPath, '-d', APP_SUPPORT]);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Unzip failed'));
        });
    });

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    fs.chmodSync(FFMPEG_PATH, '755');
};

let initPromise: Promise<void> | null = null;

function createWindow() {
    console.log('[Main] Creating Window...');
    const win = new BrowserWindow({
        width: 1500,
        height: 1000,
        titleBarStyle: 'hidden',
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // sometimes helps with local resource loading but use with caution
        },
    });

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

// --- AUTO UPDATER CONFIG ---
log.transports.file.level = 'info';
autoUpdater.logger = log;

app.whenReady().then(async () => {
    console.log(`[Main] App Ready. Node: ${process.version}, Arch: ${process.arch}, Platform: ${process.platform}`);
    createWindow();

    // Initialize YTMusic (Dynamic Import)
    try {
        const mod = await import('ytmusic-api');
        const YTMusicClass = mod.default || mod;
        ytmusic = new YTMusicClass();
        await ytmusic.initialize();
        isYtMusicReady = true;
        console.log('[Main] YTMusic API Initialized 🎵');
    } catch (e) { console.error('[Main] Failed to init YTMusic:', e); }



    // Check for updates immediately
    console.log('[Main] Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();

    // Parallel init
    initPromise = Promise.all([setupYtDlp(), setupFFmpeg()])
        .then(() => console.log('[Main] All dependencies ready.'))
        .catch(err => console.error('[Main] Dep Failure:', err));

    ipcMain.handle('init-dependencies', async () => {
        if (initPromise) await initPromise;
        return { success: true };
    });

    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    // --- GENERIC METADATA SCANNER (SC/YT) ---
    ipcMain.handle('fetch-metadata', async (_, url) => {
        if (initPromise) await initPromise;
        console.log(`[Main] Fetching metadata for: ${url}`);

        return new Promise((resolve) => {
            const args = ['--dump-single-json', '--no-warnings'];

            if (!url.includes('soundcloud.com')) {
                args.push('--flat-playlist');
            }
            args.push(url);

            const child = spawn(YT_DLP_PATH, args);

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', d => stdout += d.toString());
            child.stderr.on('data', d => stderr += d.toString());

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error(`[Main] Metadata fetch failed: ${stderr}`);
                    resolve({ success: false, error: 'Failed to fetch metadata' });
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    let entries = [];
                    if (data.entries) {
                        entries = data.entries;
                    } else if (data._type === 'playlist') {
                        entries = [];
                    } else {
                        entries = [data];
                    }

                    if (entries.length > 0) {
                        console.log('[Main] Sample Entry:', JSON.stringify(entries[0], null, 2));
                    }

                    const tracks = entries.map((entry: any) => {
                        if (!entry) return null;

                        let title = entry.title || entry.fulltitle || entry.track || entry.alt_title;
                        let artist = entry.uploader || entry.artist || entry.creator || entry.channel || entry.uploader_id;
                        const url = entry.url || entry.webpage_url || entry.original_url || url;

                        if ((!title || !artist) && url.includes('soundcloud.com')) {
                            try {
                                const parts = url.split('/').filter((p: string) => p.length > 0);
                                if (parts.length >= 2) {
                                    const slugTitle = parts[parts.length - 1];
                                    const slugArtist = parts[parts.length - 2];
                                    const clean = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                    if (!title) title = clean(slugTitle);
                                    if (!artist) artist = clean(slugArtist);
                                }
                            } catch (e) {
                                console.error('[Main] Failed to parse SC URL:', e);
                            }
                        }

                        return {
                            id: entry.id || 'no-id',
                            title: title || 'Unknown Title',
                            artist: artist || 'Unknown Artist',
                            url,
                            duration: entry.duration || 0
                        };
                    }).filter((t: any) => t !== null);

                    console.log(`[Main] Found ${tracks.length} items.`);
                    resolve({ success: true, tracks });

                } catch (e) {
                    console.error('[Main] JSON Parse error during metadata fetch', e);
                    resolve({ success: false, error: 'Invalid response from downloader' });
                }
            });
        });
    });

    // --- HELPERS ---
    const normalizeStr = (str: string): string => {
        return str
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/\s+-\s+topic/g, '') // Remove " - Topic"
            .replace(/\(official\s+video\)/g, '')
            .replace(/\(official\s+audio\)/g, '')
            .replace(/\(lyrics\)/g, '')
            .replace(/\(official\)/g, '')
            .replace(/\[.*?\]/g, '') // remove brackets generally
            .replace(/[\(\[\{\)\]\}]/g, '') // Remove the brackets chars themselves
            .replace(/\b(feat|ft|featuring)\b.*/g, '') // remove feat
            .replace(/[^a-z0-9]/g, '') // remove ALL punctuation and spaces
            .trim();
    };

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const runYtDlp = (args: string[]): Promise<any[]> => {
        return new Promise((resolve) => {
            const child = spawn(YT_DLP_PATH, args);
            let stdout = '';

            child.stdout.on('data', d => stdout += d.toString());
            child.on('close', () => {
                try {
                    const results = stdout.trim().split('\n')
                        .filter(line => line.length > 0)
                        .map(line => { try { return JSON.parse(line) } catch (e) { return null } })
                        .filter(x => x !== null);
                    resolve(results);
                } catch (e) { resolve([]); }
            });
        });
    };

    const searchYtDlp = (query: string, prefix: string = 'ytsearch5'): Promise<any[]> => {
        return new Promise((resolve) => {
            const args = [
                '--dump-single-json',
                '--flat-playlist',
                '--no-warnings',
                `${prefix}:${query}`
            ];
            const child = spawn(YT_DLP_PATH, args);
            let stdout = '';
            child.stdout.on('data', d => stdout += d.toString());
            child.on('close', () => {
                try {
                    const data = JSON.parse(stdout);
                    resolve(data.entries || []);
                } catch (e) { resolve([]); }
            });
        });
    };



    // --- YTMusic SEARCH (Exact Implementation of User Request) ---
    ipcMain.handle('search-youtube', async (_, payload) => {
        if (!isYtMusicReady || !ytmusic) {
            console.warn('[Main] YTMusic not ready, trying to init...');
            try {
                const mod = await import('ytmusic-api');
                const YTMusicClass = mod.default || mod;
                ytmusic = new YTMusicClass();
                await ytmusic.initialize();
                isYtMusicReady = true;
            }
            catch (e) { console.error('YTMusic init fail:', e); return null; }
        }

        let targetArtist = '';
        let targetTitle = '';

        if (typeof payload === 'string') {
            const parts = payload.split(' - ');
            if (parts.length > 1) {
                targetArtist = parts[0];
                targetTitle = parts.slice(1).join(' - ');
            } else {
                targetTitle = payload;
            }
        } else {
            targetArtist = payload.artist || '';
            targetTitle = payload.title || '';
        }

        const cleanArtist = normalizeStr(targetArtist);
        const cleanTitle = normalizeStr(targetTitle);
        const query = `${targetArtist} - ${targetTitle}`;
        const cacheKey = normalizeStr(query);

        if (searchCache.has(cacheKey)) {
            console.log(`[Main] Cache HIT for: "${query}"`);
            return searchCache.get(cacheKey);
        }

        console.log(`[Main] Searching YTMusic: "${query}"`);

        const now = Date.now();
        const timeSinceLast = now - lastSearchTime;
        if (timeSinceLast < 1100) {
            const wait = 1100 - timeSinceLast;
            await sleep(wait);
        }
        lastSearchTime = Date.now();

        // --- TIER 1: YouTube Music ---
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
            try {
                const results = await ytmusic.search(query);
                let bestMatch: any = null;
                let highestScore = -1;

                for (const r of results.slice(0, 5)) {
                    if (r.type !== 'SONG' && r.type !== 'song' && r.type !== 'VIDEO' && r.type !== 'video') continue;

                    const rTitle = normalizeStr(r.name || '');
                    const rArtist = normalizeStr(r.artist?.name || '');

                    console.log(`[Tier 1] Scoring: "${r.name}" by "${r.artist?.name}"`);

                    const fullTitleLower = (r.name || '').toLowerCase();
                    const targetLower = (targetTitle + ' ' + targetArtist).toLowerCase();
                    const negativeKeywords = ['cover', 'karaoke', 'instrumental', 'remix', 'live', 'concerto', 'mix'];
                    let isRejected = false;
                    let rejectionReason = '';

                    for (const kw of negativeKeywords) {
                        if (fullTitleLower.includes(kw) && !targetLower.includes(kw)) {
                            isRejected = true;
                            rejectionReason = kw;
                            break;
                        }
                    }
                    if (isRejected) {
                        console.log(`[Tier 1] -> Reject: Negative Filter ("${rejectionReason}")`);
                        continue;
                    }

                    let score = 0;
                    if (rTitle.includes(cleanTitle) || cleanTitle.includes(rTitle)) score += 3;
                    else if (rTitle.includes(cleanTitle) && rTitle.includes(cleanArtist)) score += 3;

                    if (rArtist.includes(cleanArtist) || cleanArtist.includes(rArtist)) score += 3;
                    else if (rTitle.includes(cleanArtist)) score += 2;

                    if (r.type === 'SONG' || r.type === 'song') score += 1;

                    console.log(`[Tier 1] -> Score: ${score}`);

                    if (score > highestScore && score >= 5) {
                        highestScore = score;
                        bestMatch = r;
                    }
                }

                if (bestMatch) {
                    const url = `https://music.youtube.com/watch?v=${bestMatch.videoId}`;
                    console.log(`[Tier 1] 🏆 Winner: "${bestMatch.name}" (Score: ${highestScore}) -> ${url}`);
                    searchCache.set(cacheKey, url);
                    return url;
                }

                console.log(`[Tier 1] No verified match for "${query}". Falling back...`);
                break;

            } catch (e: any) {
                console.error(`[Tier 1] Error (Attempt ${retries + 1}):`, e.message);
                if (e.message && e.message.includes('429')) {
                    const backoff = 2000 * Math.pow(2, retries);
                    await sleep(backoff);
                    retries++;
                } else {
                    break;
                }
            }
        }

        // --- TIER 2: YouTubei.js (Normal YouTube) ---
        // --- TIER 2: yt-dlp (YouTube Music Mode) ---
        console.log(`[Main] Falling back to Tier 2: yt-dlp (YouTube Music)...`);
        try {
            // 'ytmsearch' searches YouTube Music specifically
            const fallbackResults = await searchYtDlp(query, 'ytmsearch5');
            let bestFallMatch: any = null;
            let highestFallScore = -1;

            for (const r of fallbackResults) {
                const rTitle = normalizeStr(r.title || '');
                const rArtist = normalizeStr(r.uploader || '');
                console.log(`[Tier 2] Scoring: "${r.title}" by "${r.uploader}"`);

                const fullTitleLower = (r.title || '').toLowerCase();
                const targetLower = (targetTitle + ' ' + targetArtist).toLowerCase();
                const negativeKeywords = ['cover', 'karaoke', 'instrumental', 'remix', 'live', 'concerto', 'mix'];
                let isRejected = false;

                for (const kw of negativeKeywords) {
                    if (fullTitleLower.includes(kw) && !targetLower.includes(kw)) {
                        isRejected = true;
                        break;
                    }
                }
                if (isRejected) {
                    console.log(`[Tier 2] -> Reject: Negative Filter`);
                    continue;
                }

                let score = 0;
                if (rTitle.includes(cleanTitle) || cleanTitle.includes(rTitle)) score += 3;
                else if (rTitle.includes(cleanTitle) && rTitle.includes(cleanArtist)) score += 3;

                if (rArtist.includes(cleanArtist) || cleanArtist.includes(rArtist)) score += 3;
                else if (rTitle.includes(cleanArtist)) score += 2;

                console.log(`[Tier 2] -> Score: ${score}`);

                if (score > highestFallScore && score >= 5) {
                    highestFallScore = score;
                    bestFallMatch = r;
                }
            }

            if (bestFallMatch) {
                const url = `https://youtube.com/watch?v=${bestFallMatch.id}`;
                console.log(`[Tier 2] 🏆 Winner: "${bestFallMatch.title}" (Score: ${highestFallScore}) -> ${url}`);
                searchCache.set(cacheKey, url);
                return url;
            }

        } catch (e) { console.error('[Tier 2] Error:', e); }

        // --- TIER 3: yt-dlp (Normal YouTube Mode) ---
        console.log(`[Main] Falling back to Tier 3: yt-dlp (Normal YouTube)...`);
        try {
            // 'ytsearch' searches Standard YouTube
            const fallbackResults = await searchYtDlp(query, 'ytsearch5');
            let bestFallMatch: any = null;
            let highestFallScore = -1;

            for (const r of fallbackResults) {
                const rTitle = normalizeStr(r.title || '');
                const rArtist = normalizeStr(r.uploader || '');
                console.log(`[Tier 3] Scoring: "${r.title}" by "${r.uploader}"`);

                const fullTitleLower = (r.title || '').toLowerCase();
                const targetLower = (targetTitle + ' ' + targetArtist).toLowerCase();
                const negativeKeywords = ['cover', 'karaoke', 'instrumental', 'remix', 'live', 'concerto', 'mix'];
                let isRejected = false;

                for (const kw of negativeKeywords) {
                    if (fullTitleLower.includes(kw) && !targetLower.includes(kw)) {
                        isRejected = true;
                        break;
                    }
                }
                if (isRejected) {
                    console.log(`[Tier 3] -> Reject: Negative Filter`);
                    continue;
                }

                let score = 0;
                if (rTitle.includes(cleanTitle) || cleanTitle.includes(rTitle)) score += 3;
                else if (rTitle.includes(cleanTitle) && rTitle.includes(cleanArtist)) score += 3;

                if (rArtist.includes(cleanArtist) || cleanArtist.includes(rArtist)) score += 3;
                else if (rTitle.includes(cleanArtist)) score += 2;

                console.log(`[Tier 3] -> Score: ${score}`);

                if (score > highestFallScore && score >= 5) {
                    highestFallScore = score;
                    bestFallMatch = r;
                }
            }

            if (bestFallMatch) {
                const url = `https://youtube.com/watch?v=${bestFallMatch.id}`;
                console.log(`[Tier 3] 🏆 Winner: "${bestFallMatch.title}" (Score: ${highestFallScore}) -> ${url}`);
                searchCache.set(cacheKey, url);
                return url;
            }

        } catch (e) {
            console.error('[Tier 3] Error:', e);
        }

        return null; // Give up
    });

    ipcMain.handle('download-song', async (event, { url, folder, artist, title }) => {
        // Ensure dependencies are ready before starting download
        if (initPromise) await initPromise;

        return new Promise((resolve) => {
            const outputTemplate = path.join(folder, `${artist} - ${title}.%(ext)s`);
            const safeTitle = title.replace(/"/g, '');
            const safeArtist = artist.replace(/"/g, '');

            const args = [
                '--ffmpeg-location', FFMPEG_PATH, // <--- CRITICAL: Use the bundled binary
                '-x', '--audio-format', 'm4a', '--embed-metadata', '--no-warnings',
                '-o', outputTemplate,
                '--postprocessor-args', `ffmpeg:-metadata title="${safeTitle}" -metadata artist="${safeArtist}" -metadata album="${safeTitle}" -metadata album_artist="${safeArtist}"`,
                url
            ];

            const child = spawn(YT_DLP_PATH, args);
            child.stdout.on('data', (d) => process.stdout.write(d));

            child.on('close', (code) => {
                if (code === 0) resolve({ success: true });
                else resolve({ success: false, error: `Exit code ${code}` });
            });
        });
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// --- UPDATER EVENTS ---
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});
autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
});
autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
});
autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
});
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
});
autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart now to apply?',
        buttons: ['Restart', 'Later']
    }).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
