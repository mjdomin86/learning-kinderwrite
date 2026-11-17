import test from 'node:test';
import assert from 'node:assert/strict';
import { letterNames, getLetterSpeechText, getPracticeSpeechText, selectVoice, createSpeaker } from '../static/speech.js';

test('Spanish letter names cover the alphabet, ñ, case variants, and accented letters', () => {
    assert.equal(Object.keys(letterNames.es).length, 33);
    assert.equal(getLetterSpeechText('A', 'es'), 'a');
    assert.equal(getLetterSpeechText('b', 'es'), 'be');
    assert.equal(getLetterSpeechText('Ñ', 'es'), 'eñe');
    assert.equal(getLetterSpeechText('n\u0303', 'es'), 'eñe');
    assert.equal(getLetterSpeechText('V', 'es'), 'uve');
    assert.equal(getLetterSpeechText('W', 'es'), 'uve doble');
    assert.equal(getLetterSpeechText('Y', 'es'), 'ye');
    assert.equal(getLetterSpeechText('á', 'es'), 'a con tilde');
    assert.equal(getLetterSpeechText('Ü', 'es'), 'u con diéresis');
});

test('German letter names cover the alphabet, umlauts, and both ß and ẞ', () => {
    assert.equal(Object.keys(letterNames.de).length, 30);
    assert.equal(getLetterSpeechText('B', 'de'), 'Beh');
    assert.equal(getLetterSpeechText('C', 'de'), 'Zeh');
    assert.equal(getLetterSpeechText('Q', 'de'), 'Kuh');
    assert.equal(getLetterSpeechText('R', 'de'), 'Err');
    assert.equal(getLetterSpeechText('V', 'de'), 'Vau');
    assert.equal(getLetterSpeechText('Y', 'de'), 'Ypsilon');
    assert.equal(getLetterSpeechText('Ä', 'de'), 'ä');
    assert.equal(getLetterSpeechText('ö', 'de'), 'ö');
    assert.equal(getLetterSpeechText('Ü', 'de'), 'ü');
    assert.equal(getLetterSpeechText('ß', 'de'), 'Eszett');
    assert.equal(getLetterSpeechText('ẞ', 'de'), 'Eszett');
});

test('unknown letters and prototype keys fall back safely', () => {
    assert.equal(getLetterSpeechText('', 'es'), '');
    assert.equal(getLetterSpeechText('Ç', 'es'), 'ç');
    assert.equal(getLetterSpeechText('toString', 'es'), 'tostring');
});

test('practice speech resolves letter names in trace mode and words or single letters in copy mode', () => {
    assert.equal(getPracticeSpeechText({ phase: 'free', letters: [], text: '', language: 'es' }), '');
    assert.equal(getPracticeSpeechText({ phase: 'trace', letters: ['Ñ'], index: 0, text: 'Ñ', language: 'es' }), 'eñe');
    assert.equal(getPracticeSpeechText({ phase: 'copy', letters: ['Ñ'], index: 0, text: 'Ñ', language: 'es' }), 'eñe');
    const word = Array.from('mamá');
    assert.equal(getPracticeSpeechText({ phase: 'trace', letters: word, index: 0, text: 'mamá', language: 'es' }), 'eme');
    assert.equal(getPracticeSpeechText({ phase: 'trace', letters: word, index: 3, text: 'mamá', language: 'es' }), 'a con tilde');
    assert.equal(getPracticeSpeechText({ phase: 'copy', letters: word, index: 0, text: 'mamá', language: 'es' }), 'mamá');
    assert.equal(getPracticeSpeechText({ phase: 'trace', letters: ['B', 'ä', 'r'], index: 1, text: 'Bär', language: 'de' }), 'ä');
    assert.equal(getPracticeSpeechText({ phase: 'copy', letters: ['B', 'ä', 'r'], index: 0, text: 'Bär', language: 'de' }), 'Bär');
});

test('selectVoice prefers default, exact locale, and local voices for the active language', () => {
    const voices = [
        { name: 'English', lang: 'en-US', default: true, localService: true },
        { name: 'Remote ES', lang: 'es-ES', default: false, localService: false },
        { name: 'Local MX', lang: 'es_MX', default: false, localService: true },
        { name: 'Local ES', lang: 'es-ES', default: false, localService: true },
        { name: 'Local AT', lang: 'de-AT', default: false, localService: true },
    ];
    assert.equal(selectVoice(voices, 'es').name, 'Local ES');
    assert.equal(selectVoice(voices, 'de').name, 'Local AT');
    assert.equal(selectVoice([{ name: 'English', lang: 'en-US', default: true, localService: true }], 'de'), null);
});

test('createSpeaker handles unsupported hosts safely', () => {
    const speaker = createSpeaker({ language: 'es', host: {} });
    assert.equal(speaker.supported, false);
    assert.equal(speaker.speak('be'), false);
    assert.doesNotThrow(() => speaker.stop());
});

test('createSpeaker speaks in the selected language, cancels overlaps, and ignores stale callbacks', () => {
    const spoken = [];
    const states = [];
    let cancels = 0;
    class FakeUtterance {
        constructor(text) { this.text = text; }
    }
    const synthesis = {
        speaking: false,
        pending: false,
        getVoices: () => [
            { name: 'Anna', lang: 'de-DE', default: false, localService: true },
            { name: 'Monica', lang: 'es-ES', default: false, localService: true },
        ],
        speak(utterance) {
            this.speaking = true;
            spoken.push(utterance);
        },
        cancel() {
            cancels++;
            this.speaking = false;
            this.pending = false;
        },
    };
    const speaker = createSpeaker({
        language: 'de',
        host: { speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance },
        onStateChange: state => states.push(state),
    });

    assert.equal(speaker.supported, true);
    assert.equal(speaker.speak('Beh'), true);
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].text, 'Beh');
    assert.equal(spoken[0].lang, 'de-DE');
    assert.equal(spoken[0].voice.name, 'Anna');
    assert.equal(spoken[0].rate, 0.85);
    assert.deepEqual(states, [true]);

    // Tapping again while speaking cancels the first utterance and ignores its late onerror.
    assert.equal(speaker.speak('Zeh'), true);
    assert.equal(cancels, 1);
    spoken[0].onerror();
    assert.deepEqual(states, [true]);

    // Completing the active utterance clears the speaking state.
    synthesis.speaking = false;
    spoken[1].onend();
    assert.deepEqual(states, [true, false]);

    // Speaking again while idle does not call cancel unnecessarily.
    assert.equal(speaker.speak('Eszett'), true);
    assert.equal(cancels, 1);
    speaker.stop();
    assert.equal(cancels, 2);
    assert.deepEqual(states, [true, false, true, false]);
});
