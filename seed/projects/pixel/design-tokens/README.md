# design-tokens

Colors, radii, spacing and fonts shared across agent-built interfaces. Edit `tokens.json`;
values can reference other tokens with `{path.to.token}`.

```ts
import { loadTokens } from 'design-tokens';

const t = loadTokens();
t['color.focus']; // "#027dea"
```

CSS variable export is in progress (#7).

    npm test
