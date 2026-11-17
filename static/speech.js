// Language-specific letter names and Web Speech synthesis helper.
export const letterNames = {
    es: {
        a: 'a',
        b: 'be',
        c: 'ce',
        d: 'de',
        e: 'e',
        f: 'efe',
        g: 'ge',
        h: 'hache',
        i: 'i',
        j: 'jota',
        k: 'ka',
        l: 'ele',
        m: 'eme',
        n: 'ene',
        ñ: 'eñe',
        o: 'o',
        p: 'pe',
        q: 'cu',
        r: 'erre',
        s: 'ese',
        t: 'te',
        u: 'u',
        v: 'uve',
        w: 'uve doble',
        x: 'equis',
        y: 'ye',
        z: 'zeta',
        á: 'a con tilde',
        é: 'e con tilde',
        í: 'i con tilde',
        ó: 'o con tilde',
        ú: 'u con tilde',
        ü: 'u con diéresis',
    },
    de: {
        a: 'a',
        b: 'Beh',
        c: 'Zeh',
        d: 'Deh',
        e: 'e',
        f: 'Eff',
        g: 'Geh',
        h: 'Ha',
        i: 'i',
        j: 'Jott',
        k: 'Ka',
        l: 'Ell',
        m: 'Emm',
        n: 'Enn',
        o: 'o',
        p: 'Peh',
        q: 'Kuh',
        r: 'Err',
        s: 'Ess',
        t: 'Tee',
        u: 'u',
        v: 'Vau',
        w: 'Weh',
        x: 'Ix',
        y: 'Ypsilon',
        z: 'Zett',
        ä: 'ä',
        ö: 'ö',
        ü: 'ü',
        ß: 'Eszett',
    },
};

export function getLetterSpeechText(letter, language) {
    const trimmed = String(letter ?? '').normalize('NFC').trim();
    if (!trimmed) return '';
    const key = trimmed.toLocaleLowerCase(language);
    const table = Object.hasOwn(letterNames, language) ? letterNames[language] : null;
    if (table && Object.hasOwn(table, key)) return table[key];
    return key;
}

export function getPracticeSpeechText({ phase, letters = [], index = 0, text = '', language }) {
    if (phase === 'free') return '';
    if (phase === 'trace') return getLetterSpeechText(letters[index] ?? '', language);
    if (letters.length === 1) return getLetterSpeechText(letters[0], language);
    return String(text ?? '').normalize('NFC').trim();
}

export function selectVoice(voices, language) {
    if (!Array.isArray(voices) || !voices.length) return null;
    const preferredLocale = language === 'de' ? 'de-de' : 'es-es';
    let bestVoice = null;
    let bestScore = -1;
    for (const voice of voices) {
        const lang = String(voice?.lang || '').replace(/_/g, '-').toLowerCase();
        if (lang !== language && !lang.startsWith(`${language}-`)) continue;
        const score = (voice.default ? 4 : 0) + (lang === preferredLocale ? 2 : 0) + (voice.localService ? 1 : 0);
        if (score > bestScore) {
            bestScore = score;
            bestVoice = voice;
        }
    }
    return bestVoice;
}

export function createSpeaker({ language, host = globalThis, onStateChange } = {}) {
    const synthesis = host?.speechSynthesis;
    const Utterance = host?.SpeechSynthesisUtterance;
    const supported = Boolean(
        synthesis &&
        typeof synthesis.speak === 'function' &&
        typeof synthesis.cancel === 'function' &&
        typeof Utterance === 'function'
    );
    let activeUtterance = null;
    let speaking = false;
    let fallbackTimer = null;

    if (supported && typeof synthesis.getVoices === 'function') {
        try { synthesis.getVoices(); } catch { /* Ignore voice preloading errors. */ }
    }

    function setSpeaking(next) {
        if (speaking === next) return;
        speaking = next;
        onStateChange?.(speaking);
    }

    function clearTimer() {
        if (fallbackTimer !== null) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
        }
    }

    function stop() {
        if (!supported) return;
        activeUtterance = null;
        clearTimer();
        if (synthesis.speaking || synthesis.pending) {
            try { synthesis.cancel(); } catch { /* Ignore cancel errors. */ }
        }
        setSpeaking(false);
    }

    function speak(value) {
        if (!supported) return false;
        const spoken = String(value ?? '').trim();
        if (!spoken) return false;

        if (synthesis.speaking || synthesis.pending) {
            try { synthesis.cancel(); } catch { /* Ignore cancel errors. */ }
        }
        clearTimer();

        const utterance = new Utterance(spoken);
        const voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
        const voice = selectVoice(voices, language);
        utterance.lang = voice?.lang || (language === 'de' ? 'de-DE' : 'es-ES');
        if (voice) utterance.voice = voice;
        utterance.rate = 0.85;
        utterance.pitch = 1;

        activeUtterance = utterance;
        const finish = () => {
            if (activeUtterance !== utterance) return;
            activeUtterance = null;
            clearTimer();
            setSpeaking(false);
        };
        utterance.onstart = () => {
            if (activeUtterance === utterance) setSpeaking(true);
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        setSpeaking(true);
        fallbackTimer = setTimeout(finish, 8000);
        fallbackTimer.unref?.();
        try {
            synthesis.speak(utterance);
            return true;
        } catch {
            finish();
            return false;
        }
    }

    return { supported, speak, stop };
}
