import { describe, expect, test } from "bun:test";
import {
  bundleProducts,
  getAnyCatalogProduct,
  getCatalogProduct,
  studioRoomProducts,
  themeProducts,
  writingPackProducts,
} from "./product-catalog.ts";

describe("Studio Store catalog pricing", () => {
  test("keeps historical room entitlements resolvable without offering room checkout", () => {
    expect(getCatalogProduct("studio-room-penthouse")).toBeNull();
    expect(getAnyCatalogProduct("studio-room-penthouse")?.type).toBe("studio_room");
  });

  test("keeps the Penthouse bundle below its individual asset total", () => {
    const bundle = bundleProducts.find((product) => product.id === "bundle-penthouse-drop");
    const room = studioRoomProducts.find((product) => product.id === "studio-room-penthouse");
    const theme = themeProducts.find((product) => product.id === "theme-gold-executive");
    const writingPack = writingPackProducts.find((product) => product.id === "writing-hook-builder");
    const individualTotal = [room, theme, writingPack].reduce(
      (total, product) => total + (product?.priceCents ?? 0),
      0,
    );

    expect(bundle?.priceCents).toBe(999);
    expect(bundle?.priceCents).toBeLessThan(individualTotal);
  });
});
