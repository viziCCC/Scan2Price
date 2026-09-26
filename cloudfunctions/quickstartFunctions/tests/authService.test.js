const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthService } = require("../services/authService");
const { BusinessError } = require("../lib/errors");

function createFakeDb(records) {
  const calls = [];
  let query = null;
  return {
    calls,
    collection(name) {
      calls.push({ method: "collection", args: [name] });
      return {
        where(whereQuery) {
          calls.push({ method: "where", args: [whereQuery] });
          query = whereQuery;
          return {
            limit(count) {
              calls.push({ method: "limit", args: [count] });
              return {
                async get() {
                  calls.push({ method: "get", args: [] });
                  return {
                    data: records.filter((record) =>
                      Object.entries(query).every(([key, value]) => record[key] === value)
                    )
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

test("identifies an enabled administrator", async () => {
  const db = createFakeDb([{ openid: "admin-1", enabled: true }]);
  const auth = createAuthService({
    db,
    getOpenId: async () => "admin-1"
  });

  assert.deepEqual(await auth.getCurrentUser(), {
    openid: "admin-1",
    isAdmin: true
  });
  assert.deepEqual(db.calls, [
    { method: "collection", args: ["admins"] },
    { method: "where", args: [{ openid: "admin-1", enabled: true }] },
    { method: "limit", args: [1] },
    { method: "get", args: [] }
  ]);
  assert.deepEqual(await auth.requireAdmin(), {
    openid: "admin-1",
    isAdmin: true
  });
});

test("rejects a normal employee", async () => {
  const auth = createAuthService({
    db: createFakeDb([]),
    getOpenId: async () => "employee-1"
  });

  await assert.rejects(
    () => auth.requireAdmin(),
    (error) => error instanceof BusinessError &&
      error.code === "FORBIDDEN" &&
      error.message === "无管理员权限"
  );
});

test("rejects an administrator record with enabled false", async () => {
  const auth = createAuthService({
    db: createFakeDb([{ openid: "disabled-admin", enabled: false }]),
    getOpenId: async () => "disabled-admin"
  });

  const user = await auth.getCurrentUser();
  assert.deepEqual(user, { openid: "disabled-admin", isAdmin: false });
  await assert.rejects(() => auth.requireAdmin(), /无管理员权限/);
});
