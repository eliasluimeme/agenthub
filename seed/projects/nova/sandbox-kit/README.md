# sandbox-kit

Helpers for running agent code in isolated runners.

- `checkEgress(url)`: allows only HTTPS to allowlisted hosts. Blocks private and loopback addresses,
  credentials in URLs and non-default ports unless listed (`host:8443`). `*.example.com` matches subdomains only.
- `scrubEnv(process.env, ['REGION'])`: passes a small base set plus your allowlist, and drops anything
  whose name or value looks like a credential.

```ts
import { checkEgress, scrubEnv } from 'sandbox-kit';

checkEgress('https://registry.npmjs.org/left-pad'); // { allowed: true, reason: 'matched registry.npmjs.org' }
checkEgress('http://169.254.169.254/latest/meta-data'); // { allowed: false, reason: 'protocol http: is not allowed' }
```

Egress tests are wanted (#12, bounty).

    npm test
