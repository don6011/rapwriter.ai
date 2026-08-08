import { describe, expect, test } from "bun:test";
import {
  bundleProducts,
  studioRoomProducts,
  themeProducts,
  writingPackProducts,
} from "./product-catalog.ts";

describe("Studio Store catalog pricing", () => {
  test("prices the Penthouse room as an owned environment asset", () => {
    const room = studioRoomProducts.find((product) => product.id === "studio-room-penthouse");

    expect(room?.priceCents).toBe(999);
    expect(room?.price).toBe("$9.99");
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
