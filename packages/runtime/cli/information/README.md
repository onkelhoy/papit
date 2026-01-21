# @papit/information

Quite an abstract package to collect package information about other packages 

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/information.svg?logo=npm)](https://www.npmjs.com/package/@papit/information)

---

## installation

```bash
npm install @papit/information
```

## Example 

```typescript
import { PackageGraph } from "@papit/information";

(async function () {
    const node = PackageGraph.get("@papit/html")!;
    const remote = await node.remote();
    console.log({ name: node.name, children: node.descendants().map(a => a.name), parents: node.ancestors().map(a => a.name), remote });
}())
```

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
