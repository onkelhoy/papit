export class EventTargetPublic {
  private _et = new EventTarget();

  dispatchEvent(event: { type: string; }): boolean {
    return this._et.dispatchEvent(event as Event);
  }
  
  removeEventListener(type: string, listener: (event: { type: string; }) => void, options?: any): void {
    return this._et.removeEventListener(type, listener, options);
  }
  addEventListener(type: string, listener: (event: { type: string; }) => void, options?: any): void {
    return this._et.addEventListener(type, listener, options);
  }
}