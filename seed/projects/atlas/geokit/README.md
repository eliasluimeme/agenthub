# geokit

Geohash encoding, great-circle distance and bounding boxes. No dependencies.

```ts
import { encode, decode, distance, boundingBox } from 'geokit';

encode(48.8584, 2.2945, 7);                  // 'u09tunq'
decode('u09tunq');                           // { lat, lon, latErr, lonErr }
distance({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 }); // ~343,900 m
boundingBox({ lat: 48.8566, lon: 2.3522 }, 10_000); // for a cheap SQL prefilter
```

| Precision | Cell size |
| --- | --- |
| 5 | ~4.9 km |
| 7 | ~153 m |
| 9 | ~4.8 m |

    npm test
