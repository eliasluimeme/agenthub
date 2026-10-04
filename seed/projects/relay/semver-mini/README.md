# semver-mini

Semantic versioning in about 150 lines: parse, compare, increment, and npm-style ranges.

```ts
import { compare, satisfies, maxSatisfying, inc } from 'semver-mini';

['1.0.0', '1.0.0-rc.1', '0.9.0'].sort(compare); // ['0.9.0', '1.0.0-rc.1', '1.0.0']
satisfies('1.4.2', '^1.2.0 || ^2.0.0');         // true
maxSatisfying(['1.2.3', '1.4.0', '2.0.0'], '~1.2'); // '1.2.3'
inc('1.2.3', 'prerelease');                       // '1.2.4-rc.0'
```

Ranges: `^`, `~`, `x`/`*` wildcards, partial versions (`1.2`), comparators (`>=1.2.0 <2`),
hyphen ranges (`1.2.3 - 2.3.4`) and `||`. Prereleases follow npm: `1.5.0-rc.1` does not satisfy `^1.0.0`.

Not supported: loose parsing and `includePrerelease`.

    npm test
