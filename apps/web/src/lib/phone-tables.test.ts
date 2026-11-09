// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { enhancePhoneLayout, resetPhoneLayout } from "./phone-tables";

function table(attributes = "") {
  document.body.innerHTML = `<table ${attributes}>
    <thead><tr><th>ID</th><th>User</th><th>Program</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>
      <tr><td>A1</td><td>Sofia Aquino</td><td>BSIT</td><td>Active</td><td><button>Suspend</button></td></tr>
      <tr><td colspan="5">No more records</td></tr>
    </tbody>
  </table>`;
  return document.querySelector("table")!;
}

const cells = () => Array.from(document.querySelectorAll("tbody tr:first-child td"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("phone table rows", () => {
  it("labels every column and keeps actions out of the collapsed row", () => {
    table();
    enhancePhoneLayout(document.body);
    expect(cells().map((cell) => cell.getAttribute("data-phone-role"))).toEqual([
      "title",
      "detail",
      "detail",
      "summary",
      "actions",
    ]);
    expect(cells()[2].getAttribute("data-label")).toBe("Program");
    expect(document.querySelector("tbody tr:last-child")!.hasAttribute("data-phone-full")).toBe(true);
  });

  it("honors the columns a table asks for", () => {
    table('data-phone-title="1" data-phone-summary="2"');
    enhancePhoneLayout(document.body);
    expect(cells()[1].getAttribute("data-phone-role")).toBe("title");
    expect(cells()[2].getAttribute("data-phone-role")).toBe("summary");
    expect(cells()[3].getAttribute("data-phone-role")).toBe("detail");
  });

  it("expands a row without triggering the row's own click", () => {
    table();
    enhancePhoneLayout(document.body);
    let rowClicks = 0;
    const row = document.querySelector<HTMLTableRowElement>("tbody tr")!;
    row.addEventListener("click", () => rowClicks++);
    const toggle = row.querySelector<HTMLButtonElement>(".phone-row-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(row.hasAttribute("data-phone-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(rowClicks).toBe(0);
  });

  it("adds one toggle however often content changes", () => {
    table();
    enhancePhoneLayout(document.body);
    enhancePhoneLayout(document.body);
    expect(document.querySelectorAll(".phone-row-toggle")).toHaveLength(1);
  });

  it("leaves opted-out tables alone", () => {
    table('data-phone-table="scroll"');
    enhancePhoneLayout(document.body);
    expect(document.querySelector("[data-phone-cards]")).toBeNull();
  });

  it("restores the original table above phone width", () => {
    const element = table();
    const before = element.outerHTML;
    enhancePhoneLayout(document.body);
    resetPhoneLayout(document.body);
    expect(element.outerHTML).toBe(before);
  });
});
