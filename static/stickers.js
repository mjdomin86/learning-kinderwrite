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
    { id: 'dog', emoji: '🐶', es: 'Perro', de: 'Hund' },
    { id: 'cat', emoji: '🐱', es: 'Gato', de: 'Katze' },
    { id: 'mouse', emoji: '🐭', es: 'Ratón', de: 'Maus' },
    { id: 'hamster', emoji: '🐹', es: 'Hámster', de: 'Hamster' },
    { id: 'bear', emoji: '🐻', es: 'Oso', de: 'Bär' },
    { id: 'koala', emoji: '🐨', es: 'Koala', de: 'Koala' },
    { id: 'tiger', emoji: '🐯', es: 'Tigre', de: 'Tiger' },
    { id: 'cow', emoji: '🐮', es: 'Vaca', de: 'Kuh' },
    { id: 'pig', emoji: '🐷', es: 'Cerdo', de: 'Schwein' },
    { id: 'frog', emoji: '🐸', es: 'Rana', de: 'Frosch' },
    { id: 'monkey', emoji: '🐵', es: 'Mono', de: 'Affe' },
    { id: 'chicken', emoji: '🐔', es: 'Gallina', de: 'Huhn' },
    { id: 'penguin', emoji: '🐧', es: 'Pingüino', de: 'Pinguin' },
    { id: 'duck', emoji: '🦆', es: 'Pato', de: 'Ente' },
    { id: 'eagle', emoji: '🦅', es: 'Águila', de: 'Adler' },
    { id: 'parrot', emoji: '🦜', es: 'Loro', de: 'Papagei' },
    { id: 'flamingo', emoji: '🦩', es: 'Flamenco', de: 'Flamingo' },
    { id: 'peacock', emoji: '🦚', es: 'Pavo real', de: 'Pfau' },
    { id: 'swan', emoji: '🦢', es: 'Cisne', de: 'Schwan' },
    { id: 'bat', emoji: '🦇', es: 'Murciélago', de: 'Fledermaus' },
    { id: 'wolf', emoji: '🐺', es: 'Lobo', de: 'Wolf' },
    { id: 'horse', emoji: '🐴', es: 'Caballo', de: 'Pferd' },
    { id: 'zebra', emoji: '🦓', es: 'Cebra', de: 'Zebra' },
    { id: 'giraffe', emoji: '🦒', es: 'Jirafa', de: 'Giraffe' },
    { id: 'elephant', emoji: '🐘', es: 'Elefante', de: 'Elefant' },
    { id: 'rhino', emoji: '🦏', es: 'Rinoceronte', de: 'Nashorn' },
    { id: 'hippo', emoji: '🦛', es: 'Hipopótamo', de: 'Nilpferd' },
    { id: 'kangaroo', emoji: '🦘', es: 'Canguro', de: 'Känguru' },
    { id: 'sloth', emoji: '🦥', es: 'Perezoso', de: 'Faultier' },
    { id: 'otter', emoji: '🦦', es: 'Nutria', de: 'Otter' },
    { id: 'hedgehog', emoji: '🦔', es: 'Erizo', de: 'Igel' },
    { id: 'squirrel', emoji: '🐿️', es: 'Ardilla', de: 'Eichhörnchen' },
    { id: 'snail', emoji: '🐌', es: 'Caracol', de: 'Schnecke' },
    { id: 'ladybug', emoji: '🐞', es: 'Mariquita', de: 'Marienkäfer' },
    { id: 'dolphin', emoji: '🐬', es: 'Delfín', de: 'Delfin' },
    { id: 'shark', emoji: '🦈', es: 'Tiburón', de: 'Hai' },
    { id: 'crab', emoji: '🦀', es: 'Cangrejo', de: 'Krabbe' },
    { id: 'tropical-fish', emoji: '🐠', es: 'Pez tropical', de: 'Tropenfisch' },
];
export const collectionKey = 'kidwrite-stickers-v1';

export function sanitizeStickerCounts(raw) {
    const valid = {};
    if (!raw || typeof raw !== 'object') return valid;
    for (const sticker of stickers) {
        const count = raw[sticker.id];
        if (Number.isSafeInteger(count) && count > 0) valid[sticker.id] = count;
    }
    return valid;
}

export function pickNextSticker(counts, random = Math.random) {
    const missing = stickers.filter(sticker => !counts[sticker.id]);
    const pool = missing.length ? missing : stickers;
    return pool[Math.floor(random() * pool.length)];
}

export function createStickerCollection(getStorage) {
    let counts = {};
    let persistent = true;
    function read() {
        if (!persistent) return { counts: { ...counts }, persistent, profileName: '' };
        try {
            const stored = JSON.parse(getStorage().getItem(collectionKey) || '{}');
            counts = sanitizeStickerCounts(stored);
        } catch {
            persistent = false;
        }
        return { counts: { ...counts }, persistent, profileName: '' };
    }
    return {
        read,
        earn() {
            read();
            const sticker = pickNextSticker(counts);
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

export function createRemoteStickerCollection({ initialCounts = {}, profileName = '', fetchImpl = fetch } = {}) {
    let counts = sanitizeStickerCounts(initialCounts);
    let persistent = true;
    let name = profileName;
    return {
        read() {
            return { counts: { ...counts }, persistent, profileName: name };
        },
        setState({ counts: nextCounts, profileName: nextName, persistent: nextPersistent } = {}) {
            if (nextCounts !== undefined) counts = sanitizeStickerCounts(nextCounts);
            if (nextName !== undefined) name = nextName;
            if (nextPersistent !== undefined) persistent = nextPersistent;
        },
        async sync() {
            try {
                const response = await fetchImpl('/api/kid/stickers');
                if (!response.ok) return false;
                const data = await response.json();
                if (!data?.active) return false;
                counts = sanitizeStickerCounts(data.counts);
                name = data.profile?.name || name;
                persistent = true;
                return true;
            } catch {
                return false;
            }
        },
        async earn() {
            try {
                const response = await fetchImpl('/api/kid/stickers/earn', { method: 'POST' });
                if (!response.ok) throw new Error('Could not save sticker');
                const data = await response.json();
                counts = sanitizeStickerCounts(data.counts);
                persistent = true;
                const sticker = stickers.find(item => item.id === data.sticker?.id) || data.sticker;
                return { sticker, persistent: true };
            } catch {
                const sticker = pickNextSticker(counts);
                counts[sticker.id] = Math.min((counts[sticker.id] || 0) + 1, Number.MAX_SAFE_INTEGER);
                persistent = false;
                return { sticker, persistent: false };
            }
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
    const header = document.createElement('div');
    header.className = 'album-header';
    header.append(heading, close);
    dialog.append(header, summary, grid, note);
    document.body.append(dialog);

    const detail = document.createElement('dialog');
    detail.className = 'sticker-detail';
    detail.setAttribute('aria-labelledby', 'sticker-detail-title');
    const detailTitle = document.createElement('h2');
    detailTitle.id = 'sticker-detail-title';
    const largePicture = document.createElement('span');
    largePicture.className = 'sticker-large';
    largePicture.setAttribute('aria-hidden', 'true');
    const printButton = document.createElement('button');
    printButton.className = 'primary-button';
    printButton.textContent = t.printSticker;
    const backButton = document.createElement('button');
    backButton.className = 'text-button';
    backButton.textContent = t.backToAlbum;
    backButton.addEventListener('click', () => detail.close());
    detail.append(detailTitle, largePicture, printButton, backButton);
    document.body.append(detail);

    const printSheet = document.createElement('div');
    printSheet.id = 'sticker-print-sheet';
    printSheet.setAttribute('aria-hidden', 'true');
    const printArtwork = document.createElement('canvas');
    printArtwork.width = printArtwork.height = 1200;
    printSheet.append(printArtwork);
    document.body.append(printSheet);
    let selectedSticker = null;

    function prepareStickerPrint() {
        if (!detail.open || !selectedSticker) return;
        const context = printArtwork.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 1200, 1200);
        context.font = '900px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#000';
        context.fillText(selectedSticker.emoji, 600, 600);
        document.body.classList.remove('printing-drawing');
        document.body.classList.add('printing-sticker');
    }
    printButton.addEventListener('click', () => {
        prepareStickerPrint();
        window.print();
    });
    window.addEventListener('beforeprint', prepareStickerPrint);
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-sticker'));

    function render() {
        const { counts, persistent, profileName } = collection.read();
        heading.textContent = profileName ? t.albumTitleFor(profileName) : t.album;
        summary.textContent = t.albumProgress(Object.keys(counts).length, stickers.length);
        if (!persistent) note.textContent = t.albumTemporary;
        else note.textContent = profileName ? t.albumProfile(profileName) : t.albumDevice;
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
            if (count) {
                const button = document.createElement('button');
                button.className = 'sticker-open';
                button.setAttribute('aria-label', t.viewSticker(sticker[language], count));
                button.setAttribute('aria-haspopup', 'dialog');
                button.append(picture, label);
                button.addEventListener('click', () => {
                    selectedSticker = sticker;
                    detailTitle.textContent = sticker[language];
                    largePicture.textContent = sticker.emoji;
                    detail.showModal();
                });
                item.append(button);
            } else {
                item.append(picture, label);
            }
            grid.append(item);
        }
    }
    document.querySelectorAll('[data-open-album]').forEach(button => {
        button.addEventListener('click', async () => {
            render();
            dialog.showModal();
            if (typeof collection.sync === 'function' && await collection.sync() && dialog.open) render();
        });
    });
    window.addEventListener('storage', event => {
        if (dialog.open && (event.key === collectionKey || event.key === null)) render();
    });
}
