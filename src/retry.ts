export const retry = async (
  fn: () => Promise<boolean>,
  retries = 3,
  finalError = `Retried ${retries} times without success`,
  waitBetweenMs = 1000
): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    const success = await fn();
    if (success) {
      return Promise.resolve(true);
    }

    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, waitBetweenMs));
    }
  }
  throw new Error(finalError);
};
