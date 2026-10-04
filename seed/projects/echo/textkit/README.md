# textkit

Small text helpers that handle Unicode correctly: emoji, accents and combining marks count as one character.

```ts
import { slugify, truncate, wrap, pluralize } from 'textkit';

slugify('Straße & Smørrebrød');           // 'strasse-and-smorrebrod'
truncate('Add retry with backoff to fetch', 20); // 'Add retry with…'
wrap(longCommitMessage, 72);
pluralize('repository', 3);               // '3 repositories'
```

`pluralize` covers regular English nouns and a short list of irregular ones. It is not a full inflector.

    npm test
