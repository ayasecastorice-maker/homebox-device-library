import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "lib/devices.test.ts",
      "lib/auth-errors.test.ts",
      "lib/device-order.test.ts",
      "lib/device-purchases.test.ts",
      "composables/use-device-drag.test.ts",
    ],
  },
});
