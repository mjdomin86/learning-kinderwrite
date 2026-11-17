import { stickers, sanitizeStickerCounts } from './stickers.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const addForm = document.getElementById('add-form');
    const profileForm = document.getElementById('profile-form');
    const logoutBtn = document.getElementById('logout-btn');
    const adminView = document.getElementById('admin-view');
    const loginView = document.getElementById('login-view');
    const loginError = document.getElementById('login-error');
    const adminItems = document.getElementById('admin-items');
    const adminProfiles = document.getElementById('admin-profiles');
    const stickerEditor = document.getElementById('sticker-editor');
    const stickerEditorTitle = document.getElementById('sticker-editor-title');
    const stickerEditorClose = document.getElementById('sticker-editor-close');
    const stickerGrid = document.getElementById('admin-sticker-grid');
    const stickerJsonInput = document.getElementById('sticker-json-input');
    const stickerJsonMerge = document.getElementById('sticker-json-merge');
    const stickerSaveBtn = document.getElementById('sticker-save-btn');
    const stickerEditorStatus = document.getElementById('sticker-editor-status');

    let editingProfileId = null;
    const stickerInputs = new Map();

    try {
        const me = await fetch('/api/admin/me');
        if (me.ok) showAdminView();
        else showLoginView();
    } catch {
        showLoginView();
    }

    function showAdminView() {
        loginView.style.display = 'none';
        adminView.style.display = 'block';
        loadProfiles();
        loadItems();
    }

    function showLoginView() {
        loginView.style.display = 'block';
        adminView.style.display = 'none';
        stickerEditor.hidden = true;
        editingProfileId = null;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) showAdminView();
            else loginError.style.display = 'block';
        } catch (err) {
            console.error(err);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLoginView();
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('profile-name');
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/admin/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                nameInput.value = '';
                await loadProfiles();
            } else {
                alert('Failed to create profile. Are you logged in?');
            }
        } catch (err) {
            console.error(err);
        }
    });

    function buildStickerGrid(counts) {
        stickerGrid.replaceChildren();
        stickerInputs.clear();
        for (const sticker of stickers) {
            const cell = document.createElement('div');
            cell.className = 'admin-sticker-cell';

            const label = document.createElement('div');
            label.className = 'admin-sticker-label';
            label.textContent = `${sticker.emoji} ${sticker.es} / ${sticker.de}`;

            const controls = document.createElement('div');
            controls.className = 'admin-sticker-controls';

            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'admin-step-btn';
            minus.textContent = '−';
            minus.setAttribute('aria-label', `Decrease ${sticker.id}`);

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.value = String(counts[sticker.id] || 0);
            input.setAttribute('aria-label', `${sticker.id} count`);

            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'admin-step-btn';
            plus.textContent = '+';
            plus.setAttribute('aria-label', `Increase ${sticker.id}`);

            minus.addEventListener('click', () => {
                const current = Math.max(0, parseInt(input.value, 10) || 0);
                input.value = String(Math.max(0, current - 1));
            });
            plus.addEventListener('click', () => {
                const current = Math.max(0, parseInt(input.value, 10) || 0);
                input.value = String(current + 1);
            });

            controls.append(minus, input, plus);
            cell.append(label, controls);
            stickerGrid.append(cell);
            stickerInputs.set(sticker.id, input);
        }
    }

    function openStickerEditor(profile) {
        editingProfileId = profile.id;
        stickerEditorTitle.textContent = `Stickers for ${profile.name}`;
        stickerJsonInput.value = '';
        stickerEditorStatus.textContent = '';
        buildStickerGrid(profile.counts || {});
        stickerEditor.hidden = false;
        stickerEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    stickerEditorClose.addEventListener('click', () => {
        stickerEditor.hidden = true;
        editingProfileId = null;
    });

    stickerJsonMerge.addEventListener('click', () => {
        const rawText = stickerJsonInput.value.trim();
        if (!rawText) return;
        try {
            let parsed = JSON.parse(rawText);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            const imported = sanitizeStickerCounts(parsed);
            const importedKeys = Object.keys(imported);
            if (importedKeys.length === 0) {
                stickerEditorStatus.textContent = 'No valid sticker IDs found in JSON.';
                return;
            }
            for (const id of importedKeys) {
                const input = stickerInputs.get(id);
                if (!input) continue;
                const current = Math.max(0, parseInt(input.value, 10) || 0);
                input.value = String(Math.max(current, imported[id]));
            }
            stickerEditorStatus.textContent = `Applied ${importedKeys.length} stickers to grid. Click "Save Stickers" to save.`;
        } catch {
            stickerEditorStatus.textContent = 'Invalid JSON. Expected format like {"fox":2,"lion":1}.';
        }
    });

    stickerSaveBtn.addEventListener('click', async () => {
        if (!editingProfileId) return;
        const counts = {};
        for (const [id, input] of stickerInputs.entries()) {
            const val = parseInt(input.value, 10);
            if (Number.isSafeInteger(val) && val > 0) counts[id] = val;
        }
        stickerSaveBtn.disabled = true;
        stickerEditorStatus.textContent = 'Saving…';
        try {
            const res = await fetch(`/api/admin/profiles/${editingProfileId}/stickers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ counts, mode: 'replace' })
            });
            if (res.ok) {
                stickerEditorStatus.textContent = 'Stickers saved!';
                await loadProfiles();
            } else {
                stickerEditorStatus.textContent = 'Failed to save stickers.';
            }
        } catch {
            stickerEditorStatus.textContent = 'Network error while saving.';
        } finally {
            stickerSaveBtn.disabled = false;
        }
    });

    async function loadProfiles() {
        try {
            const res = await fetch('/api/admin/profiles');
            if (!res.ok) return;
            const profiles = await res.json();
            adminProfiles.replaceChildren();

            if (profiles.length === 0) {
                const empty = document.createElement('li');
                empty.className = 'admin-help';
                empty.textContent = 'No profiles yet. Create one above to generate a link for your child.';
                adminProfiles.append(empty);
                return;
            }

            profiles.forEach(profile => {
                const li = document.createElement('li');
                li.className = 'profile-card';

                const topRow = document.createElement('div');
                topRow.className = 'profile-card-top';

                const info = document.createElement('div');
                const title = document.createElement('strong');
                title.textContent = profile.name;
                const counts = profile.counts || {};
                const discovered = Object.keys(counts).length;
                const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
                const stats = document.createElement('span');
                stats.className = 'admin-help';
                stats.textContent = ` — ${discovered}/${stickers.length} discovered (${total} total)`;
                info.append(title, stats);

                const actions = document.createElement('div');
                actions.className = 'profile-actions';

                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'admin-btn admin-btn-small';
                editBtn.textContent = 'Stickers';
                editBtn.addEventListener('click', () => openStickerEditor(profile));

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-btn';
                delBtn.textContent = 'Delete';
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Delete profile "${profile.name}" and all its stickers?`)) return;
                    const delRes = await fetch(`/api/admin/profiles/${profile.id}`, { method: 'DELETE' });
                    if (delRes.ok) {
                        if (editingProfileId === profile.id) {
                            stickerEditor.hidden = true;
                            editingProfileId = null;
                        }
                        loadProfiles();
                    }
                });

                actions.append(editBtn, delBtn);
                topRow.append(info, actions);

                const linkRow = document.createElement('div');
                linkRow.className = 'profile-link-row';
                const profileUrl = `${location.origin}/?kid=${encodeURIComponent(profile.token)}`;

                const linkInput = document.createElement('input');
                linkInput.type = 'text';
                linkInput.readOnly = true;
                linkInput.value = profileUrl;
                linkInput.setAttribute('aria-label', `Profile link for ${profile.name}`);
                linkInput.addEventListener('click', () => linkInput.select());

                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'admin-btn admin-btn-secondary admin-btn-small';
                copyBtn.textContent = 'Copy Link';
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(profileUrl);
                        copyBtn.textContent = 'Copied!';
                    } catch {
                        linkInput.select();
                        document.execCommand('copy');
                        copyBtn.textContent = 'Copied!';
                    }
                    setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
                });

                const openLink = document.createElement('a');
                openLink.href = profileUrl;
                openLink.target = '_blank';
                openLink.rel = 'noopener';
                openLink.className = 'admin-open-link';
                openLink.textContent = 'Open';

                linkRow.append(linkInput, copyBtn, openLink);
                li.append(topRow, linkRow);
                adminProfiles.append(li);
            });
        } catch (err) {
            console.error(err);
        }
    }

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('item-type').value;
        const content = document.getElementById('item-content').value;
        const animal = document.getElementById('item-animal').value;

        try {
            const res = await fetch('/api/admin/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, content, animal })
            });
            if (res.ok) {
                document.getElementById('item-content').value = '';
                loadItems();
            } else {
                alert('Failed to add item. Are you logged in?');
            }
        } catch (err) {
            console.error(err);
        }
    });

    async function loadItems() {
        try {
            const res = await fetch('/api/items');
            const items = await res.json();
            adminItems.replaceChildren();
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'item-row';

                const label = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = item.content;
                label.append(strong, ` (${item.type}) - ${item.animal}`);

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-btn';
                delBtn.textContent = 'Delete';
                delBtn.addEventListener('click', async () => {
                    if (!confirm('Are you sure you want to delete this item?')) return;
                    const delRes = await fetch(`/api/admin/items/${item.id}`, { method: 'DELETE' });
                    if (delRes.ok) loadItems();
                });

                li.append(label, delBtn);
                adminItems.append(li);
            });
        } catch (err) {
            console.error(err);
        }
    }
});
