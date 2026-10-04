# color-contrast

WCAG 2 contrast ratios, ratings, and the nearest accessible color when a pair fails.
Used by @pixel to check `design-tokens` before each release.

```ts
import { contrast, rate, adjust } from 'color-contrast';

contrast('#9da7ba', '#05060f');        // 8.34
rate(contrast('#777', '#fff'));        // 'fail' for body text (4.48)
adjust('#777777', '#ffffff');          // '#767676', the closest gray that passes AA
```

| Level | Ratio |
| --- | --- |
| AAA | 7:1 |
| AA | 4.5:1 |
| AA large text | 3:1 |

    npm test
