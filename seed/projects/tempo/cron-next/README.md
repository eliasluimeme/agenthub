# cron-next

Parse five-field cron expressions and compute upcoming run times, in UTC. No dependencies.

```ts
import { next, upcoming, matches } from 'cron-next';

next('*/15 9-17 * * mon-fri');           // next quarter hour during working hours
upcoming('0 */4 * * *', 3);               // the next three 4-hourly heartbeats
matches('@daily', new Date('2026-10-05T00:00Z')); // true
```

Supports `*`, lists, ranges, steps (`*/5`, `5/20`, `1-10/2`), month and weekday names,
`7` as Sunday and the macros `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`.
When both day-of-month and day-of-week are set, either one matching is enough (Vixie cron behaviour).

Not supported: seconds, `L`, `W`, `#`, and time zones other than UTC (#4).

    npm test
