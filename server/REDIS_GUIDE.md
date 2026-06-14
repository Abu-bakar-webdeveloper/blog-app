# Redis Master Guide — From Beginner to Advanced

> A practical guide built around **your blog-app**. Every concept ties back to real code you already have running.

---

## Table of Contents

1. [What Is Redis?](#1-what-is-redis)
2. [Why Your App Uses Redis](#2-why-your-app-uses-redis)
3. [Your Setup (Docker + ioredis)](#3-your-setup-docker--ioredis)
4. [Beginner: Core Concepts](#4-beginner-core-concepts)
5. [Beginner: Your First Cache Flow](#5-beginner-your-first-cache-flow)
6. [Beginner: Redis CLI Hands-On](#6-beginner-redis-cli-hands-on)
7. [Intermediate: Cache Patterns in Your App](#7-intermediate-cache-patterns-in-your-app)
8. [Intermediate: Key Naming & TTL Strategy](#8-intermediate-key-naming--ttl-strategy)
9. [Intermediate: Cache Invalidation](#9-intermediate-cache-invalidation)
10. [Intermediate: What NOT to Cache](#10-intermediate-what-not-to-cache)
11. [Advanced: Redis Data Structures](#11-advanced-redis-data-structures)
12. [Advanced: Production Best Practices](#12-advanced-production-best-practices)
13. [Advanced: Use Cases Beyond Caching](#13-advanced-use-cases-beyond-caching)
14. [Debugging & Monitoring](#14-debugging--monitoring)
15. [Common Mistakes & How to Fix Them](#15-common-mistakes--how-to-fix-them)
16. [Learning Roadmap & Exercises](#16-learning-roadmap--exercises)
17. [Quick Reference Cheat Sheet](#17-quick-reference-cheat-sheet)

---

## 1. What Is Redis?

**Redis** = **RE**mote **DI**ctionary **S**erver.

Think of it as a **super-fast in-memory database** that lives beside your main database (PostgreSQL in your app).

| PostgreSQL (your `db` service) | Redis (your `redis_cache` service) |
|-------------------------------|-------------------------------------|
| Permanent storage on disk     | Fast storage in RAM                 |
| Complex queries (JOIN, filter)| Simple key → value lookups          |
| Slower for repeated reads     | Microsecond read speed              |
| Source of truth               | Temporary / derived data            |

Redis is **not a replacement** for PostgreSQL. It is a **helper** that makes your API faster by remembering expensive query results for a short time.

---

## 2. Why Your App Uses Redis

Without cache, every `GET /api/blogs` request:

```
Client → Express → Prisma → PostgreSQL → response (slow, repeated work)
```

With cache (what you built):

```
Client → Express → Redis (hit!) → response (fast)
Client → Express → Redis (miss) → PostgreSQL → store in Redis → response
```

**Your app caches these read-heavy endpoints:**

| Endpoint | Cache key pattern | TTL |
|----------|-------------------|-----|
| `GET /api/blogs` | `blog:list:...` | 60s |
| `GET /api/blogs/:id` | `blog:detail:{idOrSlug}` | 5 min |
| `GET /api/blogs/:id/comments` | `blog:comments:{id}:{page}:{limit}` | 60s |
| `GET /api/blogs/:id/likes/count` | `blog:likes:count:{id}` | 60s |
| `GET /api/blogs/stats/dashboard` | `blog:stats` | 2 min |
| `GET /api/users/:id/profile` | `user:profile:{id}` | 5 min |
| `GET /api/reports/stats` | `report:stats` | 2 min |

---

## 3. Your Setup (Docker + ioredis)

### Docker Compose

Your Redis container is defined in `docker-compose.yml`:

```yaml
redis:
  image: redis:7
  container_name: redis_cache
  restart: always
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

- **Port 6379** — default Redis port
- **Volume `redis_data`** — data survives container restarts (optional persistence)
- **`depends_on: redis`** on your app — Node starts after Redis is available

### Node.js connection

File: `server/src/config/redis.js`

```js
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;
```

**What happens here:**
1. `ioredis` opens a TCP connection to Redis
2. Your `.env` provides `REDIS_HOST=redis` (Docker service name) and `REDIS_PORT=6379`
3. One shared client is reused across all requests (good practice)

### Cache utility layer

File: `server/src/utils/cache.js`

This is your **single place** for all Redis cache logic — keys, get/set, delete, invalidation. Services never talk to Redis directly; they use these helpers.

---

## 4. Beginner: Core Concepts

### 4.1 Key-Value Store

Redis stores everything as:

```
KEY  →  VALUE
```

Example in your app:

```
blog:detail:how-to-master-prisma-orm-98  →  {"id":"cmp9...","title":"How to Master Prisma ORM",...}
blog:likes:count:cmp9o820s002pjt3qgi4vhtgy  →  42
blog:stats  →  {"totalBlogs":100,"publishedBlogs":81,...}
```

### 4.2 TTL (Time To Live)

Every cached key can **expire automatically**.

In your code:

```js
await redis.set(key, JSON.stringify(value), "EX", ttl);
//                                      ↑      ↑
//                                   EX = seconds   TTL value
```

Your TTL constants (`cache.js`):

```js
export const CACHE_TTL = {
  SHORT: 60,      // 1 minute  — lists, counts (change often)
  MEDIUM: 300,    // 5 minutes — single blog, user profile
  STATS: 120,      // 2 minutes — dashboard aggregates
};
```

**Why TTL matters:** Even if you forget to invalidate, stale data disappears on its own.

### 4.3 Cache Hit vs Cache Miss

| Term | Meaning |
|------|---------|
| **Cache hit** | Key exists in Redis → return immediately, skip DB |
| **Cache miss** | Key not found → query DB → save to Redis → return |

From `blog.service.js` — `getBlogs`:

```js
const cacheKey = CACHE_KEYS.blogsList(filters, page, limit);
const cachedBlogs = await getCache(cacheKey);

if (cachedBlogs) {
  return cachedBlogs;  // ← CACHE HIT
}

// ... query PostgreSQL ...

await setCache(cacheKey, result, CACHE_TTL.SHORT);  // ← store for next time
return result;
```

### 4.4 Serialization (JSON)

Redis only stores **strings**. Objects must be converted:

```js
// WRITE
await redis.set(key, JSON.stringify(value), "EX", ttl);

// READ
const data = await redis.get(key);
return data ? JSON.parse(data) : null;
```

Your `getCache` / `setCache` wrap this for you.

---

## 5. Beginner: Your First Cache Flow

Let's trace **one full request** for `GET /api/blogs?page=1&limit=10`.

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│ Client  │────▶│ blog.routes  │────▶│ blog.service│────▶│ cache.js   │
└─────────┘     └──────────────┘     └─────────────┘     └────────────┘
                                              │                  │
                                              │                  ▼
                                              │            ┌──────────┐
                                              │            │  Redis   │
                                              │            └──────────┘
                                              ▼
                                       ┌────────────┐
                                       │ PostgreSQL │  (only on miss)
                                       └────────────┘
```

**Step by step:**

1. Route calls `getBlogs(filters, 1, 10)`
2. Build key: `blog:list:{"sortOrder":"desc"}:1:10`
3. `getCache(key)` → Redis `GET blog:list:...`
4. **If found:** return JSON (done in ~1ms)
5. **If not found:** run Prisma query, build result object
6. `setCache(key, result, 60)` → Redis `SET ... EX 60`
7. Return result to client

**Second request within 60 seconds:** step 4 only — no PostgreSQL.

---

## 6. Beginner: Redis CLI Hands-On

Connect to your running Redis container:

```bash
docker exec -it redis_cache redis-cli
```

### Essential commands

```bash
# List all keys (OK for dev, avoid in production on large datasets)
KEYS *

# Get a specific key
GET "blog:stats"

# Check if key exists (returns 1 or 0)
EXISTS "blog:stats"

# See remaining TTL in seconds (-1 = no expiry, -2 = key doesn't exist)
TTL "blog:stats"

# Delete one key
DEL "blog:stats"

# Delete all keys (DANGER — dev only!)
FLUSHALL

# Monitor every command in real time (great for learning)
MONITOR

# Server info
INFO memory
INFO stats
```

### Exercise: watch your cache work

1. Start your app (`docker-compose up`)
2. In one terminal: `docker exec -it redis_cache redis-cli MONITOR`
3. In another: `curl http://localhost:3000/api/blogs?page=1&limit=2`
4. You'll see: `GET blog:list:...` then `SET blog:list:... EX 60`
5. Call the same URL again — only `GET`, no `SET` (cache hit)

---

## 7. Intermediate: Cache Patterns in Your App

### 7.1 Cache-Aside (Lazy Loading) — what you use

**Pattern:** Application checks cache first; on miss, loads from DB and fills cache.

Used in: `getBlogs`, `getBlogById`, `getBlogComments`, `getLikesCount`, `getUserProfile`, `getBlogStats`

```js
// 1. Try cache
const cached = await getCache(key);
if (cached) return cached;

// 2. Load from DB
const data = await prisma....;

// 3. Store in cache
await setCache(key, data, TTL);

// 4. Return
return data;
```

**Pros:** Simple, cache only what's requested, survives Redis restarts (just more DB load).  
**Cons:** You must handle invalidation yourself.

### 7.2 Write-Through invalidation — what you use on mutations

When data **changes**, you **delete** related cache keys so the next read gets fresh data.

From `createBlog` in `blog.service.js`:

```js
const blog = await prisma.blog.create({ ... });

await invalidateBlogCaches(blog);  // ← clear stale cache

return blog;
```

From `like.service.js` — after toggle:

```js
await Promise.all([
  invalidateBlogLikesCount(blogId),
  invalidateBlogCaches(blog),
  invalidateBlogListCaches(),
  invalidateBlogStats(),
  invalidateUserProfile(userId),
]);
```

### 7.3 Dual-key caching — slug + ID

`getBlogById` accepts either ID or slug. You cache **both** keys pointing to the same blog:

```js
if (blog.isPublished) {
  await setCache(CACHE_KEYS.blogDetail(blog.id), blog, CACHE_TTL.MEDIUM);
  await setCache(CACHE_KEYS.blogDetail(blog.slug), blog, CACHE_TTL.MEDIUM);
}
```

So `GET /api/blogs/how-to-master-prisma-orm-98` and `GET /api/blogs/cmp9o820s...` both hit cache.

### 7.4 Cache with side effects — view counter

When serving a cached blog, you still increment views in the background:

```js
if (cachedBlog) {
  prisma.blog
    .update({
      where: { id: cachedBlog.id },
      data: { views: { increment: 1 } },
    })
    .catch(() => {});

  return cachedBlog;
}
```

**Trade-off:** Response is fast; the `views` number in the JSON may be slightly stale until cache expires. Analytics stay accurate in the DB.

### 7.5 Caching zero values

For likes count, `0` is valid. Don't use falsy check:

```js
// ❌ WRONG — 0 is falsy, would re-query DB every time
if (cachedCount) return cachedCount;

// ✅ CORRECT — your code
if (cachedCount !== null) return cachedCount;
```

---

## 8. Intermediate: Key Naming & TTL Strategy

### 8.1 Key naming convention

Your pattern: `{resource}:{action}:{identifiers}`

```js
export const CACHE_KEYS = {
  blogsList: (filters, page, limit) =>
    `blog:list:${JSON.stringify(filters)}:${page}:${limit}`,
  blogDetail: (idOrSlug) => `blog:detail:${idOrSlug}`,
  blogComments: (blogId, page, limit) =>
    `blog:comments:${blogId}:${page}:${limit}`,
  blogLikesCount: (blogId) => `blog:likes:count:${blogId}`,
  blogStats: () => "blog:stats",
  userProfile: (userId) => `user:profile:${userId}`,
};
```

**Rules:**
- Use `:` as separator (Redis community standard)
- Prefix by domain (`blog:`, `user:`, `report:`)
- Include everything that makes the response unique (filters, page, limit)
- Keep keys predictable for pattern deletion (`blog:list:*`)

### 8.2 Choosing TTL

| Data type | TTL | Reason |
|-----------|-----|--------|
| Paginated lists | 60s | Changes frequently, many key variants |
| Single entity (blog, profile) | 5 min | Changes less often |
| Aggregates (stats dashboard) | 2 min | Expensive query, OK if slightly stale |
| User-specific (`checkLike`) | Don't cache | Per-user, changes on every action |

**Formula:** `TTL = acceptable staleness × safety factor`

If blog lists can be 30s stale → TTL 60s is safe.

---

## 9. Intermediate: Cache Invalidation

> *"There are only two hard things in Computer Science: cache invalidation and naming things."*

### 9.1 Single-key delete

```js
export const deleteCache = async (key) => {
  await redis.del(key);
};
```

Used for: `blog:stats`, `user:profile:{id}`, `blog:likes:count:{id}`

### 9.2 Pattern delete with SCAN

You can't know every list key (infinite filter/page combos). Delete by pattern:

```js
export const deleteCacheByPattern = async (pattern) => {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor, "MATCH", pattern, "COUNT", 100
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
};
```

**Why SCAN not KEYS?**
- `KEYS *` blocks Redis — bad in production
- `SCAN` iterates in small batches — safe

Examples in your app:

```js
invalidateBlogListCaches()     // blog:list:*
invalidateBlogComments(blogId) // blog:comments:{blogId}:*
invalidateReportsList()        // report:list:*
```

### 9.3 Invalidation map (your app)

| Event | What gets invalidated |
|-------|----------------------|
| Create/update/delete blog | All blog lists, detail (id+slug), comments, likes count, stats, author profile |
| Create/update/delete comment | Comments for that blog, blog detail, lists, stats |
| Toggle like | Likes count, blog detail, lists, stats, user profile |
| Update user profile | User profile, admin user list |
| Create/update report | Report list, report stats |

### 9.4 `invalidateBlogCaches` — the orchestrator

```js
export const invalidateBlogCaches = async (blog) => {
  await Promise.all([
    invalidateBlogListCaches(),
    invalidateBlogDetail(blog.id, blog.slug),
    invalidateBlogComments(blog.id),
    invalidateBlogLikesCount(blog.id),
    invalidateBlogStats(),
    blog.authorId ? invalidateUserProfile(blog.authorId) : Promise.resolve(),
  ]);
};
```

One function call after any blog mutation keeps everything consistent.

---

## 10. Intermediate: What NOT to Cache

Your app correctly **skips** caching for:

| Endpoint | Why |
|----------|-----|
| `POST /auth/login` | Security — never cache credentials/tokens |
| `GET /blogs/:id/likes/check` | User-specific, low reuse across requests |
| `GET /users/likes`, `/users/comments` | Per-user paginated data, invalidation complexity |
| Unpublished blogs | Access control — only admins/authors should see |
| Write operations (POST/PUT/DELETE) | Mutations go to DB, then invalidate cache |

**Rule of thumb:** Cache when the **same data** is read by **many users** and **changes infrequently** relative to read frequency.

---

## 11. Advanced: Redis Data Structures

Your app uses **Strings** (via `SET`/`GET` + JSON). Redis offers more:

### 11.1 String (what you use)

```bash
SET blog:stats '{"totalBlogs":100}' EX 120
GET blog:stats
INCR page:views:homepage    # atomic counter
INCRBY blog:likes:count:abc 5
```

**Upgrade idea for likes:** Instead of caching the count as JSON, use native `INCR`/`DECR` on like toggle — no invalidation needed for count key.

### 11.2 Hash — object fields

```bash
HSET user:profile:123 name "John" bio "Developer" avatar "url"
HGET user:profile:123 name
HGETALL user:profile:123
```

Good when you update **one field** without rewriting the whole object.

### 11.3 List — ordered collection

```bash
LPUSH notifications:user:123 "New comment on your blog"
LRANGE notifications:user:123 0 9   # last 10
```

Use for: activity feeds, recent items.

### 11.4 Set — unique members

```bash
SADD blog:liked-by:abc user1 user2 user3
SISMEMBER blog:liked-by:abc user1   # check like — O(1)
SCARD blog:liked-by:abc             # count
```

Use for: "who liked this blog" without hitting PostgreSQL.

### 11.5 Sorted Set — ranked data

```bash
ZADD leaderboard 100 "user:123" 85 "user:456"
ZREVRANGE leaderboard 0 9 WITHSCORES   # top 10
```

Use for: trending blogs, leaderboards.

### 11.6 When to stay with JSON strings (your approach)

JSON strings are fine when:
- You cache whole API responses
- Team is small and pattern is consistent
- Invalidation is clear

Move to native structures when:
- You need atomic increments (`INCR`)
- Partial updates are frequent
- Memory efficiency matters at scale

---

## 12. Advanced: Production Best Practices

### 12.1 Connection settings (improve your `redis.js`)

```js
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,  // always in production
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  lazyConnect: false,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});
```

### 12.2 Graceful degradation

If Redis is down, your API should still work (slower):

```js
export const getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Redis get failed:", err.message);
    return null;  // fall through to DB
  }
};
```

### 12.3 Memory limits & eviction

In production `redis.conf`:

```
maxmemory 256mb
maxmemory-policy allkeys-lru
```

When full, Redis removes **least recently used** keys. TTL still helps — LRU is the safety net.

### 12.4 Never use KEYS in production

Your `deleteCacheByPattern` already uses `SCAN`. Keep it that way.

### 12.5 Pipelining for bulk operations

When invalidating many keys:

```js
const pipeline = redis.pipeline();
keys.forEach((key) => pipeline.del(key));
await pipeline.exec();
```

Faster than individual `del` calls.

### 12.6 Cache stampede protection

When a popular key expires, many requests may hit DB at once.

**Fix:** mutex / lock per key:

```js
const lockKey = `lock:${cacheKey}`;
const acquired = await redis.set(lockKey, "1", "EX", 10, "NX");
if (!acquired) {
  // another request is rebuilding — wait and retry getCache
}
```

Consider this when traffic grows.

### 12.7 Security

| Practice | Your app |
|----------|----------|
| Password auth | Add `REDIS_PASSWORD` in production |
| Bind to private network | Docker internal network only |
| No sensitive data in cache | Don't cache JWTs, passwords, private drafts |
| ACLs (Redis 6+) | Separate read/write users in production |

---

## 13. Advanced: Use Cases Beyond Caching

Your app currently uses Redis for **caching only**. Here is what you can add next:

### 13.1 Rate limiting

Limit login attempts or API abuse:

```js
const key = `ratelimit:${ip}:login`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 5) throw new Error("Too many attempts");
```

### 13.2 Session store

Store JWT blocklist or session IDs:

```js
await redis.set(`session:${userId}`, sessionId, "EX", 86400);
```

### 13.3 Pub/Sub — real-time notifications

```js
// Publisher (after new comment)
await redis.publish("blog:comments", JSON.stringify({ blogId, comment }));

// Subscriber (WebSocket server)
redis.subscribe("blog:comments");
redis.on("message", (channel, message) => { /* push to clients */ });
```

### 13.4 Job queues (with Bull/BullMQ)

Background jobs: send emails, process images, rebuild search index.

```js
import { Queue } from "bullmq";
const emailQueue = new Queue("email", { connection: redis });
await emailQueue.add("welcome", { userId });
```

### 13.5 Distributed locks

Ensure only one instance runs a cron job:

```js
const locked = await redis.set("lock:daily-stats", "1", "EX", 300, "NX");
if (locked) await rebuildStats();
```

### 13.6 Leaderboard for trending blogs

Replace expensive `ORDER BY views` with sorted sets updated on each view.

---

## 14. Debugging & Monitoring

### 14.1 Check what's cached

```bash
docker exec -it redis_cache redis-cli

KEYS blog:*
TTL blog:detail:some-slug
GET blog:likes:count:some-id
```

### 14.2 Memory usage

```bash
INFO memory
# used_memory_human:2.50M
```

### 14.3 Hit rate (Redis 4+)

```bash
INFO stats
# keyspace_hits:1500
# keyspace_misses:200
# hit rate = hits / (hits + misses)
```

Target **>80% hit rate** on heavily cached endpoints.

### 14.4 Add optional debug logging (dev only)

```js
export const getCache = async (key) => {
  const data = await redis.get(key);
  if (process.env.NODE_ENV === "development") {
    console.log(data ? `[CACHE HIT] ${key}` : `[CACHE MISS] ${key}`);
  }
  return data ? JSON.parse(data) : null;
};
```

### 14.5 Verify invalidation works

1. `GET /api/blogs` — note response
2. `redis-cli KEYS "blog:list:*"` — see keys
3. `PUT /api/blogs/:id` (admin) — update a blog
4. `redis-cli KEYS "blog:list:*"` — keys should be gone
5. `GET /api/blogs` — fresh data from DB, new cache key

---

## 15. Common Mistakes & How to Fix Them

| Mistake | Problem | Fix (your app) |
|---------|---------|----------------|
| Cache without TTL | Memory grows forever | Always use `EX` in `setCache` |
| Cache without invalidation | Stale data forever | Call `invalidate*` on writes |
| `if (cached)` for count `0` | Zero never cached | Use `!== null` check |
| `KEYS *` in production | Blocks Redis | Use `SCAN` (you do) |
| Cache user-specific data globally | User A sees User B's data | Don't cache `/likes/check` |
| Cache before transaction commits | Race condition | Invalidate **after** DB write succeeds |
| Same key for different shapes | Corrupt reads | Include filters/page in key |
| Caching errors | 500 responses cached | Only cache successful results |
| No error handling on Redis | App crashes if Redis down | try/catch in getCache/setCache |

---

## 16. Learning Roadmap & Exercises

### Level 1 — Beginner (Week 1)

- [ ] Run `redis-cli MONITOR` while hitting your API
- [ ] Manually `GET` / `DEL` keys and see API behavior change
- [ ] Explain cache hit vs miss to someone using your `getBlogs` code
- [ ] Read `cache.js` top to bottom

### Level 2 — Intermediate (Week 2)

- [ ] Trace invalidation: create blog → verify `blog:list:*` keys deleted
- [ ] Add dev-only `[CACHE HIT/MISS]` logging to `getCache`
- [ ] Change TTL values and observe staleness vs DB load
- [ ] Draw invalidation diagram for comment create

### Level 3 — Advanced (Week 3–4)

- [ ] Refactor likes count to use `INCR`/`DECR` instead of JSON cache
- [ ] Add try/catch graceful degradation to `getCache`/`setCache`
- [ ] Implement rate limiting on `/auth/login` with Redis
- [ ] Add `redis.conf` with `maxmemory` and `allkeys-lru` to Docker
- [ ] Build a `/api/health/redis` endpoint that pings Redis

### Level 4 — Master (Ongoing)

- [ ] Read Redis docs on persistence (RDB vs AOF)
- [ ] Study Redis Cluster for horizontal scaling
- [ ] Explore BullMQ for background jobs
- [ ] Benchmark: ab/wrk with and without cache
- [ ] Implement cache stampede lock on `getBlogStats`

---

## 17. Quick Reference Cheat Sheet

### Your file map

| File | Role |
|------|------|
| `docker-compose.yml` | Runs Redis container |
| `src/config/redis.js` | ioredis connection |
| `src/utils/cache.js` | Keys, TTL, get/set, invalidation |
| `src/services/blog.service.js` | List + detail + stats caching |
| `src/services/comment.service.js` | Comments cache + invalidation |
| `src/services/like.service.js` | Likes count cache + invalidation |
| `src/services/user.service.js` | Profile + admin list cache |
| `src/services/report.service.js` | Reports cache + invalidation |
| `src/services/auth.service.js` | Profile invalidation on update |

### Redis CLI

```bash
docker exec -it redis_cache redis-cli
KEYS blog:*
GET key
TTL key
DEL key
FLUSHALL          # dev only
MONITOR
INFO memory
INFO stats
```

### ioredis (Node)

```js
await redis.get(key);
await redis.set(key, value, "EX", seconds);
await redis.del(key);
await redis.incr(key);
await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
await redis.set(key, val, "EX", 10, "NX");  // lock
```

### Cache-aside template (copy for new endpoints)

```js
export const getSomething = async (id) => {
  const cacheKey = CACHE_KEYS.something(id);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const data = await prisma.something.findUnique({ where: { id } });
  if (!data) return null;

  await setCache(cacheKey, data, CACHE_TTL.MEDIUM);
  return data;
};

export const updateSomething = async (id, data) => {
  const result = await prisma.something.update({ where: { id }, data });
  await deleteCache(CACHE_KEYS.something(id));
  return result;
};
```

---

## Summary

You already have a **solid production-style cache layer**:

1. **Centralized** helpers in `cache.js`
2. **Consistent** key naming with `CACHE_KEYS`
3. **Tiered TTLs** for different data types
4. **Write invalidation** on every mutation
5. **Safe pattern deletion** with `SCAN`
6. **Smart edge cases** (dual slug/id keys, zero count, async view increment)

Master Redis by: using `MONITOR`, breaking things in dev, then adding rate limits, queues, and native data structures as your app scales.

---

*Guide version 1.0 — aligned with blog-app Redis implementation.*
