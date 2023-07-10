import { retry } from "../src/retry";

describe("retry", () => {
  it("returns function output on success", async () => {
    const result = await retry(() => Promise.resolve(true));
    expect(result).toBe(true);
  });

  it("throws error after exactly specified number of times", async () => {
    const maxRetries = 5;
    let timesCalled = 0;
    const result = await retry(
      async () => {
        timesCalled++;
        return Promise.resolve(timesCalled === maxRetries);
      },
      maxRetries,
      "did not execute enough times",
      0
    );

    expect(timesCalled).toBe(maxRetries);
    expect(result).toBe(true);
  });

  it("pauses between executions", async () => {
    const waitTimeMs = 1234;
    const perform = async () =>
      await retry(() => Promise.resolve(false), 2, "intentional final failure", waitTimeMs);

    const start = Date.now();
    await expect(perform()).rejects.toThrow("intentional final failure");
    const execTimeMs = Date.now() - start;

    // Must wait at least this long
    expect(execTimeMs).toBeGreaterThanOrEqual(waitTimeMs);
    // Will be some delay for the expectation, but more than a second out causes unpredictability
    expect(execTimeMs).toBeLessThan(waitTimeMs + 1000);
  });
});
