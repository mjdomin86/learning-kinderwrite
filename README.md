# KidWrite 🖍️

KidWrite is a lightweight, full-stack web application designed for young children to practice writing letters and words by tracing on an iPad.

It features a touch-friendly Spanish/German interface, built-in SQLite content management (Admin mode), and celebration animations. Fonts and scripts are bundled locally; no external drawing or handwriting service is used. The app still needs its server to load pages and saved content (it is not an offline-installable PWA).

---

## Features

- **Kid Mode**: Spanish/German controls, uppercase/lowercase letters, colour choices, undo, and free drawing.
- **My word**: Type a word (1–12 letters), trace its letters one at a time, then copy the whole word on a blank board. Spanish accents, ñ, German umlauts, and ß are supported. No admin login is needed.
- **Encouraging practice**: An optional guide helps with copying. Finishing an attempt earns an animal sticker and a short confetti celebration, respecting reduced-motion preferences.
- **Sticker album**: Collect 12 animals from finished activities. New animals are awarded before duplicates, and each attempt earns one sticker. Open the album from the home page or the reward dialog. Collections are saved in the current browser on this device; clearing browser data removes them. When storage is unavailable, the app shows a notice and keeps rewards for the current page session.
- **Print free drawings**: The print button opens the browser print dialog with a white-background copy of the artwork. Controls and guides are omitted, and the drawing remains available afterward. The browser can print to a supported printer or save a PDF.
- **Reliable tracing**: Coverage uses the actual letter shape, with tolerance around its edges. One captured pointer owns each stroke, so additional fingers cannot connect unrelated points. Drawing survives resizing and phase changes within the current page.
- **Admin Mode**: Manage available letters and words. Default seed data includes A-Z and 10 animals/words.
- **Resource Efficient**: Built on plain Node.js utilizing the built-in `node:sqlite` module. Operates well within limits of 128Mi Memory / 100m CPU.

---

## Local development and checks

Use Node.js 22.13+ (or a newer release with `node:sqlite`):

```bash
npm install
npm start
npm test
```

Open `http://localhost:3000`. To preview with a separate database and a loopback-only listener:

```bash
HOST=127.0.0.1 PORT=3100 DB_PATH=/tmp/kidwrite-preview.db npm start
```

The existing database and admin content do not need a migration. The language selector changes the interface and extra alphabet letters; it does not translate administrator-created words. Custom practice words are passed to the practice page and are not added to the shared library. The selected interface language is remembered when browser storage is available.

## Practice design

The activity is **choose/type → trace each letter → copy the word → celebrate effort**. Letters stay large even for longer words, and the child can switch directly to independent writing. Trace and copy drafts are kept separately until the page is left or the activity is restarted.

The percentage means *letter area painted*, not handwriting quality. Only overlap with the rendered letter counts. The next-letter button appears at 80% coverage when at least 55% of the ink is within the letter or its forgiving edge margin. Covering the whole board therefore does not unlock the next letter. Copying is deliberately ungraded: there is no handwriting recognition or stroke-order assessment. The optional guide and undo keep retrying easy.

`npm test` checks coverage, off-letter scribbling, Unicode word validation, translation consistency, pointer ownership, cancellation, delayed accidental toolbar clicks, and coalesced samples. Browser checks should also cover:

- Type `niño` and `Bär`; finish all letters, copy the word, show/hide help, and restart after the sticker.
- Draw with one finger, add another, lift the first, then move the remaining finger. No joining line or unwanted toolbar action should appear.
- Cancel a touch, leave/re-enter the board, and begin a new stroke.
- Rotate between portrait and landscape; letter traces should stay aligned and undo should still work.
- Verify the actual iPad/Safari and stylus used by the child. Pointer ownership is not hardware palm rejection; a resting finger that touches first can still own the stroke until lifted.

---

## 🚀 Deployment Instructions

### 1. Building the Docker Image
To build the Docker image locally (designed to be <50MB built on alpine):
```bash
docker build -t your-registry/kidwrite:latest .
```

### 2. Loading the image into K3s
Build the image with Podman and import it into the local K3s containerd store:
```bash
podman build -t localhost/kinderwrite:2026-09-05-1 .
podman save --format docker-archive -o /tmp/kinderwrite-image.tar localhost/kinderwrite:2026-09-05-1
sudo k3s ctr images import /tmp/kinderwrite-image.tar
```

### 3. Deploying to Kubernetes
The application is configured for the existing `finanzas` namespace and Cloudflare Tunnel. The `kidwrite.db` database is persisted using a PersistentVolumeClaim.

Copy `k8s/bitwarden-secret.example.yaml` to `k8s/bitwarden-secret.yaml` and fill in your Bitwarden organization and secret IDs. The configured file stays local. Apply it explicitly, wait for the Operator to create the Kubernetes Secret, and then apply the other manifests:
```bash
kubectl apply -f k8s/bitwarden-secret.yaml
kubectl -n finanzas wait --for=create secret/kidwrite-secret --timeout=120s
kubectl apply -f k8s/configmap.yaml -f k8s/pvc.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/networkpolicy.yaml -f k8s/cloudflared-kidwrite-egress.yaml
```
This will create:
- **kidwrite-pvc**: 1Gi persistent volume for the SQLite database.
- **kidwrite-config**: ConfigMap for non-sensitive data (e.g., admin username).
- **kidwrite-runtime**: BitwardenSecret mapping only the two required application secrets.
- **kidwrite**: The Deployment managing the pod (limits: 128Mi Mem / 100m CPU).
- **kidwrite-svc**: ClusterIP Service on port 80.
- **kidwrite-app**: NetworkPolicy allowing Cloudflare Tunnel to reach the service.
- **cloudflared-kidwrite-egress**: Adds the matching outbound permission to the existing tunnel pod.

### 4. Managing Admin Credentials
The admin credentials are synchronized from Bitwarden Secrets Manager and selected through explicit `secretKeyRef` entries.
- **Change Username**: Edit `k8s/configmap.yaml` (`ADMIN_USER`).
- **Change Password**: Update `KW_ADMIN_PASS` in Bitwarden. The Operator refreshes `kidwrite-secret`; restart the Deployment afterward so its environment is reloaded.

To apply the changes:
1. Update the username manifest or the value in Bitwarden.
2. Apply the manifest when applicable and wait for the Bitwarden Operator to synchronize.
3. Restart the pod to pick up the new environment variables:
   ```bash
   kubectl rollout restart deployment kidwrite
   ```

### 5. Publishing with Cloudflare Tunnel
In the existing remotely managed tunnel, add public hostname `kinderwrite.mjdomin.com` with service URL `http://kidwrite-svc:80`. The `cloudflared` deployment runs in the same namespace.

*Note: For the Kids menu, navigate to `/`. To access the Admin Panel, navigate to `/admin` and login with the configured credentials.*
