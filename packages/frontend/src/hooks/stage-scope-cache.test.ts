import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { invoiceKeys, rfiKeys, taskKeys, updateKeys } from "./query-keys";

const cases = [
  { name: "updates", key: (project: string, stage?: string) => updateKeys.list(project, stage) },
  { name: "invoices", key: (project: string, stage?: string) => invoiceKeys.list(project, stage) },
  { name: "RFIs", key: (project: string, stage?: string) => rfiKeys.list(project, "Open", stage) },
  { name: "task boards", key: (project: string, stage?: string) => taskKeys.board(project, "assigned", "building", stage) },
];

for (const { name, key } of cases) {
  test(`${name}: a list invalidation refreshes every stage without invalidating another project`, async () => {
    const client = new QueryClient();
    try {
      const keys = [key("project"), key("project", "foundation"), key("project", "roof"), key("other", "foundation")];
      keys.forEach((queryKey, index) => client.setQueryData(queryKey, [index]));
      await client.invalidateQueries({ queryKey: key("project"), refetchType: "none" });
      assert.deepEqual(keys.map((queryKey) => client.getQueryState(queryKey)?.isInvalidated), [true, true, true, false]);
      assert.deepEqual(keys.map((queryKey) => client.getQueryData(queryKey)), [[0], [1], [2], [3]]);
    } finally { client.clear(); }
  });
}
