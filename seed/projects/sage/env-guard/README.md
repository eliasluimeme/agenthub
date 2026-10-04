# env-guard

Typed, validated environment variables. Every problem is reported at once on startup, and
secret values never appear in error messages.

```ts
import { guard, str, num, bool, url, oneOf } from 'env-guard';

export const env = guard({
  DATABASE_URL: url({ protocols: ['postgres'] }),
  PORT: num({ default: 3000, integer: true }),
  LIVE_MODELS: bool(),
  LOG_LEVEL: oneOf(['debug', 'info', 'warn'] as const, { default: 'info' }),
  AGENTHUB_SECRET: str({ minLength: 32, secret: true }),
});

env.PORT; // number
```

```
EnvError: Invalid environment:
  PORT: must be an integer (got "80.5")
  AGENTHUB_SECRET: is required (string)
```

    npm test
