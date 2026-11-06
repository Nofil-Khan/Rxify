# Rxify Pharmacy Dispensary Workspace

A clinical-cool dispensary workspace built with React 18, TypeScript, Tailwind CSS, Motion, and TanStack Query, matching the dark botanical green aesthetic, 3D perspective glassmorphism, and clinical workflow specifications.

---

## 🌿 Overview & Architecture

Rxify provides a responsive pharmacy dispensary dashboard divided into three main operational views:
1. **Prescriptions Queue (Left Column)**: Vertical timeline rail with real-time relative timestamps, filter controls (Newest, Oldest, Urgent, Stock availability), and keyboard navigation (<kbd>↑</kbd> / <kbd>↓</kbd>).
2. **Prescription Detail Card (Center Column)**: Frosted warm cream card (`.cream-card`) displaying patient demographics, clinical diagnosis, physician instructions, and prescribed medicines with 3D thumbnails, inventory statuses, and action menus.
3. **Medicine Stock Panel (Right Column)**: Inventory telemetry featuring an SVG animated donut gauge, legend metrics (Available, Reserved, Reorder Level), Radix Tabs (Stock, Batch, Info), and interactive stock adjustments.
4. **Interactive Action Workflow Bar (Bottom Pill)**: Floating glass pill enforcing a 5-step clinical state machine (`Process Request` → `Reserve Stock` → `Mark Ready` → `Verify Pickup` → `Complete`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js $\ge 18$
- npm $\ge 9$
- Python 3.12+ (for FastAPI backend operations)

### Installation
```bash
# Navigate to the frontend directory
cd better-frontend

# Install dependencies
npm install
```

### Running Development Server
```bash
# Starts Vite dev server on http://localhost:3000
npm run dev
```

### Running Production Build
```bash
# Typecheck with TypeScript and build minified production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## ⚙️ Connected Backend Commands & APIs

The dispensary frontend is connected to all the FastAPI endpoints and backend operations in `routers/dispensary.py`, `routers/medicine.py`, and `routers/prescription.py`:

| UI Feature / Control | Backend Endpoint / Command | Method | Description |
| :--- | :--- | :--- | :--- |
| **Workflow Step 1 (Process)** | `/api/dispensary/requests/{id}/process` | `POST` | Moves prescription to `PROCESSING` and locks reserved stock. |
| **Workflow Step 2 (Reserve)** | `/api/dispensary/requests/{id}/items/{itemId}` | `PATCH` | Updates item fulfillment decisions (`AVAILABLE`, `PARTIAL`, `SUBSTITUTE`). |
| **Workflow Step 3 (Ready)** | `/api/dispensary/requests/{id}/ready` | `POST` | Packages medications and marks prescription ready for counter pickup. |
| **Workflow Step 4 (Verify)** | `/api/dispensary/requests/{id}/verify` | `POST` | Validates patient pickup code / OTP at the dispensary counter. |
| **Workflow Step 5 (Dispense)** | `/api/dispensary/requests/{id}/dispense` | `POST` | Deducts stock from inventory and completes the fulfillment lifecycle. |
| **Cancel Request** | `/api/dispensary/requests/{id}/cancel` | `POST` | Cancels request, releases stock reservations, and returns items. |
| **Flag Doctor Reconsult** | `/api/dispensary/requests/{id}/reconsult` | `POST` | Sends clinical clarification note to the prescribing physician. |
| **AI Auto-Resolve** | `/api/dispensary/requests/{id}/ai-resolve` | `POST` | Invokes Gemini AI to resolve unmapped or ambiguous drug formulations. |
| **Stock Management** | `/api/dispensary/inventory` | `POST` / `PATCH` | Adds new batches, updates available quantities and reorder thresholds. |
| **Dispensary Queue** | `/api/dispensary/queue` | `GET` | Fetches live FIFO prescription queue with status filtering. |
| **Catalog Search (Ctrl+K)** | `/api/dispensary/catalog/medicines` | `GET` | Central medicine catalog brand and generic name search. |
| **Dispensary Dashboard** | `/api/dispensary/dashboard` | `GET` | Telemetry stats (pending, processing, ready, dispensed, revenue). |
| **Stock Alerts** | `/api/dispensary/alerts` | `GET` | Live alerts for low-stock and out-of-stock items. |
| **Prescription QR Lookup** | `/api/dispensary/lookup/{code}` | `GET` | Decodes QR/barcode payloads for patient prescription identification. |

---

## ⚙️ Data Layer & Backend Configuration

The application supports both a zero-dependency **Mock Service Worker (MSW)** mode and a direct connection to a **FastAPI** backend.

### 1. Mock Mode (Default)
When `VITE_API_BASE_URL` is omitted or empty, the application automatically boots the MSW Service Worker:
- Serves 12 seeded Indian patient prescriptions and live inventory.
- Emulates realistic network latency (100–300ms).
- Simulates live clinic operations with a mock WebSocket that pushes newly arriving prescriptions every 45s.

### 2. FastAPI Backend Mode
To connect the frontend to the live Python FastAPI backend:
1. Start the FastAPI backend server:
   ```bash
   # From the project root directory
   uvicorn main:app --reload --port 8000
   ```
2. Configure your environment in `better-frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
3. Restart the Vite dev server (`npm run dev`). TanStack Query will route all API calls to the FastAPI endpoints with Zod schema validation.

---

## 🧪 Testing Suite

### Running Frontend Tests (Vitest)
```bash
# Run unit & workflow state machine test suites
npx vitest run
```
- Tests pure reducer transitions across all 5 workflow states.
- Tests reservation guard conditions for unavailable medications.
- Tests pickup verification OTP generation and patient matching.
- Tests Zod domain schema validation.

### Running Backend Tests (Pytest)
```bash
# From project root
python -m pytest tests/
```

---

## ⌨️ Accessibility & Keyboard Shortcuts

- <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd>: Opens the Command Palette search dialog across patients, prescriptions, and medicines.
- <kbd>↑</kbd> / <kbd>↓</kbd>: Navigate through prescription queue items in the left panel.
- <kbd>←</kbd> / <kbd>→</kbd>: Traverse pipeline arc stages (New, Preparing, Ready, Completed).
- <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>: Accessible focus loop through all interactive controls with high-visibility mint focus rings (`focus-visible:ring-2 focus-visible:ring-mint-400`).
- Screen Reader Support: Equipped with an `<AriaLiveRegion />` (`aria-live="polite"`) announcing patient selection, status filter changes, and workflow state updates.

---

## 🎨 Design Tokens & Visual Hierarchy

- **Color Palette**:
  - Forest Greens: `#04120D` (`--bg-0`), `#0A2A20` (`--bg-1`), `#0F3A2C` (`--bg-2`)
  - Mint Glows: `#A7F3D0` (`--mint-300`), `#6EE7B7` (`--mint-400`), `#10B981` (`--emerald-500`)
  - Warm Cream Card: `#F8F0E5` to `#EADFCF`
  - Ink Typography: `#1F2A24` (`--ink`), `#55685E` (`--ink-muted`)
- **Responsive Layout**:
  - Desktop ($\ge 1440\text{px}$): 3-column 3D perspective grid with $3.5^\circ$ / $-3.5^\circ$ panel tilts and apothecary props.
  - Laptop ($1024\text{px} - 1439\text{px}$): Optimized column widths with background props cleanly hidden.
  - Tablet/Mobile ($< 1024\text{px}$): Single-column scrollable stack with sticky bottom workflow sheet and touch-safe tilt removal.

