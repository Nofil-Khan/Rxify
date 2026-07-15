# Rxify — A Complete Codebase Deep Dive

> **Who is this for?**  
> This document is written for a student who already knows basic Python and understands what an API is, but has never looked at a real production FastAPI project before. We'll go file-by-file, function-by-function, and explain *what* the code does, *why* it was written that way, and *what design pattern* is being used. By the end, you should be able to look at any FastAPI codebase and understand how the pieces fit together.

---

## Table of Contents

1. [The Big Picture — What is Rxify?](#1-the-big-picture--what-is-rxify)
2. [The Architecture — Layered Design Pattern](#2-the-architecture--layered-design-pattern)
3. [Project Folder Map](#3-project-folder-map)
4. [Layer 0 — Entry Point: `app/main.py`](#4-layer-0--entry-point-appmainpy)
5. [Layer 0 — AI Brain: `app/gemini.py`](#5-layer-0--ai-brain-appgeminipy)
6. [Layer 0 — Background Jobs: `app/job_store.py`](#6-layer-0--background-jobs-appjob_storepy)
7. [Layer 1 — Core: `core/config.py` and `core/security.py`](#7-layer-1--core-coreconfigpy-and-coresecuritypy)
8. [Layer 2 — Database: `database/user_database.py`](#8-layer-2--database-databaseuser_databasepy)
9. [Layer 3 — Models: `models/schemas.py`](#9-layer-3--models-modelsschemaspy)
10. [Layer 4 — Services (Business Logic)](#10-layer-4--services-business-logic)
    - [`services/prescription_db.py`](#servicesprescription_dbpy)
    - [`services/Medicine.py`](#servicesmedicinepy)
    - [`services/patient_requests.py`](#servicespatient_requestspy)
    - [`services/doctor.py`](#servicesdoctorpy)
    - [`services/share_token.py`](#servicesshare_tokenpy)
11. [Layer 5 — Routers (HTTP Endpoints)](#11-layer-5--routers-http-endpoints)
    - [`routers/auth.py`](#routersauthpy)
    - [`routers/upload.py`](#routersuploadpy)
    - [`routers/Medicine_info.py`](#routersmedicine_infopy)
    - [`routers/doctor.py`](#routersdoctorpy)
    - [`routers/patient_requests.py`](#routerspatient_requestspy)
    - [`routers/share_token.py`](#routersshare_tokenpy)
12. [How It All Connects — A Full Request Journey](#12-how-it-all-connects--a-full-request-journey)
13. [Design Patterns Summarized](#13-design-patterns-summarized)
14. [The Database Schema in Plain English](#14-the-database-schema-in-plain-english)
15. [Security Model Explained](#15-security-model-explained)

---

## 1. The Big Picture — What is Rxify?

Rxify is a backend API for a **prescription management system** built with FastAPI. Here's the product in one paragraph:

> A **patient** takes a photo of their paper prescription, uploads it through the app, and the backend sends it to **Google Gemini Vision AI** which reads the text and extracts structured data (medicine names, dosages, follow-up dates, etc.). That data gets saved to a database. The patient can then share their prescription history with a **doctor** by sending a connection request. The doctor accepts and can then view all of that patient's prescriptions from their dashboard. Patients can also generate a shareable link (a "share token") that lets *anyone* — family, a new specialist — view their records without needing an account.

That's the whole product. Everything in the code serves one of those goals.

---

## 2. The Architecture — Layered Design Pattern

This is the most important concept to understand before reading any code. Rxify uses a **Layered Architecture**, also called a **Three-Tier Architecture** or the **Router → Service → Database** pattern.

Think of it like a restaurant:

```
┌──────────────────────────────────────────────────────┐
│  ROUTER (Waiter)                                      │
│  Takes the customer's order. Validates it.            │
│  Passes it to the kitchen. Returns the food.          │
├──────────────────────────────────────────────────────┤
│  SERVICE (Chef)                                       │
│  Knows the recipes. Applies business logic.           │
│  Decides what to cook and how.                        │
├──────────────────────────────────────────────────────┤
│  DATABASE (Pantry)                                    │
│  Stores the raw ingredients. Just holds data.         │
│  Doesn't know anything about recipes or customers.    │
└──────────────────────────────────────────────────────┘
```

**Why this pattern?**

1. **Separation of Concerns**: Each layer has ONE job. The router doesn't write SQL. The database function doesn't know about HTTP status codes.
2. **Testability**: You can test the service layer without running a web server. You can test the router without a real database by swapping in a mock service.
3. **Maintainability**: If you ever switch from SQLite to PostgreSQL, you only change the database layer. The routers and services don't care.
4. **Readability**: A new developer can open `routers/doctor.py`, see a list of endpoints, and immediately understand what the API can do — without reading a single SQL query.

This is the pattern used by almost every professional Python backend you will ever encounter.

---

## 3. Project Folder Map

```
rxify/
│
├── app/               ← Entry point, AI wrapper, background job store
│   ├── main.py        ← FastAPI app creation, middleware, router registration
│   ├── gemini.py      ← Google Gemini Vision AI wrapper
│   └── job_store.py   ← Thread-safe in-memory job tracker
│
├── core/              ← Cross-cutting infrastructure (config, auth)
│   ├── config.py      ← Environment variable loader
│   └── security.py    ← JWT creation & validation, role-based access
│
├── database/          ← Database connection & migrations
│   └── user_database.py ← SQLite helpers, schema creation, user CRUD
│
├── models/            ← Pydantic request/response schemas
│   └── schemas.py     ← Input validation models (what the API accepts)
│
├── routers/           ← HTTP route handlers (the "what" of the API)
│   ├── auth.py        ← /api/register, /api/login
│   ├── upload.py      ← /api/upload, /api/job/{job_id}
│   ├── Medicine_info.py ← /api/medicine_info/p/{id}
│   ├── doctor.py      ← /api/doctor/* (all doctor endpoints)
│   ├── patient_requests.py ← /api/patient/* (patient-side)
│   └── share_token.py ← /api/patient/share-tokens, /api/share/{token}/*
│
├── services/          ← Business logic & database queries (the "how")
│   ├── prescription_db.py ← INSERT prescription + medications
│   ├── Medicine.py    ← Parse medication schedule, fetch medicine info
│   ├── patient_requests.py ← Doctor lookup, send request, view request status
│   ├── doctor.py      ← Doctor dashboard queries, respond to requests
│   └── share_token.py ← Token generation, validation, revocation
│
├── data/uploads/      ← Uploaded prescription images (git-ignored)
├── frontend/          ← Single HTML file frontend
│   └── index.html
└── requirements.txt   ← Python dependencies
```

---

## 4. Layer 0 — Entry Point: `app/main.py`

**File path:** `app/main.py`  
**Role:** The front door of the entire application.

```python
app = FastAPI(
    title="Rxify API",
    description="Prescription OCR backend with patient and doctor roles.",
    version="0.3.0",
)
```

### `FastAPI()` — Creating the Application Instance

This one line creates the entire web server object. Think of it like saying "I want to build a restaurant". The `title`, `description`, and `version` are metadata that appear in the automatically generated documentation at `/docs`. This is called **OpenAPI** (or Swagger) documentation and FastAPI generates it for free.

> **Why FastAPI?** FastAPI is a modern Python web framework built on top of Starlette (a high-performance async framework). It auto-generates API documentation, validates request data using Pydantic, and supports async/await natively for high performance.

---

### `run_migrations()` — Database Setup at Startup

```python
run_migrations()
```

This is called **before** any request is ever handled. It runs on the line right after the `app` is created. Why? Because if the database tables don't exist yet, every single endpoint would crash.

The design choice here is **idempotent migrations** — the function creates tables only if they don't exist (`CREATE TABLE IF NOT EXISTS`). This means you can call it a hundred times and it will only do work on the very first run. Safe, always.

> **Student Note:** `idempotent` is a fancy word meaning "running it multiple times has the same effect as running it once". A light switch is NOT idempotent — pressing it 5 times changes state. But pressing a button that turns a light ON is idempotent — it doesn't matter if you press it 3 times, the light is already on.

---

### `app.add_middleware(CORSMiddleware, ...)` — Cross-Origin Resource Sharing

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**What is CORS?** Imagine your backend runs at `localhost:8000` and your frontend at `localhost:3000`. When the browser tries to make a request from port 3000 to port 8000, it blocks it by default because they're different "origins". This is a security feature called the Same-Origin Policy.

CORS middleware tells the browser "I trust requests from these specific origins, let them through". Without this, the frontend JavaScript would get a network error every time it tried to call the API.

> **Why these specific ports?** Ports 3000 and 3001 are the defaults for React and other common frontend dev servers. In production you'd replace these with your real domain names.

---

### `app.include_router(...)` — Plugging In Feature Modules

```python
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(Medicine_info.router)
app.include_router(doctor.router)
app.include_router(patient_requests.router)
app.include_router(share_token.router)
```

Each feature of the API lives in its own file (called a **router**). `include_router` is like saying "plug this module into the main application". This is the **Modular Router Pattern** — instead of having one enormous file with every single endpoint, you split them by feature.

> **Think of it as:** A power strip. The `FastAPI` app is the wall socket. Each router is a separate device you plug in. You can add or remove devices without touching the wall socket.

---

### `serve_index()` and `health_check()` — Utility Endpoints

```python
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return FileResponse(index_path)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Rxify API", "version": "0.3.0"}
```

**`serve_index()`**: When someone visits the root URL (`/`), instead of returning a JSON error, it serves the frontend's `index.html` file. This is called a **Single Page Application (SPA) pattern** — the backend serves the frontend code, and all subsequent interactions happen via the API.

`Path(__file__).parent.parent / "frontend" / "index.html"` is worth explaining:
- `__file__` is the current file: `.../app/main.py`
- `.parent` goes up one level: `.../app/`
- `.parent` again goes up one more level: `.../` (project root)
- `/ "frontend" / "index.html"` appends to the path: `.../frontend/index.html`

**`health_check()`**: A health check endpoint is a standard practice. Load balancers, Docker orchestrators (like Kubernetes), and monitoring tools ping `/api/health` to know if the service is alive. If this returns 200 OK, the service is running. `include_in_schema=False` on `serve_index` means it's hidden from the generated API docs because it's not a real API endpoint.

---

## 5. Layer 0 — AI Brain: `app/gemini.py`

**File path:** `app/gemini.py`  
**Role:** A self-contained wrapper around the Google Gemini Vision API. All AI logic lives here and nowhere else.

This file follows the **Facade Pattern** — it hides the complexity of the Gemini SDK behind one clean function: `extract_prescription_data(image_bytes)`. The rest of the codebase doesn't know or care that Gemini is being used. You could swap it for OpenAI's vision API tomorrow and only this file would change.

---

### Module-level Constants

```python
API_ENV_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY")
DEFAULT_MODEL = "gemini-3-flash-preview"
```

Two environment variable names are accepted. This is a **fallback pattern** — if the user named their key `GEMINI_API_KEY` OR `GOOGLE_API_KEY`, the code works either way. Flexible and user-friendly.

`DEFAULT_MODEL` is defined as a constant at the top rather than being hardcoded inside the function. This is a best practice: **named constants over magic strings**. If you need to upgrade the model, you change one line at the top, not hunt through functions.

---

### `EXTRACTION_PROMPT` — The AI Instruction Manual

```python
EXTRACTION_PROMPT = """
You are a medical prescription OCR system. Extract all data from this prescription image.
AND DO IT FAST

Return ONLY a valid JSON object (no markdown, no explanation) with these fields:
{
  "doctor_name": "string or null",
  ...
}
"""
```

This is the **prompt engineering** for the AI. A few things to notice:

1. **Strict output format**: The prompt says "Return ONLY a valid JSON object (no markdown, no explanation)". This is crucial because code is going to parse the AI's output. If the AI wraps it in ```json...``` markdown code blocks or adds explanation text, the JSON parser breaks. The prompt tells the AI not to do that.

2. **Field specification**: Every field is listed explicitly so the AI knows exactly what structure to produce. This makes the output predictable.

3. **Null handling**: "If a field is not present in the image, set it to null." This means the returned dict always has the same shape — all keys are always present, just maybe null. This is much easier to work with than a dict that sometimes has missing keys.

4. **`raw_text` field**: Even after extracting structured data, the raw OCR text is preserved. This is a **defensive design** — if the AI misses something during extraction, the raw text is a fallback for future re-processing.

---

### `_get_api_key()` — Environment Key Resolver

```python
def _get_api_key() -> str:
    for name in API_ENV_VARS:
        val = os.getenv(name)
        if val:
            return val
    raise EnvironmentError(f"No API key found. Set one of: {', '.join(API_ENV_VARS)}")
```

**What it does**: Loops through the list of accepted environment variable names and returns the first one that has a value. If none are set, it raises a descriptive error message (not a cryptic `None` or `KeyError`).

**Why the underscore prefix (`_get_api_key`)**: In Python, a leading underscore is a convention meaning "this is a private helper — it's not part of the public API of this module". Outside code shouldn't call it directly. This is part of the **Information Hiding Principle**.

---

### `_parse_json_from_response(text)` — Cleaning AI Output

```python
def _parse_json_from_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)
```

Even though the prompt says "no markdown", AI models sometimes add it anyway. This function defensively strips markdown code fence markers (the triple backticks ` ``` ` or ` ```json `) before parsing.

The regex `r"^```(?:json)?\s*"` means:
- `^` — at the start of the string
- ` ``` ` — literal three backticks
- `(?:json)?` — optionally followed by the word "json" (non-capturing group)
- `\s*` — any trailing whitespace

This is **defensive programming** — assuming the AI might not perfectly follow instructions and handling it gracefully.

---

### `extract_prescription_data(image_bytes, mime_type, model)` — The Main Function

```python
def extract_prescription_data(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    model: str | None = None,
) -> Dict[str, Any]:
```

This is the function that the rest of the codebase calls. It takes raw image bytes and returns a Python dictionary. Here's what happens inside:

**Step 1: Import the SDK lazily**
```python
try:
    from google import genai
    from google.genai import types
except ImportError:
    raise ImportError("Run: pip install google-genai")
```

The import is inside the function rather than at the top of the file. This is called a **lazy import**. Why? If `google-genai` is not installed, you get a clear error message only when you try to use it — not when the app starts up. This makes the app boot successfully even if an optional dependency is missing.

**Step 2: Build the request**
```python
image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

response = client.models.generate_content(
    model=model_name,
    contents=[image_part, EXTRACTION_PROMPT],
    config=types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=65536,
        response_mime_type="application/json",
    ),
)
```

- `temperature=0.1`: Temperature controls how "creative" the AI is. 0 = perfectly deterministic, 1 = very random. For OCR (which has a correct answer), you want it as close to 0 as possible — no creativity needed.
- `max_output_tokens=65536`: A large limit because some prescriptions have many medications and the JSON could get long.
- `response_mime_type="application/json"`: Tells Gemini to format its response specifically as JSON. This is a newer API feature that reduces the chances of the AI adding markdown.

**Step 3: Parse, with fallback**
```python
try:
    return _parse_json_from_response(raw_text)
except json.JSONDecodeError as exc:
    salvaged = _salvage_partial_json(raw_text)
    if salvaged:
        salvaged["parse_warning"] = "Response was truncated; some fields may be missing"
        return salvaged
    return {
        "parse_error": str(exc),
        "raw_text": raw_text,
        "doctor_name": None,
        "patient_name": None,
        "medications": [],
    }
```

Three levels of fallback:
1. Try to parse the response normally.
2. If that fails (JSON was truncated/broken), try to salvage a partial JSON.
3. If that also fails, return a minimal dict with the raw text preserved and an error field.

The system **never crashes** due to a bad AI response. This is called **Graceful Degradation**.

---

### `_salvage_partial_json(text)` — The Recovery Algorithm

```python
def _salvage_partial_json(text: str) -> Dict[str, Any] | None:
    for trim in range(len(text), 0, -1):
        candidate = text[:trim]
        for suffix in ['"}}\n', '"}\n', ']\n}', '\n}', '}']:
            try:
                return json.loads(candidate + suffix)
            except json.JSONDecodeError:
                continue
    return None
```

This is a clever brute-force recovery. If the JSON was cut off mid-way (for example, the AI hit the token limit and stopped in the middle of outputting), this function:

1. Takes the text character by character from the end, trimming it
2. For each length, tries appending various "closing" suffixes to make it valid JSON
3. Returns the first successful parse

It's like having a broken puzzle and trying every possible "last piece" to see which one makes the puzzle complete.

> **Why does this exist?** Even with `max_output_tokens=65536`, extremely long prescriptions could theoretically be cut off. Rather than returning an empty error, this function tries to salvage *at least the fields it did manage to extract*.

---

## 6. Layer 0 — Background Jobs: `app/job_store.py`

**File path:** `app/job_store.py`  
**Role:** A thread-safe, in-memory tracking system for OCR jobs that are running in the background.

**The problem it solves:** OCR is slow (a few seconds). You don't want the user to wait while the HTTP request hangs open. Instead:
1. The upload endpoint returns **immediately** with a `job_id`
2. The OCR runs in the background
3. The frontend polls `/api/job/{job_id}` to check if it's done

The `job_store` module tracks the state of each job.

---

### Module-level State

```python
_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}
_TTL_SECONDS = 3600  # 1 hour
```

- `_lock`: A **mutex** (mutual exclusion lock). When multiple threads try to read and write the same dictionary at the same time, you can get data corruption. The lock ensures only one thread can access `_jobs` at a time.
- `_jobs`: The actual in-memory store. It's a dictionary mapping `job_id → job_data`.
- `_TTL_SECONDS`: Jobs don't live forever. After 1 hour, completed jobs are evicted to prevent memory leaks.

The underscore prefix on all three names signals that **these are private module internals** — outside code should never touch them directly, only through the functions below.

---

### `create(job_id, image_path)` — Registering a New Job

```python
def create(job_id: str, image_path: str) -> None:
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "processing",
            "image_path": image_path,
            "created_at": time.time(),
            "extracted": None,
            "error": None,
            "prescription_id": None,
        }
```

`with _lock:` — This is a **context manager** for the threading lock. Python's `with` statement ensures that the lock is always released, even if an exception occurs. Without `with`, you'd have to manually call `_lock.acquire()` and `_lock.release()`, and forgetting to release would cause a **deadlock** (the program freezes forever).

The initial status is `"processing"`. The job object has all fields pre-filled with `None` so the shape is consistent from the moment of creation.

---

### `set_done(job_id, extracted, prescription_id)` — Marking Success

```python
def set_done(job_id: str, extracted: dict, prescription_id: Optional[int] = None) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["extracted"] = extracted
            _jobs[job_id]["prescription_id"] = prescription_id
```

Called by the background worker after Gemini successfully extracts data. Stores the full extracted dict so the frontend can display it.

---

### `set_error(job_id, error)` — Marking Failure

```python
def set_error(job_id: str, error: str) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = error
```

Called when the OCR or database insert fails. The frontend can check `status == "error"` and show the user an error message.

---

### `get(job_id)` — Fetching Job Status

```python
def get(job_id: str) -> Optional[Dict[str, Any]]:
    _evict_old_jobs()
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
```

Two things to notice:
1. **`_evict_old_jobs()` is called first** — every time someone reads a job, old jobs are cleaned up. This is called **lazy eviction** — you don't run a background cleanup timer, you clean up on read. Simple and effective for low-traffic use cases.
2. **`dict(job)` returns a copy** — not the original dict. This prevents outside code from accidentally modifying the job store directly. It's a **defensive copy**.

---

### `_evict_old_jobs()` — Memory Leak Prevention

```python
def _evict_old_jobs() -> None:
    cutoff = time.time() - _TTL_SECONDS
    with _lock:
        to_delete = [
            jid for jid, job in _jobs.items()
            if job["status"] != "processing" and job["created_at"] < cutoff
        ]
        for jid in to_delete:
            del _jobs[jid]
```

Finds all jobs that are:
- NOT still processing (already done or errored), AND
- Older than 1 hour

And deletes them. Active jobs are never evicted — even if they've been running for over an hour (which would indicate a bug, but better safe than sorry).

> **Why collect into `to_delete` first?** You can't safely delete from a dictionary while iterating over it in Python — it raises a `RuntimeError`. So the code collects the keys to delete into a separate list, then deletes them in a second loop.

---

## 7. Layer 1 — Core: `core/config.py` and `core/security.py`

The `core/` directory holds **cross-cutting concerns** — code that's used by multiple layers. It's not a router, not a service, not a database function. It's infrastructure.

---

### `core/config.py` — Loading Environment Variables

```python
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
```

**What is `load_dotenv()`?** It reads a `.env` file (if it exists) and loads its key-value pairs into environment variables. This way, sensitive values like `SECRET_KEY` and `GEMINI_API_KEY` are never hardcoded in the source code. They live in a `.env` file that's listed in `.gitignore` and never committed to version control.

**Why a separate config file?** Instead of calling `os.getenv("SECRET_KEY")` in every file that needs it, you import from `core.config`. One source of truth. Change the variable name once, update one file.

**`ALGORITHM: str = "HS256"`** — HS256 stands for HMAC-SHA256, a symmetric signing algorithm for JWTs. We'll see this used in `security.py`.

---

### `core/security.py` — The Gatekeeper

This file is the **authentication and authorization heart** of the application. It has three functions that do very different things:

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")
```

This line creates a **security scheme object** that FastAPI uses to:
1. Tell the Swagger docs "this API uses Bearer token auth"
2. Automatically extract the `Authorization: Bearer <token>` header from incoming requests when used as a `Depends()`

---

### `create_access_token(data)` — Creating a JWT

```python
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

**What is a JWT?** A JSON Web Token is a signed string that contains data (called "claims"). It looks like three base64-encoded parts separated by dots: `xxxxx.yyyyy.zzzzz`.

- Part 1 (header): Algorithm info
- Part 2 (payload): The data — username, role, expiry time
- Part 3 (signature): A cryptographic signature that proves the token hasn't been tampered with

When a user logs in, the server creates a JWT with their username and role embedded inside it, signs it with the `SECRET_KEY`, and sends it to the client. The client sends this token on every subsequent request. The server can verify it's genuine without a database lookup.

**`data.copy()`** — Always copy the dict before modifying it, because `to_encode.update({"exp": expire})` would modify the caller's original dict if we didn't copy. This is a subtle but important bug prevention habit.

**`datetime.now(timezone.utc)`** — Always use UTC for server-side timestamps. Never local time. If your server is in New York and a user is in Tokyo, local time is ambiguous. UTC is universal.

---

### `get_current_user(token)` — Verifying Who Is Making the Request

```python
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = user_database.get_user(username)
    if user is None:
        raise credentials_exception
    return user
```

**`Depends(oauth2_scheme)`** — This is FastAPI's **Dependency Injection** system. When you put `Depends(something)` in a function parameter, FastAPI automatically calls that `something` before calling your function and passes the result as the parameter value. `oauth2_scheme` automatically extracts the Bearer token from the HTTP header.

**Steps inside the function:**
1. Decode the JWT using the secret key. If the token is expired, invalid, or was signed with a different key, `jwt.decode` raises `InvalidTokenError`.
2. Extract the username from the payload's `"sub"` (subject) claim.
3. Look up the user in the database to make sure they still exist (they could have been deleted after the token was issued).
4. Return the full user dict.

**Why do both JWT validation AND a database lookup?** Because a JWT proves the *token* is genuine, but not that the *user* still exists. If an admin deletes an account, that user's JWT is still cryptographically valid. The database lookup is the final authority.

---

### `require_role(*roles)` — Role-Based Access Control (RBAC)

```python
def require_role(*roles: str) -> Callable:
    def _checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(roles)}. Your role: {current_user['role']}.",
            )
        return current_user
    return _checker
```

This is a **Dependency Factory** — a function that creates and returns another function. It's also called a **Higher-Order Function** or a **Closure**.

**Usage example:**
```python
@router.get("/doctor-only")
def some_endpoint(current_user: dict = Depends(require_role("doctor"))):
    ...
```

When FastAPI processes this endpoint:
1. It calls `require_role("doctor")` which returns the `_checker` function.
2. `_checker` has `Depends(get_current_user)` so FastAPI also calls `get_current_user` first.
3. `_checker` verifies the user's role and either raises 403 or returns the user.

**Why the factory pattern over a simpler approach?** Because you might want `require_role("doctor")` on one endpoint and `require_role("patient")` on another. The factory creates a separate, customized checker for each call. You can't do this with a regular dependency function.

**401 vs 403:**
- `401 Unauthorized`: "I don't know who you are." (No/invalid token)
- `403 Forbidden`: "I know who you are, but you're not allowed here." (Wrong role)

---

## 8. Layer 2 — Database: `database/user_database.py`

**File path:** `database/user_database.py`  
**Role:** The lowest layer of the stack. Handles the SQLite database connection lifecycle, schema migrations, and user CRUD.

---

### `get_db_path()` — Finding the Database File

```python
def get_db_path() -> Path:
    return Path(__file__).parent / "prescriptions.db"
```

Returns the path to the SQLite file, which lives in the same directory as this Python file (`database/prescriptions.db`). Using `Path(__file__).parent` makes it work regardless of which directory you run the app from.

---

### `db_connection(row_factory)` — The Database Context Manager

```python
@contextmanager
def db_connection(row_factory: bool = False) -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(get_db_path())
    if row_factory:
        conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()
```

This is the most important function in the database module, even though it's small. Let's break it down:

**`@contextmanager`** — A decorator that turns a generator function into a context manager. This means you can use it with `with`:
```python
with db_connection() as conn:
    # use conn here
```

**`conn.row_factory = sqlite3.Row`** — By default, SQLite returns rows as tuples: `(1, "alice", "doctor")`. With `sqlite3.Row`, you can access columns by name: `row["username"]`. This makes the code much more readable and less fragile (tuple index access breaks if you reorder columns).

**`with conn:`** — SQLite's connection object itself supports the context manager protocol. When the inner `with conn:` block exits successfully, it **commits** the transaction. If an exception occurs, it **rolls back**. This is **ACID transaction management** — either all SQL changes in the block happen, or none of them do.

**`finally: conn.close()`** — The connection is ALWAYS closed, even if an exception occurred. Without this, you'd leak database connections.

> **Why not just use `sqlite3.connect()` directly everywhere?** Because then every function that needs a DB connection would need to copy-paste the error handling, commit/rollback logic, and `conn.close()`. The context manager is a **Don't Repeat Yourself (DRY)** solution.

---

### `run_migrations()` — Creating the Database Schema

```python
def run_migrations() -> None:
    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'patient',
                display_name  TEXT,
                specialty     TEXT
            )
        """)
        # ... more table creations and column additions
```

This function creates all 4 database tables (users, doctor_patient_assignments, patient_doctor_requests, patient_share_tokens) and also handles the case where the `users` table already exists but is missing newer columns.

**`CREATE TABLE IF NOT EXISTS`** — Idempotent. Safe to run multiple times.

**The column check pattern:**
```python
cursor.execute("PRAGMA table_info(users)")
columns = [col[1] for col in cursor.fetchall()]

if "role" not in columns:
    cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'patient'")
```

`PRAGMA table_info(users)` is a SQLite-specific command that returns metadata about all columns in a table. We extract just the column names (index `[1]` in each row). If a column doesn't exist yet, we add it with `ALTER TABLE`. This allows the schema to **evolve over time** without breaking existing data.

> **Why is this important?** Imagine you deployed Rxify six months ago and there are already 500 users in the database. You just added a `specialty` column for doctors. If you dropped and recreated the table, you'd lose all 500 users. Migrations add the column *to the existing table*, preserving all data.

The deprecated wrapper functions at the bottom (`migrate_add_role_column`, etc.) are kept for backward compatibility — old code that calls them still works, but they just delegate to `run_migrations()`.

---

### `verify_password(plain_password, hashed_password)` — Checking a Password

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )
```

**bcrypt** is a password hashing algorithm specifically designed to be slow. That sounds bad, but it's intentional. If an attacker steals your database, they have to try every possible password (a "brute force" attack). bcrypt being slow means instead of trying 10 billion passwords per second, they can try maybe 1,000 per second. That's the point.

`bcrypt.checkpw` hashes the input password with the same salt that's embedded in `hashed_password` and compares. You never store the plain password — only the hash.

---

### `get_password_hash(password)` — Hashing a Password

```python
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
```

`bcrypt.gensalt()` generates a **random salt** — a random string added to the password before hashing. This ensures that two users with the same password have different hashes. Without salts, an attacker could use a **rainbow table** (a pre-computed list of common password hashes) to crack passwords instantly.

---

### `get_user(username)` — Fetching a User by Username

```python
def get_user(username: str) -> dict | None:
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, username, password_hash, role, display_name, specialty FROM users WHERE username = ?",
                (username,),
            )
            row = cursor.fetchone()
            if row:
                return {"id": row[0], "username": row[1], ...}
    except Exception as e:
        print(f"[DB] Error fetching user: {e}")
    return None
```

**Parameterized query `WHERE username = ?`** — The `?` is a placeholder. The actual value is passed separately as `(username,)`. This is critical: it prevents **SQL injection** attacks. Never ever format user input directly into a SQL string.

> **SQL Injection Example (NEVER DO THIS):**
> ```python
> cursor.execute(f"SELECT * FROM users WHERE username = '{username}'")
> ```
> If `username = "'; DROP TABLE users; --"`, the resulting SQL is:
> ```sql
> SELECT * FROM users WHERE username = ''; DROP TABLE users; --'
> ```
> The table gets deleted. With parameterized queries (`?`), the value is *never* interpreted as SQL.

Returns a dictionary or `None` if not found. The outer `try/except` ensures a database error doesn't crash the whole application — it logs the error and returns `None`.

---

### `get_user_by_id(user_id)` — Fetching a User by Numeric ID

Same as `get_user` but searches by `id` instead of `username`. This is used when we have a user's ID (from a foreign key in another table) and need their full profile.

---

### `create_user(username, password, role)` — Creating a New Account

```python
def create_user(username: str, password: str, role: str = "patient") -> dict | None:
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {VALID_ROLES}")

    if get_user(username):
        return None  # username already taken

    password_hash = get_password_hash(password)
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )
        return {"username": username, "role": role}
```

**Guard clauses** — The function starts with two checks that return early if something is wrong:
1. Invalid role → raise an error immediately
2. Username taken → return None

This is the **Fail Fast** principle. Don't proceed to complex logic if basic preconditions aren't met.

The password is **always hashed before being stored**. The plain password never touches the database.

---

## 9. Layer 3 — Models: `models/schemas.py`

**File path:** `models/schemas.py`  
**Role:** Defines the shape of data that the API accepts from clients. Uses **Pydantic** for automatic validation.

Pydantic models are Python classes that describe the structure of data. FastAPI uses them to automatically:
1. **Parse** JSON request bodies
2. **Validate** that required fields are present and have the right types
3. **Return** a helpful error if validation fails (a `422 Unprocessable Entity` response)

---

### `UserRegister` — Registration Request

```python
class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "patient"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in {"patient", "doctor"}:
            raise ValueError("role must be 'patient' or 'doctor'")
        return v
```

**`BaseModel`** — All Pydantic models extend this. It gives you automatic JSON parsing, type validation, and serialization.

**`role: str = "patient"`** — The field has a **default value**. If the client doesn't send a `role` field, it defaults to `"patient"`.

**`@field_validator("role")`** — A custom validation method. After the type check (`str`) passes, this method is called to apply business logic. If the role is not "patient" or "doctor", it raises a `ValueError`, which Pydantic catches and turns into a 422 response.

> **Why validate in the model AND in the database layer?** Defense in depth. The model validation is the first line of defense — it catches bad input before it even reaches the business logic. The database layer has a second check (`if role not in VALID_ROLES`) as a safety net in case someone calls the database function directly from somewhere else.

---

### `DoctorProfileUpdate` — Optional Profile Fields

```python
class DoctorProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    specialty: Optional[str] = None
```

Both fields are optional (`Optional[str]` means it can be a string or `None`). The client can update just the display name, just the specialty, or both. The service layer handles the partial update.

---

### `RequestDoctorAssignment` — Patient Sends a Request

```python
class RequestDoctorAssignment(BaseModel):
    doctor_id: int
```

Just one field — the ID of the doctor the patient wants to connect with.

---

### `RespondToRequest` — Doctor Accepts or Rejects

```python
class RespondToRequest(BaseModel):
    accept: bool
```

One boolean field. Simple and clear.

---

### `CreateShareToken` — Generating a Share Link

```python
class CreateShareToken(BaseModel):
    label: Optional[str] = None
    expires_in_days: Optional[int] = 7  # None = never expires
```

`expires_in_days` defaults to 7 (one week). If the client sends `null`, the token never expires.

---

## 10. Layer 4 — Services (Business Logic)

Services are where the actual work happens. They contain SQL queries, data transformations, and business rules. They know nothing about HTTP — no `Request`, no `Response`, no status codes. This makes them easy to test in isolation.

---

### `services/prescription_db.py`

**Role:** Persisting a prescription to the database after OCR extraction.

#### `insert_prescription(extracted, user_id)` — Saving OCR Results

```python
def insert_prescription(extracted: Dict[str, Any], user_id: int) -> int:
    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO prescriptions (
                user_id, doctor_name, clinic_name, ...
            ) VALUES (?, ?, ?, ...)""",
            (user_id, extracted.get("doctor_name"), ...)
        )
        prescription_id = cursor.lastrowid

        for med in extracted.get("medications", []):
            cursor.execute(
                """INSERT INTO prescription_medications (
                    prescription_id, date, name, dosage, ...
                ) VALUES (?, ?, ?, ...)""",
                (prescription_id, ...)
            )

        return prescription_id
```

This function performs a **two-step insert** in a single database transaction:
1. Insert the prescription header (patient info, doctor info, dates, diagnosis)
2. For each medication in the list, insert a row in `prescription_medications`

**`cursor.lastrowid`** — After an INSERT, this gives you the auto-generated ID of the newly inserted row. You need it to link the medications back to their parent prescription.

**`extracted.get("medications", [])`** — If the OCR result has no `medications` key (shouldn't happen, but defensive coding), this returns an empty list rather than crashing.

**Why two tables?** This is called **database normalization**. A prescription can have multiple medications, and each medication can have different attributes. Storing medications as a JSON blob in the prescription table would make it impossible to query "show me all patients taking Metformin". With a separate table, you can query efficiently.

---

### `services/Medicine.py`

**Role:** Parsing medication frequency strings and fetching a prescription's medication list.

#### `parse_frequency(freq)` — Understanding Medical Abbreviations

```python
def parse_frequency(freq: str) -> List[str]:
    if not freq:
        return []

    freq = freq.strip().upper()

    # Handle dash-separated patterns (e.g. 1-0-1)
    if "-" in freq:
        parts = freq.split("-")
        times = ["Morning", "Afternoon", "Night"]
        return [times[i] for i, v in enumerate(parts) if v.strip() in ("1", "2")]

    mapping = {
        "OD": ["Morning"],
        "BD": ["Morning", "Night"],
        "TDS": ["Morning", "Afternoon", "Night"],
        "QID": ["Morning", "Afternoon", "Evening", "Night"],
        "HS": ["Night"],
        "SOS": ["As needed"],
    }

    return mapping.get(freq, ["Check with doctor"])
```

This function bridges the gap between **medical jargon** and **plain English** for the patient-facing UI.

- `"1-0-1"` means Morning (1), Skip Afternoon (0), Night (1) → `["Morning", "Night"]`
- `"BD"` means Bis Die (Latin for "twice daily") → `["Morning", "Night"]`
- `"TDS"` means Ter Die Sumendum (Latin for "three times daily") → `["Morning", "Afternoon", "Night"]`

**`freq.strip().upper()`** — Always normalize the string before comparing. OCR might extract "bd", "BD", " BD ", or "Bd". Stripping whitespace and uppercasing handles all variations.

**`mapping.get(freq, ["Check with doctor"])`** — Returns a default value if the abbreviation isn't in the mapping. "Check with doctor" is better than returning `None` or crashing.

#### `get_medicine_info(prescription_id, user_id)` — Fetching Medicines with Ownership Check

```python
def get_medicine_info(prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT pm.name, pm.dosage, pm.frequency, pm.duration, pm.date
            FROM prescription_medications pm
            JOIN prescriptions p ON pm.prescription_id = p.id
            WHERE pm.prescription_id = ? AND p.user_id = ?
            """,
            (prescription_id, user_id),
        )
```

The SQL query joins `prescription_medications` with `prescriptions` and filters by **both** `prescription_id` AND `user_id`. This is an **authorization-through-query** pattern: a patient can only ever see medicines from their own prescriptions. Even if a patient guesses someone else's `prescription_id`, the `AND p.user_id = ?` clause ensures they get an empty result, not an error — no information leaks about whether that prescription even exists.

The result enriches each medication with a `schedule` field by calling `parse_frequency()`:
```python
return [
    {
        "name": row[0],
        "frequency": row[2],
        "schedule": parse_frequency(row[2]),  # ["Morning", "Night"]
        ...
    }
    for row in rows
]
```

---

### `services/patient_requests.py`

**Role:** All database logic for the patient-side of the doctor connection workflow.

#### `lookup_doctor(doctor_id)` — Is This Person Actually a Doctor?

```python
def lookup_doctor(doctor_id: int) -> Optional[Dict[str, Any]]:
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, display_name, specialty FROM users WHERE id = ? AND role = 'doctor'",
            (doctor_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
```

Critically, the query includes `AND role = 'doctor'`. A patient can't look up another patient by their ID and mistakenly send a "connection request" to them. The role filter ensures only doctor accounts are returned.

---

#### `send_request(patient_id, doctor_id)` — State Machine Logic

This is the most complex function in this file because it handles multiple possible states:

```python
def send_request(patient_id: int, doctor_id: int) -> Dict[str, Any]:
    # 1. Confirm the target is a doctor
    # 2. Check if already actively connected
    # 3. Check for existing request rows
    #    a. If pending → error "already pending"
    #    b. If accepted → error "already accepted"
    #    c. If rejected → UPDATE to 'pending' (re-request allowed)
    # 4. No existing row → INSERT new request
```

This is a **State Machine pattern**. The `patient_doctor_requests` table records can be in state `pending`, `accepted`, or `rejected`. The `send_request` function handles all possible transitions:
- `None → pending`: Normal first request (INSERT)
- `rejected → pending`: Patient is allowed to re-apply after rejection (UPDATE)
- `pending → pending`: Blocked (error)
- `accepted → accepted`: Blocked (error)

Returning `{"success": bool, "message": str}` instead of raising exceptions lets the router decide how to present the result to the client.

---

#### `get_my_requests(patient_id)` — Viewing All Sent Requests

```python
cursor.execute("""
    SELECT
        r.id, r.doctor_id, r.requested_at, r.status,
        u.username      AS doctor_username,
        u.display_name  AS doctor_display_name,
        u.specialty     AS doctor_specialty
    FROM patient_doctor_requests r
    JOIN users u ON u.id = r.doctor_id
    WHERE r.patient_id = ?
    ORDER BY r.requested_at DESC
""", (patient_id,))
```

A SQL JOIN that pulls in the doctor's profile details alongside the request record. Instead of making the frontend do a second request for each doctor's info, the query returns everything in one shot. This is **N+1 Query Problem avoidance** — a common performance anti-pattern.

---

#### `get_my_assigned_doctor(patient_id)` — Who Is My Doctor?

```python
cursor.execute("""
    SELECT u.id, u.username, u.display_name, u.specialty, dpa.assigned_at
    FROM doctor_patient_assignments dpa
    JOIN users u ON u.id = dpa.doctor_id
    WHERE dpa.patient_id = ? AND dpa.status = 'active'
    ORDER BY dpa.assigned_at DESC
    LIMIT 1
""", (patient_id,))
```

`LIMIT 1` — Returns at most one doctor. The business rule (currently) is one active doctor per patient. `ORDER BY dpa.assigned_at DESC` gets the most recent one in case of data anomalies.

---

### `services/doctor.py`

**Role:** All database queries for the doctor's dashboard. The golden rule of this service: **every single query is scoped to the doctor's assigned patients only**.

#### `get_my_prescriptions(doctor_id, search, limit, offset)` — Paginated Prescription List

```python
query = """
    SELECT p.id, p.patient_name, ..., u.username AS uploaded_by
    FROM prescriptions p
    JOIN users u ON p.user_id = u.id
    JOIN doctor_patient_assignments dpa
        ON dpa.patient_id = u.id
       AND dpa.doctor_id  = ?
       AND dpa.status     = 'active'
"""
```

The JOIN on `doctor_patient_assignments` is the **security enforcement**. Without this JOIN, a doctor could see every prescription in the system. With it, they can only see prescriptions belonging to their assigned patients.

**Pagination parameters (`limit`, `offset`):**
```python
query += " ORDER BY p.id DESC LIMIT ? OFFSET ?"
params.extend([limit, offset])
```

Pagination is essential for any list endpoint. Without it, as the database grows, a single request could return millions of rows, crashing the server. `LIMIT ? OFFSET ?` means "give me at most `limit` rows, starting from position `offset`". The client requests page 1 with `limit=50, offset=0`, page 2 with `limit=50, offset=50`, and so on.

**Dynamic search filter:**
```python
if search:
    query += """
    WHERE (
        p.patient_name LIKE ? OR
        p.diagnosis    LIKE ? OR
        p.doctor_name  LIKE ? OR
        p.clinic_name  LIKE ?
    )
    """
    pattern = f"%{search}%"
    params.extend([pattern, pattern, pattern, pattern])
```

`LIKE '%searchterm%'` is SQL's case-insensitive substring search. The `%` is a wildcard that matches any characters before or after the search term. Building the query dynamically based on whether `search` is provided keeps the query clean for the non-search case.

---

#### `get_my_prescription_detail(doctor_id, prescription_id)` — Two-Step Security Check

```python
# Step 1: Verify the doctor is assigned to this patient
cursor.execute("""
    SELECT p.id FROM prescriptions p
    JOIN doctor_patient_assignments dpa
        ON dpa.patient_id = p.user_id
       AND dpa.doctor_id  = ?
       AND dpa.status     = 'active'
    WHERE p.id = ?
""", (doctor_id, prescription_id))
if cursor.fetchone() is None:
    return None  # not found or not assigned

# Step 2: Fetch the full prescription detail
cursor.execute("SELECT ... FROM prescriptions p WHERE p.id = ?", (prescription_id,))
```

The two-step pattern is deliberate:
1. Verify access (returns nothing sensitive if denied)
2. Fetch data (only runs if access is confirmed)

If you merged both into one query, you could still return a 404 to unauthorized doctors, but the query itself would be more complex. The two-step approach keeps the security check clean and obvious.

---

#### `get_patient_prescriptions_scoped(doctor_id, patient_user_id)` — History for One Patient

```python
def get_patient_prescriptions_scoped(doctor_id: int, patient_user_id: int) -> List[Dict[str, Any]]:
    # 1. Verify assignment
    # 2. Get prescription IDs
    # 3. Reuse get_my_prescription_detail for each ID
    return [
        detail
        for pid in ids
        if (detail := get_my_prescription_detail(doctor_id, pid)) is not None
    ]
```

Step 3 uses **walrus operator** (`:=`) introduced in Python 3.8. `detail := get_my_prescription_detail(...)` assigns the result to `detail` AND uses it in the `if` condition in one expression. It avoids calling the function twice.

This function **reuses** `get_my_prescription_detail` rather than duplicating the query. This is the **DRY (Don't Repeat Yourself)** principle in action.

---

#### `get_doctor_stats(doctor_id)` — Dashboard Statistics

```python
def get_doctor_stats(doctor_id: int) -> Dict[str, Any]:
    # 4 separate COUNT queries in one connection:
    # 1. Assigned patients count
    # 2. Total prescriptions
    # 3. Pending connection requests
    # 4. Upcoming follow-ups (within 7 days)
```

Each stat is a separate `SELECT COUNT(*)` query. All four run within the same `db_connection()` context (same connection, same transaction), which is efficient.

The follow-up date logic:
```python
today = datetime.now().date().isoformat()
week_ahead = (datetime.now().date() + timedelta(days=7)).isoformat()
```

`.isoformat()` converts a date to `"YYYY-MM-DD"` format. SQLite stores dates as text strings in this format, so string comparison works for date range queries (`WHERE follow_up_date >= ? AND follow_up_date <= ?`).

---

#### `respond_to_request(doctor_id, request_id, accept)` — Accept or Reject a Patient

```python
# 1. Verify request belongs to this doctor AND is still pending
# 2. UPDATE request status to 'accepted' or 'rejected'
# 3. If accepting: INSERT or REACTIVATE an assignment
cursor.execute("""
    INSERT INTO doctor_patient_assignments (doctor_id, patient_id, status)
    VALUES (?, ?, 'active')
    ON CONFLICT(doctor_id, patient_id)
    DO UPDATE SET status = 'active', assigned_at = datetime('now')
""", (doctor_id, patient_id))
```

`ON CONFLICT ... DO UPDATE` is an **UPSERT** (update-or-insert). If the assignment already exists (e.g., they were connected before and the patient re-requested), it reactivates it instead of failing with a duplicate key error.

---

#### `update_doctor_profile(doctor_id, display_name, specialty)` — Profile Update

```python
cursor.execute(
    "UPDATE users SET display_name = ?, specialty = ? WHERE id = ?",
    (display_name, specialty, doctor_id),
)
return cursor.rowcount > 0
```

`cursor.rowcount` tells you how many rows were affected. If it's 0, the doctor ID didn't exist in the database. Returning `bool` instead of raising an exception lets the router decide what error code to return.

---

### `services/share_token.py`

**Role:** The prescription sharing system. A patient generates a UUID token; anyone who has that token can view the patient's prescriptions without logging in.

---

#### `generate_token(patient_id, label, expires_in_days)` — Creating a Share Link

```python
def generate_token(patient_id, label, expires_in_days=7) -> Dict[str, Any]:
    token_value = str(uuid.uuid4())

    expires_at = None
    if expires_in_days is not None:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=expires_in_days)).isoformat()

    # INSERT into patient_share_tokens
    # Return the record including the token string
```

**`uuid.uuid4()`** generates a **version 4 UUID** — a 128-bit random identifier that looks like `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`. The probability of collision is so astronomically low it's effectively impossible. UUIDs are used here instead of sequential IDs because sequential IDs are **predictable** (`token_id=1`, `2`, `3`...). A UUID token is safe to share publicly because it cannot be guessed.

---

#### `list_tokens(patient_id)` — All Share Tokens for a Patient

```python
for row in rows:
    record = dict(row)
    if not record["is_active"]:
        record["status"] = "revoked"
    elif record["expires_at"] and record["expires_at"] < now:
        record["status"] = "expired"
    else:
        record["status"] = "active"
```

The `status` field is **computed, not stored**. The database only stores `is_active` (boolean) and `expires_at` (timestamp). The `status` string ("active", "expired", "revoked") is derived from those two fields at query time. This avoids having stale status values — the status is always computed from the current truth.

---

#### `revoke_token(patient_id, token_id)` — Instant Revocation

```python
cursor.execute("""
    UPDATE patient_share_tokens
    SET is_active = 0
    WHERE id = ? AND patient_id = ?
""", (token_id, patient_id))
return cursor.rowcount > 0
```

Sets `is_active = 0` (SQLite uses 0/1 for booleans). The `AND patient_id = ?` ensures a patient can only revoke their OWN tokens — another patient can't revoke your share links.

---

#### `resolve_token(token)` — Validating a Share Token

```python
def resolve_token(token: str) -> Optional[int]:
    # Fetch token from DB
    if row is None: return None           # doesn't exist
    if not row["is_active"]: return None  # revoked
    if row["expires_at"]:
        if row["expires_at"] < now: return None  # expired
    return row["patient_id"]
```

This is the **gateway function** for all public endpoints. It takes a token string and returns either a `patient_id` (valid) or `None` (invalid for any reason — expired, revoked, doesn't exist). All three failure modes return the same `None` — no information about *why* it failed is given to the caller. This prevents **oracle attacks** (an attacker learning which tokens exist vs. which are expired).

---

#### `get_token_info(token)` — Preview Before Viewing

```python
def get_token_info(token: str) -> Optional[Dict[str, Any]]:
    patient_id = resolve_token(token)
    if patient_id is None:
        return None

    # Fetch token label/expiry
    # Fetch patient display_name (NOT their username — privacy)
    return {
        "patient_display_name": user_row.get("display_name") or user_row["username"],
        "label": token_row["label"],
        "expires_at": token_row["expires_at"],
        "valid": True,
    }
```

This is the "light" version — it tells the token holder whose records they're viewing and when the link expires, without exposing the full prescription history. The frontend can use this for a confirmation screen ("You're about to view Alice's medical records").

Notice: it returns `display_name` OR falls back to `username` if no display name is set (`or user_row["username"]`).

---

#### `get_prescriptions_by_token(token)` — The Public Data Access

```python
def get_prescriptions_by_token(token: str) -> Optional[List[Dict[str, Any]]]:
    patient_id = resolve_token(token)
    if patient_id is None:
        return None

    # Fetch all prescriptions for this patient
    # Attach medications to each one
    return prescriptions
```

Returns `None` (not found/invalid) vs. an empty list (valid token, but no prescriptions). This distinction matters: the router returns 404 on `None` but returns `{"total": 0, "prescriptions": []}` on an empty list.

---

## 11. Layer 5 — Routers (HTTP Endpoints)

Routers are the outermost layer. They handle:
1. Receiving the HTTP request
2. Running dependencies (authentication, role checks)
3. Calling a service function
4. Returning the result (or an HTTP error)

Routers should have **minimal logic**. If a router function is longer than ~20 lines, it probably has business logic that should move to a service.

---

### `routers/auth.py`

**Routes:** `POST /api/register`, `POST /api/login`

#### `register(user: UserRegister)`

```python
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    created = user_database.create_user(user.username, user.password, user.role)
    if not created:
        raise HTTPException(status_code=400, detail="Username already registered.")
    return {"message": "User created successfully.", "role": created["role"]}
```

FastAPI automatically parses the JSON request body into a `UserRegister` Pydantic model (including the role validation). The function just calls the database, checks the result, and returns a response.

`status_code=status.HTTP_201_CREATED` — Returns 201 instead of 200 because this creates a new resource. This follows REST conventions.

---

#### `login(form_data: OAuth2PasswordRequestForm)`

```python
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = user_database.get_user(form_data.username)
    if not user or not user_database.verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}
```

**`OAuth2PasswordRequestForm`** — A special FastAPI class that parses form data (not JSON!). The OAuth2 spec requires the login endpoint to accept `application/x-www-form-urlencoded` form data with fields `username` and `password`. This is why the frontend sends `FormData` not JSON for login.

**Error message**: "Incorrect username or password." — intentionally vague. We don't say "username doesn't exist" or "password is wrong" separately, because that would allow an attacker to enumerate valid usernames.

**Token payload**: `{"sub": user["username"], "role": user["role"]}` — `"sub"` (subject) is the standard JWT claim for the primary identifier. The role is included so the frontend knows what UI to show after login, without making an extra API call.

---

### `routers/upload.py`

**Routes:** `POST /api/upload`, `GET /api/job/{job_id}`

#### `_run_ocr_and_save(job_id, image_bytes, mime_type, user_id)` — The Background Worker

```python
def _run_ocr_and_save(job_id, image_bytes, mime_type, user_id):
    try:
        extracted = gemini_service.extract_prescription_data(image_bytes, mime_type)

        prescription_id = None
        try:
            prescription_id = prescription_db.insert_prescription(extracted, user_id=user_id)
        except Exception as db_err:
            print(f"[job {job_id}] DB insert failed: {db_err}")

        job_store.set_done(job_id, extracted, prescription_id=prescription_id)
    except Exception as exc:
        job_store.set_error(job_id, str(exc))
```

Notice the **nested try/except**: the outer one catches AI failures, the inner one catches database failures. If the DB insert fails (but the AI succeeded), the job is still marked as "done" with the extracted data — the prescription just doesn't get saved. This is a deliberate trade-off: better to show the user their extracted data than to show nothing.

This function runs in a background thread (via FastAPI's `BackgroundTasks`). It doesn't have access to the HTTP request or response — it's completely decoupled from the web layer.

---

#### `upload_image(background_tasks, file, current_user)` — The Upload Endpoint

```python
@router.post("/upload")
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
```

**`BackgroundTasks`** — FastAPI's built-in mechanism for running code after a response is sent. The function returns immediately; the OCR runs in the background.

**File validation:**
```python
content_type = file.content_type or "image/jpeg"
if content_type not in _ALLOWED_TYPES:
    raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
```

Only specific image types are accepted. This prevents attackers from uploading malicious files.

**Collision-safe filename:**
```python
file_path = _UPLOADS_DIR / filename
counter = 1
stem, suffix = file_path.stem, file_path.suffix
while file_path.exists():
    file_path = _UPLOADS_DIR / f"{stem}-{counter}{suffix}"
    counter += 1
```

If a file with the same name already exists, it appends a counter: `prescription.jpg` → `prescription-1.jpg` → `prescription-2.jpg`. This prevents file overwrites.

**Return immediately:**
```python
job_id = str(uuid.uuid4())
job_store.create(job_id, image_path=str(file_path))
background_tasks.add_task(_run_ocr_and_save, job_id, image_bytes, content_type, current_user["id"])

return {"job_id": job_id, "status": "processing", ...}
```

The response is sent before OCR finishes. The client receives a `job_id` and then polls `/api/job/{job_id}` to check progress. This is the **Asynchronous Processing Pattern** (also called fire-and-forget or poll-based job processing).

---

#### `get_job_status(job_id, current_user)` — Polling for Results

```python
@router.get("/job/{job_id}")
async def get_job_status(job_id: str, current_user: dict = Depends(get_current_user)):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or already expired.")
    return job
```

Simple lookup. The `current_user` dependency ensures only authenticated users can poll jobs (though there's no ownership check here — any authenticated user can poll any job by ID. This is a potential future improvement).

---

### `routers/Medicine_info.py`

**Route:** `GET /api/medicine_info/p/{prescription_id}`

```python
@router.get("/p/{prescription_id}")
async def read_medicine_info(prescription_id: int, current_user: dict = Depends(get_current_user)):
    return get_medicine_info(prescription_id, current_user["id"])
```

The simplest router in the project. One line of business logic: call the service with the prescription ID and the current user's ID. The service handles the ownership check and returns the formatted medication list.

---

### `routers/doctor.py`

**Route prefix:** `/api/doctor/*`  
**All routes protected with:** `Depends(require_role("doctor"))`

This router has the most endpoints because doctors have the richest dashboard functionality.

| Endpoint | Method | What It Does |
|---|---|---|
| `/stats` | GET | Dashboard statistics (patient count, rx count, follow-ups) |
| `/my-patients` | GET | List of assigned patients |
| `/prescriptions` | GET | Paginated, searchable prescription list |
| `/prescriptions/{id}` | GET | Single prescription full detail |
| `/patients/{uid}/prescriptions` | GET | All prescriptions for one specific patient |
| `/requests` | GET | Pending connection requests |
| `/requests/{id}/respond` | POST | Accept or reject a request |
| `/profile` | GET | Doctor's own profile |
| `/profile` | PUT | Update doctor's profile |

Every single route passes `current_user: dict = Depends(require_role("doctor"))` which means:
1. The request must have a valid JWT
2. The JWT must belong to a user with `role = "doctor"`
3. If either check fails, a 401/403 is returned before the function body even runs

This is the **Declarative Security** pattern — security is declared at the function signature level, not buried in if-statements inside the function body.

---

### `routers/patient_requests.py`

**Route prefix:** `/api/patient/*`  
**All routes protected with:** `Depends(require_role("patient"))`

| Endpoint | Method | What It Does |
|---|---|---|
| `/doctor/lookup/{doctor_id}` | GET | Preview a doctor before sending a request |
| `/request-doctor` | POST | Send a connection request |
| `/my-requests` | GET | View all sent requests and their status |
| `/my-doctor` | GET | Who is currently my assigned doctor? |

---

### `routers/share_token.py`

This router has two distinct groups of endpoints with different authentication requirements:

**Group 1: Patient-authenticated routes** (require JWT with `patient` role)
```
POST /api/patient/share-tokens        → Create a token
GET  /api/patient/share-tokens        → List my tokens
DELETE /api/patient/share-tokens/{id} → Revoke a token
```

**Group 2: Public routes** (no authentication at all)
```
GET /api/share/{token}/info           → Preview token info
GET /api/share/{token}/prescriptions  → View prescriptions via token
```

Notice there is NO `Depends(...)` on the public routes. Anyone with the token string can access them — that IS the authentication mechanism. The token itself is the credential.

```python
@router.get("/api/share/{token}/prescriptions")
def get_shared_prescriptions(token: str):
    prescriptions = token_service.get_prescriptions_by_token(token)
    if prescriptions is None:
        raise HTTPException(status_code=404, detail="This token is invalid, expired, or has been revoked.")
    return {"total": len(prescriptions), "prescriptions": prescriptions}
```

Returning 404 (not 401/403) on an invalid token is intentional. A 403 would confirm the resource exists but is forbidden. A 404 reveals nothing.

---

## 12. How It All Connects — A Full Request Journey

Let's trace a complete request lifecycle: **"Patient uploads a prescription image"**

```
1. CLIENT: POST /api/upload
   Headers: Authorization: Bearer eyJhbGci...
   Body: multipart/form-data (image file)

2. FastAPI routes the request to routers/upload.py → upload_image()

3. Dependency injection runs:
   → oauth2_scheme extracts the Bearer token
   → get_current_user(token) decodes the JWT, looks up the user in DB
   → current_user = {"id": 42, "username": "alice", "role": "patient"}

4. Validation: content_type in _ALLOWED_TYPES? ✓

5. File saved: data/uploads/prescription.jpg

6. Job registered:
   job_store.create("abc-123", image_path=".../prescription.jpg")

7. Background task scheduled:
   background_tasks.add_task(_run_ocr_and_save, "abc-123", image_bytes, "image/jpeg", 42)

8. Response sent immediately:
   {"job_id": "abc-123", "status": "processing", ...}

--- Meanwhile, in the background thread: ---

9. app/gemini.py → extract_prescription_data(image_bytes, "image/jpeg")
   → Calls Google Gemini Vision API
   → Returns structured dict:
     {"doctor_name": "Dr. Smith", "medications": [...], ...}

10. services/prescription_db.py → insert_prescription(extracted, user_id=42)
    → INSERT INTO prescriptions ...
    → For each medication: INSERT INTO prescription_medications ...
    → Returns prescription_id = 17

11. job_store.set_done("abc-123", extracted, prescription_id=17)

--- Client polls: ---

12. CLIENT: GET /api/job/abc-123
    → job_store.get("abc-123")
    → Returns {"status": "done", "extracted": {...}, "prescription_id": 17}

13. CLIENT renders the extracted prescription data.
```

---

## 13. Design Patterns Summarized

| Pattern | Where Used | Why |
|---|---|---|
| **Layered Architecture** | Entire project | Separation of concerns, testability, maintainability |
| **Modular Router Pattern** | `app/main.py` + `routers/` | Feature isolation, readable code |
| **Dependency Injection** | All routers via `Depends()` | Reusable auth, testable components |
| **Facade Pattern** | `app/gemini.py` | Hides AI SDK complexity behind one function |
| **Context Manager** | `database/user_database.py` | Safe, exception-proof resource management |
| **Factory Function (Closure)** | `core/security.py → require_role()` | Parameterized, reusable role guards |
| **Idempotent Migrations** | `database/user_database.py` | Safe to run on every startup |
| **Async Background Jobs** | `routers/upload.py` | Non-blocking OCR, instant response |
| **Thread-safe Module State** | `app/job_store.py` | Multi-thread safety with mutex locks |
| **Lazy Eviction (TTL)** | `app/job_store.py` | Memory management without timers |
| **Graceful Degradation** | `app/gemini.py` | Never crashes on bad AI output |
| **Defensive Copy** | `app/job_store.py → get()` | Prevents outside mutation of internal state |
| **RBAC (Role-Based Access Control)** | `core/security.py → require_role()` | Authorization by role |
| **Authorization-through-Query** | `services/doctor.py`, `services/Medicine.py` | Access control enforced at DB level |
| **UUID Tokens** | `services/share_token.py` | Unguessable public credentials |
| **State Machine** | `services/patient_requests.py → send_request()` | Manages all request lifecycle states |
| **UPSERT** | `services/doctor.py → respond_to_request()` | Insert or update without duplicates |
| **Named Constants** | `app/gemini.py`, `database/user_database.py` | No magic strings |
| **DRY (Don't Repeat Yourself)** | `services/doctor.py → get_patient_prescriptions_scoped()` | Reuses `get_my_prescription_detail()` |
| **Fail Fast** | `database/user_database.py → create_user()` | Validates preconditions before proceeding |
| **Lazy Import** | `app/gemini.py` | Optional dependency doesn't break startup |
| **Parameterized SQL** | All database files | SQL injection prevention |

---

## 14. The Database Schema in Plain English

The database has 5 tables:

### `users`
```
id | username | password_hash | role | display_name | specialty
```
All accounts live here — both patients and doctors. The `role` column distinguishes them.

### `prescriptions`
```
id | user_id | doctor_name | clinic_name | clinic_address | clinic_phone |
patient_name | patient_age | patient_gender | issue_date | follow_up_date |
diagnosis | notes | raw_text
```
One row per uploaded prescription. `user_id` links to the patient who uploaded it.

### `prescription_medications`
```
id | prescription_id | date | name | dosage | frequency | duration | instructions
```
One row per medicine in a prescription. Many medications can belong to one prescription (`prescription_id` is a foreign key).

### `doctor_patient_assignments`
```
id | doctor_id | patient_id | assigned_at | status
```
`status` is `'active'` when the relationship is live. The UNIQUE constraint on `(doctor_id, patient_id)` prevents duplicate assignments.

### `patient_doctor_requests`
```
id | patient_id | doctor_id | requested_at | status
```
`status` goes through: `'pending'` → `'accepted'` or `'rejected'`. The UNIQUE constraint on `(patient_id, doctor_id)` prevents a patient from spamming a doctor with duplicate requests.

### `patient_share_tokens`
```
id | patient_id | token | label | expires_at | is_active | created_at
```
`token` is a UUID. `is_active = 0` means revoked. `expires_at = NULL` means never expires.

---

## 15. Security Model Explained

The application has three levels of access:

### Level 1: Unauthenticated (Public)
- `GET /` — Frontend HTML
- `GET /api/health` — Health check
- `GET /api/share/{token}/info` — Token preview
- `GET /api/share/{token}/prescriptions` — Shared prescriptions

These endpoints either return non-sensitive data or require a valid share token.

### Level 2: Authenticated (Any Role)
- `GET /api/job/{job_id}` — Poll OCR job status
- `GET /api/medicine_info/p/{id}` — Medicine info (with ownership check)

Any logged-in user can access these, but ownership is enforced inside the service layer.

### Level 3: Role-Specific
- `/api/doctor/*` — Only users with `role = 'doctor'`
- `/api/patient/*` — Only users with `role = 'patient'`
- `POST /api/upload` — Any authenticated user (patients upload prescriptions)

**Defense-in-depth principle:** Security is enforced at multiple layers:
1. JWT validation (is the token genuine and unexpired?)
2. Role check (is this user allowed to use this endpoint?)
3. Ownership check in queries (is this data actually theirs?)

An attacker would need to break through all three layers to access unauthorized data. Layers 1 and 2 are in `core/security.py`. Layer 3 is embedded in every SQL query in the services layer.

---

## Final Words to the Student

You've now seen every file and every function in this codebase. Here's what you should take away:

1. **Structure is everything.** Professional code is not about clever one-liners. It's about organizing code so any team member can find what they're looking for in under 30 seconds.

2. **Security is never an afterthought.** Notice how authorization appears in three separate layers. This is not redundancy — this is defense in depth.

3. **Patterns exist for a reason.** Layered architecture, dependency injection, context managers — these aren't buzzwords. They solve real problems that you'll encounter if you write enough code.

4. **Error handling is a feature.** The graceful degradation in `gemini.py`, the fallback returns in service functions, the `try/except` in database helpers — all of this is what separates production code from a homework assignment.

5. **Small functions are good functions.** Most functions in this codebase do exactly one thing. That's intentional. It makes them readable, testable, and reusable.

Good luck writing your own projects! The best way to learn these patterns is to use them yourself. Start with the simplest feature and add layers as you grow.

---

*Document auto-generated from source code at `c:\CODING ONLY\PRO-JET` — Rxify v0.3.0*
