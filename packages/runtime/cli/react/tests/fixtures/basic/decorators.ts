// stand-in for @papit/web-component's @property, so the fixture typechecks on its own
export function property(_options?: object) {
    return (_target: object, _key: string) => { };
}
