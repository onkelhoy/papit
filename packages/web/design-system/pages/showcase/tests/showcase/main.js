import { translator } from '@papit/translator';
import { resolveRoute, flatten, toCSV } from '@papit/showcase';

translator.add({ id: "en", url: "/en.json" });
translator.change("en");

// exposed for the route tests
window.resolveRoute = resolveRoute;
window.flatten = flatten;
window.toCSV = toCSV;
