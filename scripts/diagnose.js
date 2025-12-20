import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';

const APP_SUPPORT = path.join(os.homedir(), 'Library/Application Support/spotify-youtube-downloader');
const YT_DLP_PATH = path.join(APP_SUPPORT, 'yt-dlp');
const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';

console.log('--- Diagnosis Tool ---');
console.log(`Checking: ${YT_DLP_PATH}`);

async function checkLocal() {
    if (!fs.existsSync(YT_DLP_PATH)) {
        console.log('Local file: NOT FOUND');
        return 0;
    }
    const stats = fs.statSync(YT_DLP_PATH);
    console.log(`Local file size: ${stats.size} bytes`);
    console.log(`Local file mode: ${stats.mode.toString(8)}`);

    // Read first few bytes (Magic Number)
    try {
        const fd = fs.openSync(YT_DLP_PATH, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        console.log(`Magic Bytes: 0x${buffer.toString('hex')}`);
    } catch (e) {
        console.log('Error reading magic bytes:', e.message);
    }
    return stats.size;
}

async function getUpstreamSize() {
    console.log('Checking upstream content-length...');
    return new Promise((resolve, reject) => {
        const check = (url) => {
            const req = https.request(url, { method: 'HEAD' }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    console.log(`Redirecting to: ${res.headers.location}`);
                    check(res.headers.location);
                    return;
                }
                if (res.statusCode === 200) {
                    if (res.headers['content-length']) {
                        resolve(parseInt(res.headers['content-length'], 10));
                    } else {
                        console.log('No content-length header provided by server.');
                        resolve(null);
                    }
                } else {
                    reject(`Status ${res.statusCode}`);
                }
            });
            req.on('error', reject);
            req.end();
        };
        check(YT_DLP_URL);
    });
}

(async () => {
    try {
        const localSize = await checkLocal();
        const remoteSize = await getUpstreamSize();

        console.log(`\nComparison:`);
        console.log(`Local:  ${localSize}`);
        console.log(`Remote: ${remoteSize}`);

        if (remoteSize && localSize !== remoteSize) {
            console.error('MISMATCH! The local file is likely truncated.');
        } else if (remoteSize && localSize === remoteSize) {
            console.log('Size verification PASSED.');
        }

    } catch (e) {
        console.error('Diagnosis failed:', e);
    }
})();
