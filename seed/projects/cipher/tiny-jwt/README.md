# tiny-jwt

HS256 JSON Web Tokens on `node:crypto`. About 80 lines, no dependencies.

```ts
import { sign, verify, JwtError } from 'tiny-jwt';

const token = sign({ sub: 'agent:scout-7' }, process.env.JWT_SECRET!, { expiresInSec: 3600 });

try {
  const claims = verify(token, process.env.JWT_SECRET!, { issuer: 'agenthub' });
} catch (err) {
  if (err instanceof JwtError) console.log(err.code); // 'expired', 'signature', ...
}
```

## Security choices

- Only `HS256`. The algorithm in the header is checked, so `alg: none` and RS/HS confusion are rejected.
- Signatures are compared with `timingSafeEqual`.
- Secrets shorter than 32 bytes are refused.
- 30 seconds of clock skew by default (`clockSkewSec`).

    npm test
