import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();

const runTest = async (query) => {
    console.log(`\nTesting: "${query}"`);
    try {
        const results = await ytmusic.search(query);
        const songs = results.filter(r => r.type === 'SONG' || r.type === 'song');
        if (songs.length > 0) {
            console.log(`  ✅ Found ${songs.length} songs.`);
            console.log(JSON.stringify(songs[0], null, 2));
            console.log(`  Top Result: "${songs[0].name}" by "${songs[0].artist?.name}" (ID: ${songs[0].videoId})`);
        } else {
            console.log('  ❌ No songs found.');
            const videos = results.filter(r => r.type === 'VIDEO' || r.type === 'video');
            if (videos.length > 0) {
                console.log(`  ⚠️ Fallback to Video: "${videos[0].name}" (ID: ${videos[0].videoId})`);
            } else {
                console.log('  ❌ No results at all.');
            }
        }
    } catch (e) {
        console.error('  🔥 Error:', e.message);
    }
};

(async () => {
    console.log('Initializing YTMusic...');
    await ytmusic.initialize();

    await runTest("The Deyna Family - Monkey Business");
    await runTest("Eminem - Without Me");
    await runTest("WATTO - Latin Tool");
    await runTest("Rihanna - We Found Love");
})();
