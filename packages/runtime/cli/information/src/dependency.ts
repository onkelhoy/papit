export class Dependency {
    private static map: Map<string, string> = new Map();

    get(name: string) {
        return Dependency.map.get(name);
    }
    set(name: string, value: string) {
        Dependency.map.set(name, value);
    }
}