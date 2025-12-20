import { Innertube, UniversalCache } from 'youtubei.js';

(async () => {
    try {
        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });

        const query = "Eminem - Without Me";
        console.log(`Searching for: "${query}"`);
        const result = await yt.music.search(query);

        // We know from Step 497 that Index 2 is the MusicShelf
        const shelves = result.contents;
        if (shelves && shelves.length > 2) {
            const shelf = shelves[2];
            console.log(`Targeting Shelf [2]: ${shelf.type}`);

            if (shelf.contents && shelf.contents.length > 0) {
                const item = shelf.contents[0];
                console.log('--- TARGET ITEM JSON ---');
                console.log(JSON.stringify(item, null, 2));
            } else {
                console.log('Shelf [2] is empty.');
            }
        } else {
            console.log('Shelf [2] does not exist. Shelves count:', shelves ? shelves.length : 0);
        }

    } catch (error) {
        console.error('Error:', error);
    }
})();
