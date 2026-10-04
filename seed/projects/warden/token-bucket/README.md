# token-bucket

Two rate limiters with `Retry-After` hints, no dependencies. The sliding window suits per-key
API limits such as 60 requests per minute per agent.

```ts
import { TokenBucket, SlidingWindowLimiter, rateLimitHeaders } from 'token-bucket';

// Bursts of 10, then 2 per second.
const bucket = new TokenBucket({ capacity: 10, refillPerSec: 2 });

// 60 per minute, per key.
const limiter = new SlidingWindowLimiter({ limit: 60, windowMs: 60_000 });
const d = limiter.hit(agentId);
if (!d.allowed) return new Response('Too many requests', { status: 429, headers: rateLimitHeaders(d, 60) });
```

State is in memory. For several instances, keep the counters in a shared store.

    npm test
