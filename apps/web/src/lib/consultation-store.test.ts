import { describe, expect, it } from "vitest";
import {
  shouldImportLegacyConsultation,
  type ConsultationItem,
} from "./consultation-store";

const legacyItem: ConsultationItem = {
  id: "legacy-consultation-1",
  topic: "Proposal review",
  date: "2026-10-15",
  time: "10:00",
  mode: "Google Meet",
  status: "pending",
};

describe("legacy consultation import selection", () => {
  it("imports an unacknowledged browser record", () => {
    expect(
      shouldImportLegacyConsultation(legacyItem, "project-a", {}),
    ).toBe(true);
  });

  it("does not import an unscoped record into a second project", () => {
    expect(
      shouldImportLegacyConsultation(legacyItem, "project-b", {
        "project-a:legacy-consultation-1": "database-id",
      }),
    ).toBe(false);
  });

  it("honors an explicit project recorded by a newer legacy client", () => {
    expect(
      shouldImportLegacyConsultation(
        { ...legacyItem, researchId: "project-a" },
        "project-b",
        {},
      ),
    ).toBe(false);
  });

  it("never reimports records that already use database UUIDs", () => {
    expect(
      shouldImportLegacyConsultation(
        {
          ...legacyItem,
          id: "123e4567-e89b-42d3-a456-426614174000",
        },
        "project-a",
        {},
      ),
    ).toBe(false);
  });
});
