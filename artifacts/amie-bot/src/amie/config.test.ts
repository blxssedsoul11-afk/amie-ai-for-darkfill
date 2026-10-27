import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORIZED_USERS, isAuthorizedUser } from "./config.js";

test("only Chakala and Darkfill are authorized", () => {
  assert.deepEqual([...AUTHORIZED_USERS.entries()], [
    ["1117540437016727612", "Chakala"],
    ["919581893882695740", "Darkfill"],
  ]);
  assert.equal(isAuthorizedUser("1117540437016727612"), true);
  assert.equal(isAuthorizedUser("919581893882695740"), true);
  assert.equal(isAuthorizedUser("000000000000000000"), false);
});
