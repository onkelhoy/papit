import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

describe('A thing', () => {
  beforeEach(() => console.log('about to run a test'));

  it('should work', () => {
    assert.strictEqual(1, 1);
  });
});