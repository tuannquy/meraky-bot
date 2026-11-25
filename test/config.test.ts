import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAllowedUserIds } from "../src/config.ts";

test("một ID vẫn hợp lệ như trước", () => {
  assert.deepEqual(parseAllowedUserIds("123456789012345678"), {
    ids: ["123456789012345678"],
    invalid: [],
  });
});

test("nhiều ID cách bằng phẩy, chấm phẩy hoặc khoảng trắng", () => {
  assert.deepEqual(parseAllowedUserIds("111111111111111111, 222222222222222222;333333333333333333"), {
    ids: ["111111111111111111", "222222222222222222", "333333333333333333"],
    invalid: [],
  });
  assert.deepEqual(parseAllowedUserIds("111111111111111111 222222222222222222"), {
    ids: ["111111111111111111", "222222222222222222"],
    invalid: [],
  });
});

test("bỏ trùng, bắt ID sai", () => {
  assert.deepEqual(parseAllowedUserIds("111111111111111111,111111111111111111"), {
    ids: ["111111111111111111"],
    invalid: [],
  });
  assert.deepEqual(parseAllowedUserIds("111111111111111111,abc,22"), {
    ids: ["111111111111111111"],
    invalid: ["abc", "22"],
  });
  assert.deepEqual(parseAllowedUserIds("  ,  "), { ids: [], invalid: [] });
});
