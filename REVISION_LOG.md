# URL Shortener — Learning and Revision Log

This is a running learning record for the five-day URL shortener project.
The goal is to preserve the reasoning, mistakes, corrections, design choices,
and questions needed for revision and the final demonstration.

## Project Overview

- **Project:** URL shortener with an analytics dashboard
- **Planned stack:** FastAPI, PostgreSQL, Redis, and React
- **Core ideas:** Website, Server, Database, API, Cache, Frontend/Backend
- **Main behavior:** Convert a long URL into a short URL, redirect visitors to
  the original URL, and record click analytics.

---

## Day 1 — Understand and Plan

### Goal

Understand what a URL shortener does, draw its architecture, define the
request workflows, and choose a short-code generation strategy without
writing implementation code.

### What a URL shortener does

A URL shortener converts a long, inconvenient URL into a shorter link. The
short link contains a code that the application maps to the original long URL.
When someone visits the short link, the server looks up the original URL and
redirects the visitor to it. Analytics are useful because the application can
record how many times links are visited and later display that information.

### Architecture

#### Main components

- **Browser:** Sends requests and follows redirects.
- **FastAPI application:** Receives HTTP requests, runs application logic, and
  returns API responses or redirects.
- **PostgreSQL:** Permanent storage for link records and analytics data.
- **Redis:** Fast, temporary cache for frequently requested short-code
  mappings.

FastAPI is the API framework used by the application server. It is not a
separate processing stage from the application server.

#### Create-link workflow

1. The browser sends a long URL to the FastAPI application.
2. The application creates a database ID and short code.
3. The application stores the link mapping in PostgreSQL first.
4. After the permanent write succeeds, the application places the mapping in
   Redis.
5. The application returns the short link to the browser.

PostgreSQL comes before Redis because the database is the permanent source of
truth. Redis should not contain the only copy of a link.

#### Redirect workflow

1. The browser requests a short code.
2. FastAPI checks Redis first.
3. On a Redis hit, the application obtains the original URL quickly and
   redirects the browser.
4. On a Redis miss, the application reads the mapping from PostgreSQL.
5. The application can place that mapping into Redis for future requests.
6. The application redirects the browser to the original URL.
7. The visit can also produce a click event for analytics.

Redis is a cache, so it may be empty, cleared, or unavailable. A cache miss
must therefore be recoverable by reading PostgreSQL.

### Short-code design decision

#### Chosen approach

Use a unique sequential PostgreSQL ID and encode that ID using Base62.

#### How it works

PostgreSQL assigns unique numeric IDs such as `100`, `101`, and `102`.
Base62 represents those numbers using an alphabet of 62 characters:
lowercase letters, uppercase letters, and digits. The conversion is
deterministic, so the same ID always produces the same code and different IDs
produce different codes.

PostgreSQL provides uniqueness. Base62 only changes the representation into a
shorter public code; it does not create uniqueness, store the link, or expand
the database's numeric range.

#### Benefits

- Simple to implement and maintain.
- PostgreSQL already provides the unique ID.
- Different database IDs do not normally produce the same Base62 code.
- No random generate-check-retry process is normally needed.
- Codes are shorter than exposing the full numeric ID.
- The mapping is deterministic.

#### Tradeoffs

- Codes are predictable because IDs are sequential.
- Someone who sees one code may guess nearby codes.
- Sequential codes provide weaker privacy than random codes.
- The ID sequence still has the finite range supported by the database.
- Base62 does not make the database range larger; it only represents values
  compactly.

#### Alternative considered: random Base62 codes

Random codes are harder to guess, but two random attempts can theoretically
produce the same code. The application would need to generate a code, check
whether it exists, and retry when a collision occurs. A database `UNIQUE`
constraint is still needed, especially when multiple requests happen at the
same time.

#### Collision retry loop

A collision occurs when a newly generated random code is already assigned to
another link. A collision retry loop is:

1. Generate a random code.
2. Try to save it.
3. If the code already exists, generate another code.
4. Repeat until an unused code is found.

Sequential database IDs encoded deterministically with Base62 normally avoid
this loop because the database assigns a different ID to each row.

### Important theory

#### PostgreSQL — Database

PostgreSQL is the organised, permanent filing cabinet. It stores the original
URL, its short-code information, and later the click records. Its durable
committed data can be recovered after Redis is cleared or unavailable.

#### Redis — Cache

Redis is a fast sticky note. It improves response time for frequently used
lookups, but it is not the permanent record. The application must be able to
rebuild the cache from PostgreSQL.

#### FastAPI — API and Server

FastAPI helps the server receive HTTP requests, run the URL-shortening
application logic, and send responses. The API is the defined communication
surface between the browser and the backend.

#### Frontend and Backend

The browser and later the React dashboard are the shop window: they present
features to the user. FastAPI, PostgreSQL, and Redis are part of the backend
stockroom: they process requests and manage data behind the interface.

#### Website

A website is a page available at a web address. The short URL is an address
that the server understands and uses to find the destination website.

### Mistakes and corrections

1. **Mistake:** Treating FastAPI and the application server as separate
   sequential stages.
   **Correction:** FastAPI is the framework used by the application server.

2. **Mistake:** Treating Redis as another required permanent step after
   PostgreSQL.
   **Correction:** Redis is a cache. PostgreSQL remains authoritative, and
   Redis is checked first during redirects.

3. **Mistake:** Thinking Base62 itself creates unique IDs.
   **Correction:** PostgreSQL creates the unique ID. Base62 only encodes it.

4. **Mistake:** Thinking Base62 expands the available numeric range.
   **Correction:** Base62 makes values more compact but does not increase the
   database's supported ID range.

5. **Mistake:** Expecting sequential IDs to need random collision retries.
   **Correction:** Unique sequential database IDs mapped deterministically to
   Base62 codes normally avoid random collision retries.

6. **Mistake:** Initially describing random Base62 codes together with a
   sequential counter.
   **Correction:** Random-code generation and sequential-ID generation are
   separate strategies with different tradeoffs.

### Demo questions to practise

- What is the difference between PostgreSQL and Redis in this project?
- Why must PostgreSQL be the permanent source of truth?
- What happens on a Redis cache miss?
- What does Base62 do, and what does it not do?
- Why are sequential codes easier to implement but less private?
- What is a collision retry loop?
- Why does a cache improve speed without replacing the database?

### Day 1 personal log

This section should be rewritten in your own words at the end of the day.

- **What I built or planned:**
- **What confused me or broke:**
- **What I learned:**
- **One open question:**

### Day 1 commit message

`docs(architecture): plan URL shortener workflow`

---

## Day 2 — Build the Memory

### Planned topics

- PostgreSQL schema for links
- PostgreSQL schema for clicks
- Relationships and indexes
- Redis cache contents
- Cache TTL decision and tradeoffs

### Notes

#### Click-event schema decision

The `clicks` table will store one row for every visit with these fields:
`id`, `link_id`, `clicked_at`, `referrer`, and `country`.

`referrer` and `country` will be nullable because those values may not be
available for every request. Keeping them nullable preserves the click event
without inventing inaccurate metadata. The fields support referral analysis
and regional analytics later.

The `clicks.link_id` value will identify the related link instead of copying
the full URL into every event row. This avoids unnecessary duplication and
creates a one-to-many relationship: one link can have many click events.

#### Link uniqueness decisions

The public `short_code` must have a PostgreSQL `UNIQUE` constraint. This
protects the public identifier itself, including when simultaneous requests
try to create rows.

The same `long_url` may appear in multiple link rows. Separate short links
allow different creators or campaigns to have separate analytics. A future
expiry feature would require an explicit schema and behavior decision; it is
not assumed in the current four-column link design.

#### Redis cache decision

Redis will cache `short_code → long_url` lookups with a 24-hour TTL. This
supports the read-heavy redirect path while ensuring unused entries eventually
expire. Expiration removes only the cache entry; the next request can read
PostgreSQL and repopulate Redis.

#### Index decision

The `UNIQUE` constraint on `links.short_code` also supports fast redirect
lookups. The clicks table will have a non-unique composite index on
`(link_id, clicked_at)`, which supports retrieving one link's click events and
grouping them over time. `clicks.link_id` remains a foreign key and must not be
unique because one link can have many click events.

#### Schema terminology corrections

`links.id` is the internal numeric PostgreSQL primary key; `short_code` is the
Base62 representation derived from that ID. A `clicks.id` is a single unique
click-event identifier, not a composite ID. `clicks.link_id` references
`links.id` and may repeat across many click rows. `referrer` records the
referring page or source, not the creator of the link, while `country` records
the visitor's approximate region when available.

The primary key is the internal numeric `id`, not the public `short_code`.
Although `short_code` could technically be a primary key, keeping the
internal identity separate from its public representation makes relationships
and future representation changes clearer.

#### Migration implementation

The schema is implemented as plain SQL migrations:

- `migrations/001_create_links.sql` creates the parent `links` table with an
  identity-generated `BIGINT` primary key, required URL fields, a unique
  public code, and a creation timestamp.
- `migrations/002_create_clicks.sql` creates one row per click event, links
  each event to an existing link with a foreign key, allows missing referrer
  and country values, and adds the `(link_id, clicked_at)` index.

The foreign key uses `ON DELETE CASCADE`. If a link is explicitly deleted,
its click rows are deleted too. This keeps no orphaned analytics but accepts
loss of that link's history. Cascade does not mean that rows automatically
expire; expiry would require a separate feature.

Both migrations were executed successfully in the `url_shortener` PostgreSQL
database through pgAdmin, and the `links` and `clicks` tables are present.
The pgAdmin inspection also confirmed the primary/foreign-key symbols, the
unique protection for `links.short_code`, and the
`clicks_link_id_clicked_at_idx` index.

#### Constraint and index recap

`links.id` is the internal primary key and uniquely identifies each link row.
`short_code` is separately `NOT NULL` and `UNIQUE`: it must be present and
must not be duplicated. `clicks.link_id` is a foreign key, so every click
must refer to an existing link. The `(link_id, clicked_at)` index is
non-unique and improves queries that retrieve one link's clicks in time order;
it does not make the clicks table or click IDs unique.

#### Composite-index clarification

`CREATE INDEX clicks_link_id_clicked_at_idx ON clicks (link_id, clicked_at)`
creates a lookup structure ordered first by `link_id` and then by
`clicked_at`. This reduces search work for queries that find the click events
for a specific link and retrieve them over time. It does not make
`link_id` unique, because many click events can belong to the same link.
The index is most useful when a query filters by `link_id`; it is less useful
for a query that filters only by `clicked_at`.

#### Day 2 learning summary

Today’s database design separates permanent link data from event history:

- The `links` table stores one row per shortened URL:
  `id`, `short_code`, `long_url`, and `created_at`.
- The `clicks` table stores one row per visit:
  `id`, `link_id`, `clicked_at`, `referrer`, and `country`.
- `links.id` is the internal numeric primary key and is generated as a
  `BIGINT` identity value.
- `short_code` is a required public value. `NOT NULL` prevents a missing
  code, while `UNIQUE` prevents two rows from exposing the same code.
- `clicks.id` uniquely identifies one click event; it is not a composite ID.
- `clicks.link_id` is a non-unique foreign key to `links.id`, because one link
  can have many click events.
- `referrer` and `country` are nullable because request metadata may be
  unavailable. When present, they support referral and regional analytics.
- The same `long_url` may have multiple short links so different users or
  campaigns can have separate analytics.
- The composite index `(link_id, clicked_at)` creates a lookup structure
  ordered first by link and then by time. It reduces search work when
  retrieving a specific link's clicks over time, but does not make
  `link_id` unique.

#### Redis decision

Redis caches `short_code → long_url` lookups for 24 hours. This is useful
because URL shorteners are read-heavy: a link may be created once but visited
many times. When the entry expires or is missing, the application reads the
permanent mapping from PostgreSQL and can repopulate Redis. Expiration affects
only the cache; it does not delete the PostgreSQL row.

#### Migration and inspection

The schema uses plain SQL migrations rather than an ORM migration tool so the
database constraints remain visible while learning:

- `migrations/001_create_links.sql`
- `migrations/002_create_clicks.sql`

Both migrations were run successfully in the `url_shortener` database using
pgAdmin. The tables, primary/foreign-key relationship, unique protection for
`short_code`, and `clicks_link_id_clicked_at_idx` index were inspected in the
pgAdmin object tree.

#### Day 2 mistakes and corrections

1. A primary key was initially confused with the public `short_code`.
   Correction: `links.id` is the internal primary key; `short_code` is a
   separate unique public value.
2. `UNIQUE` was initially treated as if it also meant `NOT NULL`.
   Correction: `NOT NULL` prevents missing values, while `UNIQUE` prevents
   duplicates.
3. `clicks.id` was described as a composite ID.
   Correction: it is a unique identifier for one click event.
4. `referrer` was confused with the link creator.
   Correction: it is the referring page or traffic source.
5. `clicks.link_id` was nearly treated as unique.
   Correction: it is a foreign key that may repeat for many visits.
6. The composite index was described as maintaining the table.
   Correction: it is a non-unique lookup structure that improves queries
   filtering by `link_id` and ordering or grouping by `clicked_at`.
7. `ON DELETE CASCADE` was associated with automatic expiry.
   Correction: cascade runs when a parent row is explicitly deleted; expiry
   would require separate application and schema behavior.

#### Day 2 design justifications

- **Two tables:** link records and click events have different meanings and
  lifecycles, so separating them avoids mixing current link data with
  historical events.
- **Unique short code:** the public identifier must map unambiguously to one
  link, including when requests happen concurrently.
- **Foreign key:** every click should belong to an existing link.
- **Nullable metadata:** analytics should preserve the click even when
  referrer or country cannot be determined.
- **24-hour TTL:** frequent redirects can use fast memory lookups while
  unused cache entries eventually disappear.
- **Plain SQL migrations:** visible SQL makes the schema constraints easier to
  learn and reproduce.

#### Day 2 learning improvements

- I now distinguish the internal primary key `links.id` from the public
 unique `short_code`.
- I now distinguish `NOT NULL` (a value is required) from `UNIQUE` (duplicate
 values are rejected).
- I understand that `clicks.id` identifies one click event, while
 `clicks.link_id` connects that event to a link and may repeat.
- I understand that `referrer` means the traffic source, not the link
 creator.
- I understand that `(link_id, clicked_at)` is a non-unique composite index
 for faster per-link, time-based click queries.
- I understand that `ON DELETE CASCADE` applies to explicit deletion and is
 not automatic link expiry.

#### Day 2 daily log draft

The final reflection should be written in my own words using the required
format:

```markdown
## Day 2 — 2026-09-30
**Built:** [my summary of the migrations, tables, Redis TTL, and pgAdmin check]
**Broke / debugged:** [my database terminology mistakes and corrections]
**Learned:** [my explanation of keys, relationships, constraints, and indexes]
**Open question:** [one thing I still want to understand]
**Prompt log:** [what migration help I requested, why, and what I verified or changed]
```

#### Day 2 commit message

`feat: create migrations and schema`

#### Prompt-log reminder

The SQL migration blocks were generated after deciding the schema and
constraints. The prompt log should record what was requested, why the block
was needed, and any changes made after reviewing it.

---

## Day 3 — Build the Doorway

### Planned topics

- Shorten-link endpoint
- Redirect endpoint
- HTTP redirect status-code decision
- Validation and error responses

### Notes

_To be filled in during Day 3._

#### Day 3 recall

- `short_code` is the public code that identifies a shortened link.
- `NOT NULL` requires every link row to have a code, while `UNIQUE` prevents
  two rows from exposing the same code.
- A Redis hit can redirect without querying PostgreSQL; a miss reads the
  permanent mapping from PostgreSQL and can repopulate Redis.
- HTTP 307 is preferred over 301 for analytics because 301 can be cached by
  browsers and cause later visits to bypass the server. A 307 asks the
  browser to request the server again and preserves the request method.

#### Day 3 API decisions

- The request/response format options considered were:
  - **JSON request and JSON response:** structured, extensible, and suitable
    for the future React dashboard, but requires explicit JSON validation.
  - **Form data and plain-text response:** easy for a simple browser form, but
    less structured and harder to extend.
  - **Raw URL request and JSON response:** compact, but less self-documenting
    and less convenient for adding future request fields.
- JSON request/response was chosen because it gives a clear, structured
  contract that can grow with the application.
- `POST /shorten` will accept JSON in the shape
  `{ "long_url": "https://example.com/page" }`.
- A successful shorten response will use JSON containing the generated
  `short_code` and `short_url`.
- `GET /r/{short_code}` will return HTTP 307 with a `Location` header
  containing the original URL, rather than returning the destination as
  ordinary JSON.
- An unknown short code will return a clean HTTP 404 response.
- URL validation will accept only absolute `http` and `https` URLs. Missing
  schemes and unsupported schemes will be rejected with HTTP 422. This makes
  redirect behavior predictable and avoids accepting unsupported destination
  schemes.

#### FastAPI application entry point

`backend/app/main.py` creates the FastAPI application, gives it the project
title, and currently exposes a minimal `/health` route. The health route
returns `{"status": "ok"}` and proves that the FastAPI application can start,
receive a request, and return a response. It does not yet prove that
PostgreSQL or Redis is responding; dependency checks can be added later.

The entry point should wire routes together rather than contain all validation,
database access, cache access, code generation, and redirect logic. Separating
those responsibilities keeps each module easier to understand and change.
The file currently passes editor diagnostics with no errors.

The `/health` route uses `@app.get("/health")` to register a GET endpoint.
FastAPI calls `health_check()` when a client sends a matching GET request.
The return annotation `dict[str, str]` describes a dictionary with string keys
and string values. A missing route normally returns HTTP 404, while an
unhandled exception in the route can produce HTTP 500.

#### FastAPI and Uvicorn

FastAPI defines the application behavior: routes, request handling, validation,
and response creation. Uvicorn is the ASGI web server process that listens for
network connections, receives HTTP requests from the browser, passes them to
the FastAPI application, and sends FastAPI's response back to the client.
FastAPI is the application framework; Uvicorn is the communication/runtime
layer that serves it.

#### Short-code design reaffirmed

The project continues with the original sequential-ID-plus-Base62 design.
PostgreSQL generates the internal numeric ID, Base62 converts that ID into the
public short code, and the full long URL remains stored unchanged in
`links.long_url`. We are not encoding or hashing the entire long URL into
seven characters.

A hash-based seven-character design was considered but rejected for this
project because truncating a hash creates collision handling requirements and
would force a new decision about whether repeated long URLs share codes or
receive separate codes. Sequential IDs are simpler, deterministic, and
collision-free when encoded correctly; the accepted tradeoff is predictable
codes.

The public code will use variable-length Base62 with a maximum of 11
characters. Eleven characters are sufficient to represent the full positive
range of a signed PostgreSQL `BIGINT`; imposing a seven-character maximum
would create an unnecessary public-capacity limit of approximately `62^7`
values. The helper must reject zero, negative IDs, and values above the
positive `BIGINT` maximum.

`backend/app/encoding.py` implements the helper. It repeatedly divides the
numeric ID by 62, records each remainder as a Base62 character, and reverses
the collected characters because division discovers digits from right to
left. It rejects booleans, non-integers, zero, negative IDs, and values above
the signed positive `BIGINT` maximum.

#### PostgreSQL access decision

The project will use SQLAlchemy Core with an asynchronous PostgreSQL driver.
This keeps SQL queries explicit while allowing FastAPI to yield control during
database I/O, so other requests can be handled while PostgreSQL responds. It
does not make an individual query intrinsically faster, and it introduces
connection-pool and async-session concepts. A synchronous driver was rejected
for the endpoint path because blocking database calls can hold up the
application event loop under concurrent requests.

#### Environment configuration

Database credentials are loaded through a local `.env` file rather than being
written into Python. The real `.env` is ignored by Git, while `.env.example`
documents the required `DATABASE_URL` shape without exposing a password.
`python-dotenv` provides `load_dotenv()`, which reads the local file and loads
`DATABASE_URL` into the process environment before `database.py` reads it.

`backend/requirements.txt` records the runtime dependencies:
FastAPI, Uvicorn, SQLAlchemy, `asyncpg`, and `python-dotenv`. The dependencies
were installed in the project environment. A safe configuration check
confirmed the URL scheme `postgresql+asyncpg`, host `localhost`, port `5432`,
and database `url_shortener` without printing credentials. Editor diagnostics
for `database.py` and `main.py` are clear.

#### Database connectivity debugging

The first application-side `SELECT 1` check failed because the PostgreSQL
password contained `@`. In a URL, `@` separates credentials from the host, so
an `@` inside a password must be URL-encoded as `%40`. After encoding it in
the local `.env` file, the async SQLAlchemy connection succeeded and
`SELECT 1` returned `1`.

The failure demonstrated why pgAdmin connectivity alone is not enough:
pgAdmin can connect while the application's URL parser still interprets
credentials incorrectly. The temporary `check_db.py` diagnostic was removed
after verification.

#### Configuration import-order debugging

Adding Redis caused `KeyError: 'REDIS_URL'` because `cache.py` read the
environment during import before `database.py` had loaded `.env`. The fix is
`backend/app/config.py`, which loads `.env` first and exposes both required
settings. `database.py` and `cache.py` now import configuration from this
shared module instead of loading environment variables independently.

Inspection also found that `cache.py` had a malformed cache-write block
outside a function. It was repaired so `get_cached_url` performs reads and
`cache_url` performs writes with the 24-hour TTL. Editor diagnostics are clear
for the configuration, database, cache, and redirect modules.

#### Python 3.9 compatibility debugging

Startup then failed because `Redis[str]` treated the Redis client as a generic
class even though the installed client is not generic at runtime. Removing
`[str]` changed only the annotation, not Redis behavior. A second startup
error showed that Python 3.9 cannot evaluate `str | None`; the cache read
helper now uses `Optional[str]` instead. The application imports successfully,
and its registered routes include `/health`, `/shorten`, and
`/r/{short_code}`.

#### Day 3 endpoint verification

The `/shorten` endpoint and `/r/{short_code}` redirect endpoint were tested
after the configuration and Python 3.9 fixes. The shorten flow stores a link
and returns its generated short URL. The redirect flow checks Redis first,
falls back to PostgreSQL when needed, and returns HTTP 307 with a `Location`
header. An unknown short code returns HTTP 404. Automatic redirect following
was disabled during verification so the 307 response could be inspected.

#### Day 3 commit message

The focused commit message is:

`feat: implement shorten and redirect endpoints`

The plural `endpoints` is correct because Day 3 added both the shorten and
redirect routes.

## Day 4 — Build the Diary

### Recall

- HTTP 307 is temporary, so browsers and intermediaries should continue
  requesting the application instead of permanently caching the destination
  like a 301 may be cached.
- On a Redis miss, the redirect route queries PostgreSQL, repopulates Redis
  after finding the URL, and returns HTTP 307.

### Planned topics

- Record click events without delaying the redirect
- FastAPI background tasks
- Analytics read endpoints
- Timing and click-count verification

### Notes

_To be filled in during Day 4._

#### Background-task decision

Click recording will use FastAPI `BackgroundTasks`. This integrates directly
with the existing FastAPI route and demonstrates returning the 307 redirect
before the analytics insert. The accepted limitation is that the task runs in
the application process; a crash after the response can lose the click event.

#### Identity-column implementation correction

The first `/shorten` write failed because `links.id` was defined as
`GENERATED ALWAYS AS IDENTITY`, while the sequence-first workflow explicitly
inserts the ID it reserved with `nextval`. The project keeps this workflow and
uses `GENERATED BY DEFAULT AS IDENTITY` instead. PostgreSQL still generates
IDs when an insert omits `id`, while the application may insert a value
obtained from PostgreSQL's sequence.

Migration `migrations/003_allow_reserved_identity_ids.sql` applies this
change to the already-created table. The tradeoff is that application code
has more responsibility not to invent arbitrary IDs; this code uses only
values returned by the PostgreSQL sequence. The failed request may leave a
sequence gap, which is harmless because IDs are identifiers, not a count of
successful links.

After applying migration 003, the `POST /shorten` request succeeded. The
sequence-first flow now reserves a PostgreSQL ID, converts it to Base62,
inserts the link row, and returns the short-link response.

#### Redirect cache decisions

The redirect path will check Redis first, fall back to PostgreSQL on a cache
miss, and repopulate Redis after a successful database lookup. Redis is
best-effort: connection or timeout errors should be surfaced/logged clearly
while the application continues to PostgreSQL, rather than making a healthy
database unavailable because the cache is down.

`backend/app/cache.py` uses the asynchronous `redis` client. It stores each
mapping under a namespaced key `short:<short_code>`, with the long URL as the
value and a 24-hour expiration (`ex` in seconds). The Redis server was
verified locally with `redis-cli ping`, which returned `PONG`.

#### Redirect implementation

`backend/app/routers/redirect.py` checks Redis first. When
`cached_url is not None`, the short code was found in Redis, so PostgreSQL is
skipped and the application returns a 307 redirect immediately. On a cache
miss, or after a caught Redis connection error, the route queries PostgreSQL,
returns a 404 for an unknown code, repopulates Redis when a row is found, and
returns the same 307 redirect.

Redis errors are logged and treated as cache misses so a healthy PostgreSQL
database can keep redirects working. The 307 status makes the browser ask the
server again on later visits; it does not itself record analytics, which is
reserved for the Day 4 background click task.

#### Cache-hit and cache-miss analytics flow

On a Redis cache hit, Redis supplies the `long_url`, and the application
decodes the Base62 `short_code` back into the numeric `link_id`. This avoids a
PostgreSQL lookup before scheduling the click task.

On a Redis cache miss, or when Redis is unavailable, the application queries
PostgreSQL for both `id` and `long_url`. The `long_url` is used for the 307
redirect, while `id` is used as the `clicks.link_id` foreign key. The mapping
is then placed back into Redis when possible.

Base62 decoding processes characters left to right using
`value = value * 62 + digit`, because each new digit shifts the previous
value by one Base62 position. Invalid codes are treated as 404 responses
because they identify no valid resource, rather than as server failures.

#### Analytics read endpoints

The dashboard API uses two focused endpoints:

- `GET /analytics/{short_code}/total` returns the total click count.
- `GET /analytics/{short_code}/daily` returns one count per calendar day and
  accepts optional inclusive `from` and `to` dates. Without dates it returns
  all available days; an inverted range returns HTTP 422.

The daily query groups click timestamps by their calendar date so `COUNT(*)`
produces one value per day, then orders the dates chronologically for chart
display. A shared link lookup returns 404 when the short code does not exist.

#### Analytics date-filter debugging

The first daily analytics query failed with PostgreSQL's
`timestamp with time zone < interval` error because nullable date parameters
combined with `:to_date + INTERVAL '1 day'` led PostgreSQL to infer an
incompatible type. The fix computes typed UTC timestamp boundaries in Python:
the `from` date is inclusive at midnight, and the `to` date becomes an
exclusive boundary at midnight on the following day. PostgreSQL then compares
`clicked_at` with timestamps rather than an interval.

PostgreSQL then reported an ambiguous parameter type because nullable bind
parameters were used in `:from_timestamp IS NULL` and `:to_timestamp IS NULL`.
The query now explicitly casts both parameters to `TIMESTAMPTZ`, so PostgreSQL
can type the null checks and timestamp comparisons consistently.

After explicitly casting the optional parameters, the daily analytics endpoint
worked for requests without dates and with valid date ranges. Inverted date
ranges are rejected with HTTP 422, and the total endpoint returns the count
from the `clicks` table. Day 4 now includes background click recording and
focused total/daily analytics endpoints suitable for the future React
dashboard.

## Day 5 — Build the Shop Window

### Recall

- Click recording is scheduled as background work so the visitor receives the
  redirect without waiting for the analytics insert.
- `/analytics/{short_code}/total` returns the total count, while
  `/analytics/{short_code}/daily` returns daily counts with optional date
  filters and a default of all available data.
- If Redis is stopped, the client raises a connection error. The route logs
  it, treats Redis as unavailable, falls back to PostgreSQL, and can still
  redirect if PostgreSQL is healthy.

### Planned topics

- React dashboard
- Clicks over time
- Top links
- Chaos and failure testing

### Notes

_To be filled in during Day 5._

#### Day 4 commit message

`feat: add background click analytics`

This uses imperative wording (`add`) and identifies the completed feature.

Because the selected interpreter is Python 3.9, response annotations using
`int | str` were replaced with `typing.Union[int, str]`; this changed only
runtime annotation compatibility, not endpoint behavior.

#### Click-recording verification

Redirect requests were tested with redirect following disabled, and the
background task inserted click rows into PostgreSQL. Repeated visits produced
analytics rows, while a fake short code produced the expected error response.
The redirect response is returned before the click insert is awaited by the
visitor-facing request.

#### Health-route verification

The first server attempt failed with `ModuleNotFoundError: No module named
'app'` because Uvicorn was started from the project root while the `app`
package is inside `backend`. Running the command from the `backend` directory
made `app.main:app` importable. The verification then succeeded:

- `GET /health` returned `{"status": "ok"}`.
- An unknown route returned FastAPI's 404 response
  `{"detail": "Not Found"}`.

The lesson is that the module path in `app.main:app` is resolved relative to
the command's working directory.

---

## Day 4 — Build the Diary

### Planned topics

- Click-event recording
- Background or asynchronous work
- Ensuring the visitor does not wait for the analytics write
- Failure behavior for analytics recording

### Notes

_To be filled in during Day 4._

---

## Day 5 — Build the Shop Window

### Planned topics

- React dashboard
- Clicks over time
- Top links
- Deliberate failure testing
- Redis outage behavior
- Redirect load testing
- Fake short-code behavior

### Notes

_To be filled in during Day 5._

---

## Final revision checklist

- [ ] Explain the six core ideas in one plain sentence each.
- [ ] Explain the create-link workflow without notes.
- [ ] Explain the cache-hit and cache-miss redirect workflows.
- [ ] Justify every major design decision in one sentence.
- [ ] Explain the sequential-ID/Base62 tradeoff.
- [ ] Explain why redirect responses must not wait for analytics writes.
- [ ] Modify the project live for three minutes without AI assistance.
