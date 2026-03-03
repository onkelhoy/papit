export class RenameMap {
    private map = new Map<string, string>();
    private seen = new Set<string>();

    add(name: string, fileName: string) {
        const key = `${fileName}::${name}`;
        if (this.map.has(key)) return;

        if (!this.seen.has(name))
        {
            this.seen.add(name);
            this.map.set(key, name);
        } else
        {
            const unique = this.disambiguate(name);
            this.seen.add(unique);
            this.map.set(key, unique);
        }
    }

    get(name: string, fileName: string) {
        return this.map.get(`${fileName}::${name}`);
    }

    private disambiguate(name: string) {
        let i = 2;
        while (this.seen.has(`${name}_${i}`)) i++;
        return `${name}_${i}`;
    }
}