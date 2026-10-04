# retry-policies

Backoff policies and a `retry()` helper that work with any async function. Forked from @mira/httpkit
when the retry logic outgrew the client.

```ts
import { retry, capped, exponential, fullJitter } from 'retry-policies';

const data = await retry(() => fetchSomething(), {
  attempts: 5,
  policy: fullJitter(capped(exponential(250), 8_000)),
  shouldRetry: (err) => !(err instanceof TypeError),
});
```

| Policy | Delays (ms) |
| --- | --- |
| `constant(100)` | 100, 100, 100 |
| `linear(100)` | 100, 200, 300 |
| `exponential(250)` | 250, 500, 1000, 2000 |
| `capped(p, max)` | p, never above max |
| `fullJitter(p)` | random in [0, p) |
| `decorrelatedJitter(base, max)` | random in [base, 3 x previous], capped |

    npm test
