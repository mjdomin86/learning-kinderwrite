## Project: KidWrite — A Kids' Handwriting Tracing App (Kubernetes-Ready)

### Overview
Build a lightweight, full-stack web application called **KidWrite** designed for a 5-year-old child to practice writing letters and words by tracing on an iPad. The app must run in a Kubernetes cluster, be resource-efficient, and have a fun, child-friendly UI with dinosaur/animal themes.

---

### Tech Stack (keep it lightweight)
- **Backend**: Go (Golang) with a simple HTTP server, OR Node.js with Fastify — prioritize low memory usage
- **Frontend**: Plain HTML5 + CSS3 + Vanilla JavaScript (NO heavy frameworks) — rendered server-side or as static files
- **Database**: SQLite (single file, zero external dependencies) with a Go/Node SQLite driver
- **Container**: Single Docker image, multi-stage build, final image based on `alpine` or `scratch`
- **Storage**: SQLite DB stored in a Kubernetes PersistentVolumeClaim (1Gi is enough)

---

### Kubernetes Deployment Requirements
Provide ready-to-use Kubernetes manifests in a `/k8s` folder:
- `deployment.yaml` — 1 replica, resource limits: `128Mi` memory, `100m` CPU; requests: `64Mi`, `50m`
- `service.yaml` — ClusterIP service on port 80
- `ingress.yaml` — Example ingress (nginx), with a placeholder hostname like `kidwrite.local`
- `pvc.yaml` — PersistentVolumeClaim for SQLite storage
- `configmap.yaml` — Admin credentials and app config (ADMIN_USER, ADMIN_PASS as env vars)
- `secret.yaml` — Example secret template for the admin password

---

### Application Features

#### 👶 Kid Mode (default, no login needed)
- Big, colorful screen optimized for iPad (touch-friendly, no hover states needed)
- Home screen shows a grid of **letters (A–Z)** and **words**, each shown as a card with:
  - A large cute **dinosaur or animal SVG illustration** (inline SVG, no external image CDN)
  - The letter or word displayed in a large, rounded, child-friendly font (use Google Fonts: "Fredoka One" or "Baloo 2")
- Tapping a card opens the **Tracing Screen**:
  - The letter or word is displayed in a **dotted/dashed outline** (CSS stroke dashes or SVG path)
  - The child uses their finger to trace over the letter on an HTML5 Canvas
  - The canvas detects touch/pointer input and draws a thick, colorful line as the child traces
  - A **"Try Again" button** clears the canvas
  - A **star animation or confetti burst** plays when the child lifts their finger (celebrate every attempt!)
  - A **back button** returns to the home screen
- The UI must use: bright pastel colors, large rounded buttons, zero text menus, emoji or icon-based navigation only

#### 🔐 Admin Mode (protected)
- Accessible via `/admin` route
- Simple login form (username + password, stored as env vars, no user table needed)
- After login, show a dashboard to:
  - **View** all letters and words
  - **Add** a new letter or word (input: the character/word, choose a category: "letter" or "word", pick an associated animal/dino from a dropdown)
  - **Delete** existing entries
  - **Reorder** entries (drag-and-drop or up/down arrows)
- Session managed via a simple signed cookie or JWT stored in a cookie (no external auth library needed)
- Admin panel should be functional but minimal — it's for a parent, not a child

---

### Database Schema (SQLite)
```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('letter', 'word')),
  content TEXT NOT NULL,         -- e.g. "A" or "cat"
  animal TEXT NOT NULL,          -- e.g. "dinosaur", "cat", "elephant"
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
Seed the database on first run with all 26 letters (A–Z) and 10 simple words (cat, dog, sun, hat, cup, bus, ant, egg, fig, jam), each assigned a fun animal.

---

### Inline SVG Animal Illustrations
- Include at least **10 simple, cute SVG animal/dino illustrations** fully inline (no external URLs)
- Animals to include: T-Rex, Triceratops, Elephant, Giraffe, Cat, Dog, Frog, Owl, Bee, Fish
- SVGs must be simple (under 2KB each), colorful, and cartoonish
- Each animal is associated with one or more letters/words in the seed data

---

### Tracing UX Details (important!)
- Use SVG paths for letter outlines: each letter should have a pre-defined SVG path with `stroke-dasharray` to create a dotted guide
- OR use a large, dashed CSS outline with the letter in a big box — simpler but acceptable
- The canvas for drawing should overlay the letter guide
- Line width for tracing: at least 20px, with a fun color (randomize per session from a pastel palette)
- Do NOT validate accuracy — this is just for fun and motor skill practice. Celebrate all attempts equally.

---

### Project Structure
/
├── main.go (or server.js)        # HTTP server + routes
├── db.go (or db.js)              # SQLite setup and queries
├── static/
│   ├── index.html                # Kid home screen
│   ├── trace.html                # Tracing screen
│   ├── admin.html                # Admin dashboard
│   ├── style.css                 # Global styles
│   ├── app.js                    # Kid-mode JS (tracing canvas, navigation)
│   ├── admin.js                  # Admin panel JS
│   └── animals/                  # Inline SVG files (one per animal)
├── Dockerfile                    # Multi-stage, alpine final image
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── pvc.yaml
│   ├── configmap.yaml
│   └── secret.yaml
└── README.md                     # Setup and deployment instructions

---

### Non-Functional Requirements
- **Memory**: App should idle under 30MB RAM
- **Startup time**: Under 2 seconds
- **No external network calls** at runtime (all fonts, SVGs, assets must be bundled or self-hosted)
- **iPad optimized**: Test layout at 768×1024 and 1024×1366 viewport sizes
- **Touch-first**: All interactive elements must be at least 60×60px tap targets
- **Offline-capable**: App should work without internet once deployed (no CDN dependencies)
- **Accessible**: High contrast colors, large text (minimum 24px body, 64px+ for letters)

---

### README must include:
1. How to build the Docker image
2. How to push to a registry
3. How to deploy with `kubectl apply -f k8s/`
4. How to change the admin password via the ConfigMap/Secret
5. How to access the app from an iPad on the local network

---

### Deliverables
- Full working source code
- Dockerfile
- All Kubernetes manifests
- Seeded SQLite database (or migration script)
- README.md with deployment instructions

The result should be a single Docker image under **50MB**, deployable with a single `kubectl apply` command.