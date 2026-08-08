import { mobileSections } from "@/lib/studio/sections";

export function countBars(value = "") {
  return value.split("\n").filter((line) => line.trim()).length;
}

export function countTotalBars(sections: Record<string, string>) {
  return mobileSections.reduce((sum, item) => sum + countBars(sections[item.name]), 0);
}

export function blankSections() {
  return mobileSections.reduce<Record<string, string>>((acc, item) => {
    acc[item.name] = "";
    return acc;
  }, {});
}

export function sectionKeyFromTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
