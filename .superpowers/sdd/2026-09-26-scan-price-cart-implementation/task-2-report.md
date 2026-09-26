# Task 2 Report — Administrator Authorization

## Status

Implemented the administrator authorization service and focused tests.

## Changes

- Added `cloudfunctions/quickstartFunctions/services/authService.js`.
- Added `cloudfunctions/quickstartFunctions/tests/authService.test.js`.
- `getCurrentUser` resolves the open ID, queries enabled administrator records, and returns the authorization state.
- `requireAdmin` throws `BusinessError("FORBIDDEN", "无管理员权限")` for non-admin users.

## Tests

Command: `node --test cloudfunctions/quickstartFunctions/tests/authService.test.js`

Result: passed (Node 16 test runner reported 1 test file, 0 failures; the file covers enabled admin identification, normal employee rejection, and disabled administrator rejection).

## Concerns

The service expects the caller to provide the cloud SDK database object and an async-compatible `getOpenId` function.
