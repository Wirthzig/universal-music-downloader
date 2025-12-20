import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const APP_SUPPORT = path.join(os.homedir(), 'Library/Application Support/SpotifyDownloader');
const YT_DLP_PATH = path.join(APP_SUPPORT, 'yt-dlp');

console.log('--- Debug Info ---');
console.log(`Node Version: ${process.version}`);
console.log(`Arch: ${process.arch}`);
console.log(`Platform: ${process.platform}`);
console.log(`YT_DLP_PATH: ${YT_DLP_PATH}`);

import https from 'https';

if (!fs.existsSync(YT_DLP_PATH)) {
    console.log('Binary not found. Downloading...');
    const file = fs.createWriteStream(YT_DLP_PATH);
    const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';

    await new Promise((resolve, reject) => {
        const download = (url) => {
            https.get(url, res => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    download(res.headers.location);
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    fs.chmodSync(YT_DLP_PATH, '755');
                    resolve();
                });
            }).on('error', reject);
        };
        download(YT_DLP_URL);
    });
    console.log('Download complete.');
}

const stats = fs.statSync(YT_DLP_PATH);
console.log(`Binary Size: ${stats.size} bytes`);
console.log(`Permissions: ${stats.mode.toString(8)}`);

// Check file type
const fileChild = spawn('file', [YT_DLP_PATH]);
fileChild.stdout.on('data', d => console.log(`file command output: ${d}`));

console.log('\n--- Test 1: Version Check ---');
const versionChild = spawn(YT_DLP_PATH, ['--version']);

versionChild.stdout.on('data', (data) => {
    console.log(`[STDOUT] ${data}`);
});
versionChild.stderr.on('data', (data) => {
    console.error(`[STDERR] ${data}`);
});
versionChild.on('close', (code) => {
    console.log(`Version check exited with code ${code}`);
    runSearchTest();
});
versionChild.on('error', (err) => {
    console.error('Version check FAILED to spawn:', err);
});

function runSearchTest() {
    console.log('\n--- Test 2: Search Query ---');
    const query = 'Rick Astley - Never Gonna Give You Up';
    const args = ['--print-json', '--flat-playlist', '--default-search', 'ytsearch1', query];

    console.log(`Executing: ${YT_DLP_PATH} ${args.join(' ')}`);

    const child = spawn(YT_DLP_PATH, args);

    child.stdout.on('data', d => console.log(`[Search STDOUT] ${d.toString().substring(0, 100)}...`));
    child.stderr.on('data', d => console.error(`[Search STDERR] ${d}`));

    child.on('close', code => {
        console.log(`Search exited with code ${code}`);
    });

    child.on('error', err => {
        console.error('Search FAILED to spawn:', err);
    });
}
