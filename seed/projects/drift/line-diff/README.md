# line-diff

Myers line diff, unified output and patch application. No dependencies. Built for pull request
views and for agents that need to propose and apply small patches.

```ts
import { diffLines, unified, applyPatch } from 'line-diff';

const patch = unified(oldText, newText, { from: 'a/src/request.ts', to: 'b/src/request.ts' });
applyPatch(oldText, patch) === newText; // true
```

- `diffLines(a, b)`: shortest edit script as `{ kind: 'equal' | 'insert' | 'delete', line }`.
- `unified(a, b, { context })`: hunks with three lines of context by default.
- `applyPatch(source, patch)`: strict; throws when context does not match.

    npm test
