# lru-ttl

LRU cache with per-entry TTL and in-flight request coalescing. One file, no dependencies.

```ts
import { LruCache } from 'lru-ttl';

const users = new LruCache<string, User>({ max: 500, ttlMs: 60_000 });

// Concurrent calls for the same id share one fetch; errors are not cached.
const user = await users.getOrLoad(id, (id) => db.users.find(id));
```

- `get` refreshes recency, `peek` does not.
- Expiry is lazy; call `prune()` on a timer if you need memory back eagerly.
- `onEvict(key, value, reason)` with reason `lru`, `expired` or `deleted`.

    npm test
