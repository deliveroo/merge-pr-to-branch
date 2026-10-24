const { readFileSync } = require("fs");
const { join } = require("path");

const workflow = readFileSync(join(__dirname, "../install/workflow.yml"), "utf8");
const readme = readFileSync(join(__dirname, "../README.md"), "utf8");

describe("install workflow concurrency contract", () => {
  test("uses one stable group for the staging target and queues instead of cancelling", () => {
    expect(workflow).toMatch(/^\s*concurrency:\s*$/m);
    expect(workflow).toMatch(/^\s*group:\s*merge-pr-to-branch-staging\s*$/m);
    expect(workflow).toMatch(/^\s*cancel-in-progress:\s*false\s*$/m);
    expect(workflow).not.toMatch(
      /^\s*group:.*\$\{\{\s*github\.(?:workflow|ref|head_ref)\s*\}\}/m
    );
  });

  test("ships the template and README example on v9", () => {
    expect(workflow).toContain("deliveroo/merge-pr-to-branch@v9");
    expect(readme).toContain("deliveroo/merge-pr-to-branch@v9");
    expect(readme).not.toMatch(/deliveroo\/merge-pr-to-branch@v8\b/);
  });
});
