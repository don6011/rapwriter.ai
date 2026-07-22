import { describe, expect, test } from "bun:test";
import {
  bundleProducts,
  getAnyCatalogProduct,
  getCatalogProduct,
  marketplaceProducts,
} from "./product-catalog.ts";

describe("Studio Store ownership boundary", () => {
  test("only exposes ownable assets for new purchases", () => {
    expect(marketplaceProducts.some((product) => product.type === "ai_style")).toBe(false);
    expect(marketplaceProducts.some((product) => product.type === "vocal_chain")).toBe(false);
    expect(getCatalogProduct("ai-style-hook-doctor")).toBeNull();
    expect(getCatalogProduct("vocal-booth-polish")).toBeNull();
  });

  test("keeps retired capability products resolvable for purchase history", () => {
    expect(getAnyCatalogProduct("ai-style-hook-doctor")?.title).toBe("Billboard Writer");
    expect(getAnyCatalogProduct("vocal-booth-polish")?.title).toBe("Booth Polish");
  });

  test("featured bundles contain assets instead of membership capabilities", () => {
    const retiredTitles = new Set(["Billboard Writer", "Street Legend", "Pain Architect", "Booth Polish"]);
    expect(bundleProducts.every((bundle) => bundle.includes.every((title) => !retiredTitles.has(title)))).toBe(true);
  });
});
