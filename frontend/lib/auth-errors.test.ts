import { describe, expect, it } from "vitest";
import { authErrorKey } from "./auth-errors";

describe("authentication error messages", () => {
  it.each([
    ["login", 401, "invalid_email_password"],
    ["login", 403, "local_login_disabled"],
    ["login", 400, "login_failed"],
    ["register", 409, "email_registered"],
    ["register", 403, "registration_disabled"],
    ["register", 400, "problem_registering"],
  ] as const)("maps %s %i precisely", (action, status, key) => {
    expect(authErrorKey(action, status)).toBe("index.toast." + key);
  });

  it.each(["login", "register"] as const)("distinguishes connection and service failures for %s", action => {
    expect(authErrorKey(action)).toBe("index.toast.connection_failed");
    expect(authErrorKey(action, 0)).toBe("index.toast.connection_failed");
    expect(authErrorKey(action, 429)).toBe("index.toast.too_many_attempts");
    expect(authErrorKey(action, 500)).toBe("index.toast.service_unavailable");
    expect(authErrorKey(action, 503)).toBe("index.toast.service_unavailable");
  });
});
