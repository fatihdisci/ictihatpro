import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Üretimdeki güvenli 3,5 saniyelik varsayılanı değiştirmeden ağ istemcisi
    // birim testlerinin gereksiz yere beklemesini önler.
    env:
      process.env.LIVE_BEDESTEN === "1"
        ? {}
        : {
            BEDESTEN_RATE_REFILL_S: "0.05",
            BEDESTEN_RATE_MAX_WAIT_S: "0.2",
          },
  },
});
