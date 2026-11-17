import { normalizeWord, measureCoverage, bindDrawingInput } from './tracing-core.js';
import { messages, getLanguage, saveLanguage } from './translations.js';
import { createStickerCollection, initStickerAlbum } from './stickers.js';
import { getPracticeSpeechText, createSpeaker } from './speech.js';

const language = getLanguage();
const t = messages[language];
document.documentElement.lang = language;
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t[el.dataset.i18n]; });
const collection = createStickerCollection(() => localStorage);
initStickerAlbum(collection, language, t);
const emojiMap = { 'T-Rex': '🦖', Triceratops: '🦕', Elephant: '🐘', Giraffe: '🦒', Cat: '🐱', Dog: '🐶', Frog: '🐸', Owl: '🦉', Bee: '🐝', Fish: '🐟' };
const practiceURL = text => `/trace?${new URLSearchParams({ text, lang: language })}`;

if (document.getElementById('word-form')) initHome();
else initTrace();

async function initHome() {
    document.getElementById('free-link').href = `/trace?lang=${language}`;
    document.querySelectorAll('[data-language]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.language === language));
        button.addEventListener('click', () => {
            saveLanguage(button.dataset.language);
            location.href = `/?lang=${button.dataset.language}`;
        });
    });
    const input = document.getElementById('word-input');
    const error = document.getElementById('word-error');
    input.placeholder = t.placeholder;
    input.lang = language;
    document.getElementById('word-form').addEventListener('submit', event => {
        event.preventDefault();
        const word = normalizeWord(input.value);
        error.hidden = !!word;
        input.setAttribute('aria-invalid', String(!word));
        if (word) location.href = practiceURL(word);
        else input.focus();
    });
    input.addEventListener('input', () => { error.hidden = true; input.removeAttribute('aria-invalid'); });
    t.examples.forEach(word => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'word-chip';
        button.textContent = word;
        button.addEventListener('click', () => {
            input.value = word;
            input.dispatchEvent(new Event('input'));
            input.focus();
        });
        document.getElementById('suggestions').append(button);
    });
    let items = [];
    let category = 'letter';
    let lower = false;
    const grid = document.getElementById('grid');
    function render() {
        grid.replaceChildren();
        const visible = items.filter(item => item.type === category);
        if (category === 'letter') {
            const extra = language === 'es' ? ['Ñ'] : ['Ä', 'Ö', 'Ü', 'ẞ'];
            extra.forEach(content => {
                if (!visible.some(item => item.content.toLocaleUpperCase(language) === content)) visible.push({ content });
            });
        }
        visible.forEach((item, index) => {
            const content = category === 'letter' && lower ? item.content.toLocaleLowerCase(language) : item.content;
            const card = document.createElement('a');
            card.className = `letter-card tint-${index % 4}`;
            card.href = practiceURL(content);
            const text = document.createElement('span');
            text.className = 'card-letter';
            text.textContent = content;
            const decoration = document.createElement('span');
            decoration.className = 'card-decoration';
            decoration.setAttribute('aria-hidden', 'true');
            decoration.textContent = category === 'word' ? (emojiMap[item.animal] || '✦') : '↗';
            card.append(text, decoration);
            grid.append(card);
        });
        document.getElementById('empty').hidden = visible.length > 0;
        document.getElementById('case-controls').hidden = category !== 'letter';
    }
    document.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', () => {
            category = button.dataset.category;
            document.querySelectorAll('[data-category]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
            render();
        });
    });
    document.querySelectorAll('[data-case]').forEach(button => {
        button.setAttribute('aria-label', button.dataset.case === 'lower' ? t.lowercase : t.uppercase);
        button.addEventListener('click', () => {
            lower = button.dataset.case === 'lower';
            document.querySelectorAll('[data-case]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
            render();
        });
    });
    async function loadItems() {
        const loading = document.getElementById('loading');
        const retry = document.getElementById('retry');
        retry.hidden = true;
        loading.hidden = false;
        loading.textContent = t.loading;
        try {
            const response = await fetch('/api/items');
            if (!response.ok) throw new Error('Could not load items');
            items = await response.json();
            render();
            loading.hidden = true;
        } catch {
            loading.textContent = t.loadError;
            retry.hidden = false;
        }
    }
    document.getElementById('retry').addEventListener('click', loadItems);
    await loadItems();
}

async function initTrace() {
    const rawText = new URLSearchParams(location.search).get('text') || '';
    const text = normalizeWord(rawText);
    const free = !rawText;
    document.getElementById('btn-back').href = `/?lang=${language}`;
    document.getElementById('another-word').href = `/?lang=${language}`;
    if (rawText && !text) {
        document.getElementById('trace-workspace').hidden = true;
        document.getElementById('invalid-word').hidden = false;
        return;
    }
    const letters = Array.from(text);
    const title = document.getElementById('practice-title');
    title.textContent = free ? t.free : text;
    document.title = `${title.textContent} · KidWrite`;
    const canvas = document.getElementById('trace-canvas');
    const guide = document.getElementById('guide-canvas');
    const ctx = canvas.getContext('2d');
    const guideCtx = guide.getContext('2d');
    const target = document.createElement('canvas');
    const tolerance = document.createElement('canvas');
    const scoreInk = document.createElement('canvas');
    const targetCtx = target.getContext('2d', { willReadFrequently: true });
    const toleranceCtx = tolerance.getContext('2d', { willReadFrequently: true });
    const scoreCtx = scoreInk.getContext('2d', { willReadFrequently: true });
    const board = document.getElementById('writing-board');
    const progress = document.getElementById('trace-progress');
    const progressValue = document.getElementById('progress-value');
    const feedback = document.getElementById('feedback');
    const next = document.getElementById('btn-next');
    const done = document.getElementById('btn-done');
    const help = document.getElementById('btn-guide');
    const undo = document.getElementById('btn-undo');
    const clear = document.getElementById('btn-clear');
    const listen = document.getElementById('btn-listen');
    const listenLabel = document.getElementById('listen-label');
    undo.setAttribute('aria-label', t.undo);
    clear.setAttribute('aria-label', t.clear);
    const speaker = createSpeaker({
        language,
        onStateChange: speaking => listen.classList.toggle('is-speaking', speaking),
    });
    const ribbon = document.getElementById('letter-ribbon');
    const dialog = document.getElementById('celebration');
    const printButtons = document.querySelectorAll('[data-print-drawing]');
    let earnedReward = null;
    let printing = false;
    const colours = ['#3273cf', '#d94d77', '#25846c', '#8851bd'];
    let colour = colours[0];
    let phase = free ? 'free' : 'trace';
    let index = 0;
    let strokes = [];
    let currentStroke = null;
    let showGuide = false;
    let width = 0;
    let height = 0;
    let brush = 20;
    let drawingUnit = 1;
    let targetPixels;
    let tolerancePixels;
    const completed = new Set();
    const drafts = new Map();
    const draftKey = () => `${phase}:${phase === 'trace' ? index : 0}`;

    document.getElementById('practice-tabs').hidden = free;
    printButtons.forEach(button => { button.hidden = !free; });
    canvas.setAttribute('aria-label', t.board);
    document.getElementById('colour-picker').setAttribute('aria-label', t.colours);
    colours.forEach((value, i) => {
        const button = document.createElement('button');
        button.className = 'colour-button';
        button.style.setProperty('--swatch', value);
        button.setAttribute('aria-label', t.colourNames[i]);
        button.setAttribute('aria-pressed', String(i === 0));
        button.addEventListener('click', () => {
            colour = value;
            document.querySelectorAll('.colour-button').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
        });
        document.getElementById('colour-picker').append(button);
    });
    function drawStroke(context, stroke) {
        context.strokeStyle = stroke.colour;
        context.fillStyle = stroke.colour;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = stroke.size * drawingUnit;
        context.beginPath();
        const first = stroke.points[0];
        context.arc(width / 2 + first.x * drawingUnit, height / 2 + first.y * drawingUnit, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(width / 2 + first.x * drawingUnit, height / 2 + first.y * drawingUnit);
        for (const point of stroke.points.slice(1)) context.lineTo(width / 2 + point.x * drawingUnit, height / 2 + point.y * drawingUnit);
        context.stroke();
    }
    function redraw() {
        ctx.clearRect(0, 0, width, height);
        strokes.forEach(stroke => drawStroke(ctx, stroke));
    }
    function layoutText(context, value, maxWidth, maxHeight) {
        // Visible guide and score mask use identical font metrics and positioning.
        let size = maxHeight;
        context.font = `500 ${size}px Arial, sans-serif`;
        const measured = context.measureText(value).width;
        if (measured > maxWidth) size *= maxWidth / measured;
        context.font = `500 ${size}px Arial, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'alphabetic';
        const bounds = context.measureText(value);
        return { font: context.font, x: width / 2, y: height / 2 + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2, size };
    }
    function paintGuides() {
        guideCtx.clearRect(0, 0, width, height);
        targetCtx.clearRect(0, 0, target.width, target.height);
        toleranceCtx.clearRect(0, 0, tolerance.width, tolerance.height);
        drawingUnit = Math.min(width, height);
        if (phase === 'free') return;
        const value = phase === 'trace' ? letters[index] : text;
        const layout = layoutText(guideCtx, value, width * 0.83, height * (phase === 'trace' ? 0.8 : 0.52));
        brush = phase === 'trace' ? Math.max(16, Math.min(42, layout.size * 0.085)) : 9;
        if (phase === 'trace') drawingUnit = layout.size;
        guideCtx.strokeStyle = '#dce5e2';
        guideCtx.lineWidth = 1.5;
        const metrics = guideCtx.measureText(value);
        for (const y of [layout.y - metrics.actualBoundingBoxAscent, layout.y]) {
            guideCtx.beginPath();
            guideCtx.moveTo(24, y);
            guideCtx.lineTo(width - 24, y);
            guideCtx.stroke();
        }
        guideCtx.setLineDash([6, 8]);
        guideCtx.beginPath();
        guideCtx.moveTo(24, layout.y - metrics.actualBoundingBoxAscent / 2);
        guideCtx.lineTo(width - 24, layout.y - metrics.actualBoundingBoxAscent / 2);
        guideCtx.stroke();
        guideCtx.setLineDash([]);
        if (phase === 'trace' || showGuide) {
            guideCtx.fillStyle = '#e3e9e7';
            guideCtx.fillText(value, layout.x, layout.y);
            guideCtx.strokeStyle = '#aebdb7';
            guideCtx.lineWidth = 1.5;
            guideCtx.strokeText(value, layout.x, layout.y);
        }
        if (phase === 'trace') {
            for (const context of [targetCtx, toleranceCtx]) {
                context.save();
                context.scale(target.width / width, target.height / height);
                context.font = layout.font;
                context.textAlign = 'center';
                context.textBaseline = 'alphabetic';
                context.fillStyle = '#000';
                context.fillText(value, layout.x, layout.y);
                if (context === toleranceCtx) {
                    context.strokeStyle = '#000';
                    context.lineWidth = brush * 0.9;
                    context.lineJoin = 'round';
                    context.strokeText(value, layout.x, layout.y);
                }
                context.restore();
            }
            targetPixels = targetCtx.getImageData(0, 0, target.width, target.height).data;
            tolerancePixels = toleranceCtx.getImageData(0, 0, tolerance.width, tolerance.height).data;
        }
    }
    function updateScore() {
        undo.disabled = clear.disabled = strokes.length === 0;
        done.disabled = strokes.length === 0;
        printButtons.forEach(button => { button.disabled = strokes.length === 0; });
        if (phase !== 'trace' || !targetPixels) return;
        scoreCtx.clearRect(0, 0, scoreInk.width, scoreInk.height);
        scoreCtx.drawImage(canvas, 0, 0, scoreInk.width, scoreInk.height);
        const result = measureCoverage(targetPixels, scoreCtx.getImageData(0, 0, scoreInk.width, scoreInk.height).data, tolerancePixels);
        progress.value = result.coverage;
        progressValue.textContent = `${result.coverage}%`;
        next.hidden = !result.complete;
        if (result.complete) completed.add(index);
        else completed.delete(index);
        feedback.textContent = result.complete ? t.ready : result.precision < 0.55 ? t.stayClose : result.coverage ? t.keepGoing : t.start;
        renderRibbon();
    }
    function renderRibbon() {
        ribbon.replaceChildren();
        if (phase !== 'trace') return;
        letters.forEach((letter, i) => {
            const element = document.createElement('span');
            element.textContent = letter;
            element.className = `ribbon-letter${i === index ? ' current' : ''}${completed.has(i) ? ' finished' : ''}`;
            if (i === index) element.setAttribute('aria-current', 'step');
            ribbon.append(element);
        });
    }
    function setPhase(newPhase, newIndex = index) {
        input.cancel();
        speaker.stop();
        drafts.set(draftKey(), strokes);
        phase = newPhase;
        index = newIndex;
        strokes = drafts.get(draftKey()) || [];
        showGuide = false;
        refresh();
    }
    function refresh() {
        document.querySelectorAll('[data-phase]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.phase === phase)));
        document.getElementById('board-hint').textContent = phase === 'trace' ? t.traceHint : phase === 'copy' ? t.copyHint : t.freeDrawHint;
        document.getElementById('step-label').textContent = phase === 'trace' ? t.letterOf(index + 1, letters.length) : phase === 'copy' ? text : '✦';
        document.getElementById('step-label').classList.toggle('word-model', phase === 'copy');
        const showListen = !free && speaker.supported;
        listen.hidden = !showListen;
        if (showListen) {
            const isSingleLetter = phase === 'trace' || letters.length === 1;
            const targetValue = phase === 'trace' ? letters[index] : text;
            listenLabel.textContent = isSingleLetter ? t.listenLetter : t.listenWord;
            listen.setAttribute('aria-label', isSingleLetter ? t.listenLetterAria(targetValue) : t.listenWordAria(targetValue));
        }
        document.getElementById('progress-panel').hidden = phase !== 'trace';
        ribbon.hidden = phase !== 'trace' || letters.length < 2;
        document.getElementById('practice-note').textContent = phase === 'trace' ? t.traceNote : phase === 'copy' ? t.copyNote : '';
        help.hidden = phase !== 'copy';
        help.textContent = t.showGuide;
        help.setAttribute('aria-pressed', 'false');
        next.hidden = true;
        next.textContent = index < letters.length - 1 ? t.next : t.copyNow;
        done.hidden = phase === 'trace';
        paintGuides();
        redraw();
        updateScore();
        renderRibbon();
    }
    function point(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)) - width / 2) / drawingUnit,
            y: (Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)) - height / 2) / drawingUnit,
        };
    }
    const input = bindDrawingInput(canvas, {
        start(event) {
            if (!width || !height) return;
            currentStroke = { colour, size: brush / drawingUnit, points: [point(event)] };
            strokes.push(currentStroke);
            drawStroke(ctx, currentStroke);
        },
        move(event) {
            if (!currentStroke) return;
            const previous = currentStroke.points.at(-1);
            const nextPoint = point(event);
            currentStroke.points.push(nextPoint);
            drawStroke(ctx, { ...currentStroke, points: [previous, nextPoint] });
        },
        end() { currentStroke = null; updateScore(); },
    });
    function resize() {
        if (printing) return;
        const rect = board.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        if (rect.width === width && rect.height === height && canvas.width === Math.round(rect.width * scale)) return;
        input.cancel();
        width = rect.width;
        height = rect.height;
        for (const element of [canvas, guide]) {
            element.width = Math.round(width * scale);
            element.height = Math.round(height * scale);
            element.getContext('2d').setTransform(element.width / width, 0, 0, element.height / height, 0, 0);
        }
        // Bound score work; Retina screens don't multiply the cost.
        const scoreScale = Math.min(1, 400 / width, 400 / height);
        for (const element of [target, tolerance, scoreInk]) {
            element.width = Math.max(1, Math.round(width * scoreScale));
            element.height = Math.max(1, Math.round(height * scoreScale));
        }
        paintGuides();
        redraw();
        updateScore();
    }
    document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => setPhase(button.dataset.phase)));
    next.addEventListener('click', () => {
        if (index < letters.length - 1) setPhase('trace', index + 1);
        else setPhase('copy');
    });
    undo.addEventListener('click', () => { input.cancel(); strokes.pop(); redraw(); updateScore(); });
    clear.addEventListener('click', () => { input.cancel(); strokes = []; redraw(); updateScore(); });
    help.addEventListener('click', () => {
        showGuide = !showGuide;
        help.textContent = showGuide ? t.hideGuide : t.showGuide;
        help.setAttribute('aria-pressed', String(showGuide));
        paintGuides();
    });
    listen.addEventListener('click', () => {
        if (free) return;
        speaker.speak(getPracticeSpeechText({ phase, letters, index, text, language }));
    });
    done.addEventListener('click', () => {
        if (!strokes.length) return;
        speaker.stop();
        document.getElementById('celebration-title').textContent = free ? t.freeCelebration : t.celebration;
        if (!earnedReward) earnedReward = collection.earn();
        document.getElementById('sticker').textContent = earnedReward.sticker.emoji;
        document.getElementById('sticker-save-status').textContent = earnedReward.persistent ? t.stickerSaved : t.albumTemporary;
        dialog.showModal();
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches && typeof confetti === 'function') {
            confetti({ particleCount: 65, spread: 65, origin: { y: 0.65 }, disableForReducedMotion: true });
        }
    });
    document.getElementById('btn-again').addEventListener('click', () => {
        dialog.close();
        speaker.stop();
        drafts.clear();
        earnedReward = null;
        completed.clear();
        strokes = [];
        index = 0;
        phase = free ? 'free' : 'trace';
        refresh();
    });
    function preparePrint() {
        if (document.body.classList.contains('printing-sticker')) return;
        if (!free || !strokes.length) return;
        input.cancel();
        // Freeze a separate copy before print layout can resize the drawing board.
        const artwork = document.getElementById('print-artwork');
        artwork.width = canvas.width;
        artwork.height = canvas.height;
        const printContext = artwork.getContext('2d');
        printContext.fillStyle = '#fff';
        printContext.fillRect(0, 0, artwork.width, artwork.height);
        printContext.drawImage(canvas, 0, 0);
        document.body.classList.add('printing-drawing');
        printing = true;
    }
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', () => {
        printing = false;
        document.body.classList.remove('printing-drawing');
    });
    printButtons.forEach(button => button.addEventListener('click', () => {
        if (!free || !strokes.length) return;
        preparePrint();
        window.print();
    }));
    window.addEventListener('pagehide', () => speaker.stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) speaker.stop(); });
    await document.fonts.ready;
    resize();
    refresh();
    new ResizeObserver(resize).observe(board);
}
