import { Innertube, UniversalCache } from 'youtubei.js';

(async () => {
    try {
        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });

        const query = "Eminem - Without Me";
        console.log(`Searching for: "${query}" with type: 'song'`);

        const result = await yt.music.search(query, { type: 'song' });

        console.log('--- RAW DUMP ---');
        if (result.contents) {
            console.log('Contents is Array?', Array.isArray(result.contents));
            // Just dump the first item FULLY so we know what we are dealing with
            if (Array.isArray(result.contents) && result.contents.length > 0) {
                const firstThing = result.contents[0];
                console.log('First Thing Type:', firstThing.type || firstThing.constructor.name);

                // If it's a Shelf, look inside
                // @ts-ignore
                if (firstThing.contents) {
                    console.log('First Thing has contents (It is a Shelf)');
                    console.log(JSON.stringify(firstThing.contents[0], null, 2));
                } else {
                    // Maybe it's a direct item?
                    console.log('First Thing seems to be an Item directly?');
                    console.log(JSON.stringify(firstThing, null, 2));
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
})();
