import { spawn, execFile } from "child_process";
import { app, ipcMain, dialog, BrowserWindow } from "electron";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const APP_SUPPORT = app.getPath("userData");
const YT_DLP_PATH = path.join(APP_SUPPORT, "yt-dlp");
const YT_DLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
const downloadYtDlp = () => {
  return new Promise((resolve, reject) => {
    console.log(`[Main] Checking yt-dlp at: ${YT_DLP_PATH}`);
    if (fs.existsSync(YT_DLP_PATH)) {
      try {
        const stats = fs.statSync(YT_DLP_PATH);
        console.log(`[Main] Binary exists. Size: ${stats.size}, Mode: ${stats.mode.toString(8)}`);
        const MIN_SIZE = 30 * 1024 * 1024;
        if (stats.size > MIN_SIZE) {
          fs.chmodSync(YT_DLP_PATH, "755");
          execFile("xattr", ["-d", "com.apple.quarantine", YT_DLP_PATH], (err) => {
            resolve();
          });
          return;
        } else {
          console.log("[Main] Binary is too small (possible corruption). Deleting...");
          fs.unlinkSync(YT_DLP_PATH);
        }
      } catch (e) {
        console.error("[Main] Error checking binary:", e);
      }
    }
    console.log("[Main] Downloading yt-dlp...");
    const downloadFile = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            downloadFile(response.headers.location);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(YT_DLP_PATH);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          fs.chmodSync(YT_DLP_PATH, "755");
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(YT_DLP_PATH, () => {
        });
        reject(err);
      });
    };
    downloadFile(YT_DLP_URL);
  });
};
let initPromise = null;
function createWindow() {
  console.log("[Main] Creating Window...");
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hidden",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
app.whenReady().then(async () => {
  console.log(`[Main] App Ready. Node: ${process.version}, Arch: ${process.arch}, Platform: ${process.platform}`);
  createWindow();
  initPromise = downloadYtDlp().catch((err) => console.error("[Main] Dep Failure:", err));
  ipcMain.handle("init-dependencies", async () => {
    if (initPromise) await initPromise;
    return { success: true };
  });
  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("fetch-metadata", async (_, url) => {
    if (initPromise) await initPromise;
    console.log(`[Main] Fetching metadata for: ${url}`);
    return new Promise((resolve) => {
      const args = ["--dump-single-json", "--no-warnings"];
      if (!url.includes("soundcloud.com")) {
        args.push("--flat-playlist");
      }
      args.push(url);
      const child = spawn(YT_DLP_PATH, args);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => stdout += d.toString());
      child.stderr.on("data", (d) => stderr += d.toString());
      child.on("close", (code) => {
        if (code !== 0) {
          console.error(`[Main] Metadata fetch failed: ${stderr}`);
          resolve({ success: false, error: "Failed to fetch metadata" });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          let entries = [];
          if (data.entries) {
            entries = data.entries;
          } else if (data._type === "playlist") {
            entries = [];
          } else {
            entries = [data];
          }
          if (entries.length > 0) {
            console.log("[Main] Sample Entry:", JSON.stringify(entries[0], null, 2));
          }
          const tracks = entries.map((entry) => {
            if (!entry) return null;
            let title = entry.title || entry.fulltitle || entry.track || entry.alt_title;
            let artist = entry.uploader || entry.artist || entry.creator || entry.channel || entry.uploader_id;
            const url2 = entry.url || entry.webpage_url || entry.original_url || url2;
            if ((!title || !artist) && url2.includes("soundcloud.com")) {
              try {
                const parts = url2.split("/").filter((p) => p.length > 0);
                if (parts.length >= 2) {
                  const slugTitle = parts[parts.length - 1];
                  const slugArtist = parts[parts.length - 2];
                  const clean = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                  if (!title) title = clean(slugTitle);
                  if (!artist) artist = clean(slugArtist);
                }
              } catch (e) {
                console.error("[Main] Failed to parse SC URL:", e);
              }
            }
            return {
              id: entry.id || "no-id",
              title: title || "Unknown Title",
              artist: artist || "Unknown Artist",
              url: url2,
              duration: entry.duration || 0
            };
          }).filter((t) => t !== null);
          console.log(`[Main] Found ${tracks.length} items.`);
          resolve({ success: true, tracks });
        } catch (e) {
          console.error("[Main] JSON Parse error during metadata fetch", e);
          resolve({ success: false, error: "Invalid response from downloader" });
        }
      });
    });
  });
  ipcMain.handle("search-youtube", async (_, payload) => {
    if (initPromise) await initPromise;
    let queryStr = "";
    let targetArtist = "";
    let targetTitle = "";
    if (typeof payload === "string") {
      queryStr = payload;
    } else {
      targetArtist = payload.artist || "";
      targetTitle = payload.title || "";
      queryStr = `${targetArtist} - ${targetTitle}`;
    }
    console.log(`[Main] Searching for: "${queryStr}" (Artist: ${targetArtist})`);
    return new Promise((resolve) => {
      const args = ["--print-json", "--flat-playlist", "--no-warnings", `ytsearch5:${queryStr}`];
      const child = spawn(YT_DLP_PATH, args);
      let stdout = "";
      child.stdout.on("data", (d) => stdout += d.toString());
      child.on("close", (code) => {
        if (code !== 0) {
          console.error("yt-dlp search failed");
          resolve(null);
          return;
        }
        try {
          const results = stdout.trim().split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line));
          if (results.length === 0) {
            resolve(null);
            return;
          }
          const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const cleanArtist = clean(targetArtist);
          const topicMatch = results.find((r) => {
            const uploader = clean(r.uploader || "");
            const isTopic = (r.uploader || "").includes(" - Topic");
            return isTopic && uploader.includes(cleanArtist);
          });
          if (topicMatch) {
            console.log(`[Main] Found Official Topic: ${topicMatch.title} (${topicMatch.uploader})`);
            resolve(topicMatch.url || `https://youtube.com/watch?v=${topicMatch.id}`);
            return;
          }
          const officialMatch = results.find((r) => {
            const uploader = clean(r.uploader || "");
            return uploader.includes(cleanArtist);
          });
          if (officialMatch) {
            console.log(`[Main] Found Official Channel: ${officialMatch.title} (${officialMatch.uploader})`);
            resolve(officialMatch.url || `https://youtube.com/watch?v=${officialMatch.id}`);
            return;
          }
          console.log(`[Main] No verified match. Defaulting to: ${results[0].title}`);
          resolve(results[0].url || `https://youtube.com/watch?v=${results[0].id}`);
        } catch (e) {
          console.error("Parse Error", e);
          resolve(null);
        }
      });
    });
  });
  ipcMain.handle("download-song", async (event, { url, folder, artist, title }) => {
    return new Promise((resolve) => {
      const outputTemplate = path.join(folder, `${artist} - ${title}.%(ext)s`);
      const safeTitle = title.replace(/"/g, "");
      const safeArtist = artist.replace(/"/g, "");
      const args = [
        "-x",
        "--audio-format",
        "m4a",
        "--embed-metadata",
        "--no-warnings",
        "-o",
        outputTemplate,
        // FORCE metadata overwrite using ffmpeg arguments
        "--postprocessor-args",
        `ffmpeg:-metadata title="${safeTitle}" -metadata artist="${safeArtist}" -metadata album="${safeTitle}" -metadata album_artist="${safeArtist}"`,
        url
      ];
      const child = spawn(YT_DLP_PATH, args);
      child.stdout.on("data", (d) => process.stdout.write(d));
      child.on("close", (code) => {
        if (code === 0) resolve({ success: true });
        else resolve({ success: false, error: `Exit code ${code}` });
      });
    });
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
