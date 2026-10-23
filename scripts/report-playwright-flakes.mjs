import { access, readFile } from "node:fs/promises";

const files = process.argv.slice(2);
let retried = 0;

for (const file of files) {
  try {
    await access(file);
    const report = JSON.parse(await readFile(file, "utf8"));
    for (const suite of report.suites ?? []) {
      const visit = (node) => {
        for (const spec of node.specs ?? []) {
          for (const test of spec.tests ?? []) {
            if ((test.results ?? []).some((result) => result.retry > 0)) {
              retried += 1;
              console.log(`Playwright retry: ${spec.title} (${test.projectName ?? "unknown project"})`);
            }
          }
        }
        for (const child of node.suites ?? []) visit(child);
      };
      visit(suite);
    }
  } catch {
    // Reports are optional for local runs and may not exist after startup failure.
  }
}

console.log(`Playwright flake report: ${retried} test(s) required a retry.`);
