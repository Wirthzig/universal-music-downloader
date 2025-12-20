const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const YT_DLP_PATH = path.join(os.homedir(), 'Library/Application Support/spotify-youtube-downloader/yt-dlp');

const URLS = {
    // Playlist
    soundcloud_playlist: 'https://soundcloud.com/charts/top',
    youtube_playlist: 'https://www.youtube.com/watch?v=MZSCXE4CpCA&list=PLUlXxfdO7MgqkpAlgD2GjJMeScJi6NYhg&index=1'
};

function scan(url, label) {
    return new Promise(resolve => {
        console.log(`\n--- Testing ${label} ---`);
        console.log(`URL: ${url}`);

        const args = ['--dump-single-json', '--flat-playlist', '--no-warnings', url];
        console.log(`Command: ${YT_DLP_PATH} ${args.join(' ')}`);

        const child = spawn(YT_DLP_PATH, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`FAILED: ${stderr}`);
                resolve(false);
                return;
            }

            try {
                const data = JSON.parse(stdout);
                console.log('SUCCESS: JSON parsed.');

                if (data.entries) {
                    console.log(`Entries found: ${data.entries.length}`);
                    const first = data.entries[0];
                    console.log('First Entry Keys:', Object.keys(first));
                    console.log('First Entry:', JSON.stringify(first, null, 2));
                } else {
                    console.log('No entries (Single item?)');
                    console.log(`Title: ${data.title}`);
                }

                resolve(true);
            } catch (e) {
                console.error('FAILED: Invalid JSON');
                resolve(false);
            }
        });
    });
}

async function run() {
    await scan(URLS.youtube_playlist, 'YouTube Playlist');
}

run();
