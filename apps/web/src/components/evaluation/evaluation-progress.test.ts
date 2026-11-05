import { expect, test } from "vitest";
import { readProgress, saveProgress } from "./evaluation-progress";
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("activity notes and completion persist for one private project without leaking into another", () => {
  const storage = store();
  saveProgress("one", { phase: "complete", checked: [0, 2] }, storage);
  expect(readProgress("one", 6, storage)).toEqual({
    phase: "complete",
    checked: [0, 2],
  });
  expect(readProgress("two", 6, storage)).toEqual({
    phase: "intro",
    checked: [],
  });
});
test("previously saved questionnaire phases resume at walkthrough completion", () => {
  const storage = store();
  storage.setItem(
    "advisio_evaluation_guide:one",
    JSON.stringify({ phase: "questionnaire", checked: [1] }),
  );
  expect(readProgress("one", 6, storage)).toEqual({
    phase: "complete",
    checked: [1],
  });
});
test("corrupt progress, unknown phases and invalid checklist indexes are handled safely", () => {
  const storage = store();
  storage.setItem("advisio_evaluation_guide:one", "broken");
  expect(readProgress("one", 6, storage)).toEqual({
    phase: "intro",
    checked: [],
  });
  storage.setItem(
    "advisio_evaluation_guide:one",
    JSON.stringify({ phase: "activities", checked: [-1, 0, 0, 5, 6, "1"] }),
  );
  expect(readProgress("one", 6, storage).checked).toEqual([0, 5]);
  expect(() =>
    saveProgress(
      "one",
      { phase: "intro", checked: [] },
      {
        ...storage,
        setItem: () => {
          throw new Error("full");
        },
      },
    ),
  ).not.toThrow();
});
