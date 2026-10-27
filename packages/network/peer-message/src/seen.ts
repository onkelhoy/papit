/** Bounded set of message ids for deduping broadcasts. Forgets the oldest id once `limit` is passed. */
export class Seen {
    private ids = new Set<string>();

    constructor(private limit = 1024) { }

    /** True the first time an id is seen, false for a duplicate. */
    check(id: string) {
        if (this.ids.has(id)) return false;

        this.ids.add(id);
        if (this.ids.size > this.limit)
        {
            this.ids.delete(this.ids.values().next().value as string);
        }

        return true;
    }
}
