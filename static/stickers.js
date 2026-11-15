export const stickers = [
    { id: 'fox', emoji: '🦊', es: 'Zorro', de: 'Fuchs' },
    { id: 'lion', emoji: '🦁', es: 'León', de: 'Löwe' },
    { id: 'butterfly', emoji: '🦋', es: 'Mariposa', de: 'Schmetterling' },
    { id: 'panda', emoji: '🐼', es: 'Panda', de: 'Panda' },
    { id: 'dinosaur', emoji: '🦖', es: 'Dinosaurio', de: 'Dinosaurier' },
    { id: 'whale', emoji: '🐳', es: 'Ballena', de: 'Wal' },
    { id: 'owl', emoji: '🦉', es: 'Búho', de: 'Eule' },
    { id: 'bee', emoji: '🐝', es: 'Abeja', de: 'Biene' },
    { id: 'turtle', emoji: '🐢', es: 'Tortuga', de: 'Schildkröte' },
    { id: 'octopus', emoji: '🐙', es: 'Pulpo', de: 'Oktopus' },
    { id: 'rabbit', emoji: '🐰', es: 'Conejo', de: 'Kaninchen' },
    { id: 'unicorn', emoji: '🦄', es: 'Unicornio', de: 'Einhorn' },
];
export const collectionKey = 'kidwrite-stickers-v1';

export function createStickerCollection(getStorage) {
    let counts = {};
    let persistent = true;
    function read() {
        if (!persistent) return { counts: { ...counts }, persistent };
        try {
            const stored = JSON.parse(getStorage().getItem(collectionKey) || '{}');
            const valid = {};
            for (const sticker of stickers) {
                const count = stored?.[sticker.id];
                if (Number.isSafeInteger(count) && count > 0) valid[sticker.id] = count;
            }
            counts = valid;
        } catch {
            persistent = false;
        }
        return { counts: { ...counts }, persistent };
    }
    return {
        read,
        earn() {
            read();
            const missing = stickers.filter(sticker => !counts[sticker.id]);
            const pool = missing.length ? missing : stickers;
            const sticker = pool[Math.floor(Math.random() * pool.length)];
            counts[sticker.id] = Math.min((counts[sticker.id] || 0) + 1, Number.MAX_SAFE_INTEGER);
            try {
                getStorage().setItem(collectionKey, JSON.stringify(counts));
                persistent = true;
            } catch {
                persistent = false;
            }
            return { sticker, persistent };
        },
    };
}

export function initStickerAlbum(collection, language, t) {
    const dialog = document.createElement('dialog');
    dialog.className = 'sticker-album';
    dialog.setAttribute('aria-labelledby', 'album-title');
    const heading = document.createElement('h2');
    heading.id = 'album-title';
    heading.textContent = t.album;
    const summary = document.createElement('p');
    summary.className = 'album-summary';
    const grid = document.createElement('ul');
    grid.className = 'sticker-grid';
    const note = document.createElement('p');
    note.className = 'field-hint';
    const close = document.createElement('button');
    close.className = 'primary-button';
    close.textContent = t.closeAlbum;
    close.autofocus = true;
    close.addEventListener('click', () => dialog.close());
    dialog.append(heading, summary, grid, note, close);
    document.body.append(dialog);

    function render() {
        const { counts, persistent } = collection.read();
        summary.textContent = t.albumProgress(Object.keys(counts).length, stickers.length);
        note.textContent = persistent ? t.albumDevice : t.albumTemporary;
        grid.replaceChildren();
        for (const sticker of stickers) {
            const item = document.createElement('li');
            const count = counts[sticker.id] || 0;
            item.className = count ? 'album-sticker earned' : 'album-sticker';
            const picture = document.createElement('span');
            picture.className = 'album-emoji';
            picture.setAttribute('aria-hidden', 'true');
            picture.textContent = count ? sticker.emoji : '?';
            const label = document.createElement('span');
            label.textContent = count ? `${sticker[language]} · ${count}` : t.albumLocked;
            item.append(picture, label);
            grid.append(item);
        }
    }
    document.querySelectorAll('[data-open-album]').forEach(button => {
        button.addEventListener('click', () => {
            render();
            dialog.showModal();
        });
    });
    window.addEventListener('storage', event => {
        if (dialog.open && (event.key === collectionKey || event.key === null)) render();
    });
}
