export function panelistRoute(b, d) {
  const g = d.defenseGroups;
  if (b.action === "login") return "/login";
  if (["invitation", "respond"].includes(b.action)) return `/panelist/defenses/${g.readiness.sessionId}`;
  if (b.action === "workspace") return `/panelist/defenses/${g.readiness.sessionId}`;
  if (["manuscript", "annotations"].includes(b.action)) return `/panelist/dashboard?tab=documents&sessionId=${g.readiness.sessionId}`;
  if (b.action === "live") return `/panelist/defenses/${g.release.sessionId}`;
  if (["structured-draft", "structured-final"].includes(b.action)) return `/panelist/dashboard?tab=evaluation&sessionId=${g.release.sessionId}`;
  if (["pdf-draft", "pdf-final"].includes(b.action)) return `/panelist/dashboard?tab=evaluation&sessionId=${g.schedule.sessionId}`;
  if (b.action === "records") return "/panelist/dashboard?tab=grades";
  if (b.action === "official-result") return `/panelist/defenses/${g.completed.sessionId}`;
  return "/panelist/dashboard";
}

export async function runPanelistAction(c) {
  const { page, demo: d, beat, auditOnly, click, point, ready, cue, button, api } = c;
  const exact = (name) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
  const text = (name) => page.getByText(name, { exact: true }).filter({ visible: true }).first();
  const g = d.defenseGroups;
  const go = async (route) => { await page.goto(d.url + route, { waitUntil: "domcontentloaded" }); await ready(page.getByRole("link", { name: "Overview", exact: true })); };
  const mark = async (tool, x, y, value) => {
    await click(page.getByRole("button", { name: tool, exact: true }));
    if (value) { await page.getByLabel("Text or comment", { exact: true }).fill(value); await click(exact("Close annotation details")); }
    const surface = page.getByLabel("Annotation layer for page 1", { exact: true }); await ready(surface); await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox(); await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  };
  const sign = async () => {
    await mark("Signature", .57, .82); await page.getByLabel("Signature source", { exact: true }).selectOption("type"); await page.getByLabel("Type your signature", { exact: true }).fill("Marisol Cruz"); await page.getByLabel("Confirm your password", { exact: true }).fill(d.password); await click(exact("Apply signature")); await ready(page.getByText(/Signature applied|Signed/i).filter({ visible: true }).first());
  };
  if (beat.action === "login") {
    await page.locator('input[type="email"]').fill(d.email); await page.locator('input[type="password"]').fill(d.password); await click(button("Sign in")); await ready(page.getByRole("link", { name: "Defense Schedule", exact: true }));
  } else if (beat.action === "overview") {
    await point(text("Assigned Projects")); await cue("The sidebar"); for (const name of ["Defense Schedule", "Manuscript Reviews", "Evaluations", "Results"]) await point(page.getByRole("link", { name, exact: true }));
  } else if (beat.action === "invitation") {
    await ready(text("Campus Accessibility Requirements Study")); await point(page.getByText(/Research Presentation Room/).first()); await point(exact("Accept invitation"));
  } else if (beat.action === "respond") {
    await click(exact("Accept invitation")); await ready(page.getByText(/Invitation accepted|Accepted panel assignment/i).first()); await cue("If you cannot attend"); await go(`/panelist/defenses/${g.decline.sessionId}`); await click(exact("Decline")); await page.getByPlaceholder("Explain why you are unavailable").fill("I am unavailable for this proposed time. Please arrange another panelist for this fictional session."); await click(exact("Decline and notify professor")); await go(`/panelist/defenses/${g.readiness.sessionId}`);
  } else if (beat.action === "workspace") {
    await point(page.getByText("Accepted panel assignment", { exact: false }).first()); await point(exact("Open defense documents")); await point(page.getByText(/Manuscript|Defense documents shared/i).first());
  } else if (beat.action === "manuscript") {
    await ready(page.getByLabel("Manuscript review version", { exact: true })); await point(page.getByLabel("Manuscript review version", { exact: true })); await page.getByLabel("PDF zoom", { exact: true }).selectOption("page"); await point(page.getByRole("button", { name: "Next page", exact: true })); await page.getByLabel("PDF zoom", { exact: true }).selectOption("1");
  } else if (beat.action === "annotations") {
    await page.getByLabel("PDF zoom", { exact: true }).selectOption("page"); await mark("Highlight", .08, .2); await mark("Comment", .65, .3, "Clarify the evidence supporting the research objectives."); await mark("Circle", .72, .23); await click(exact("Save draft")); await ready(text("Draft saved privately."));
    await cue("preview the annotated manuscript"); await click(exact("Preview annotated manuscript")); await ready(page.getByRole("dialog", { name: "Preview manuscript feedback", exact: true })); await point(page.getByRole("checkbox").last()); await click(exact("Back to editing")); await cue("Selecting Share Feedback"); await click(exact("Preview annotated manuscript")); await page.getByRole("checkbox").last().check(); await click(exact("Share feedback")); await ready(text("Feedback shared. Further edits remain private until you share again."));
  } else if (beat.action === "live") {
    await ready(exact("Open live evaluation")); await point(exact("Open live evaluation"));
  } else if (beat.action === "structured-draft") {
    await ready(page.getByText("Live defense · Your private draft", { exact: true }));
    const summaries = page.locator("summary").filter({ hasText: "Individual presentation" });
    for (const summary of await summaries.all()) { const details = summary.locator(".."); if ((await details.getAttribute("open")) === null) await click(summary); await click(details.getByRole("radio", { name: /^Presentation clarity: 4 / })); }
    await click(page.locator("summary").filter({ hasText: "Group manuscript" })); await click(page.getByRole("radio", { name: /^Research scope and method: 4 / }));
    await cue("integrated feedback"); await page.locator("textarea").first().fill("The scope and proposed method are aligned. Clarify the evidence to be collected before the next research stage."); await page.getByRole("radio", { name: "Approved with Minor Revisions", exact: true }).check(); await page.getByLabel("Electronic signature — type your full name", { exact: true }).fill("Marisol Cruz"); await cue("Use Save Draft"); await click(exact("Save draft")); await ready(text("Draft saved"));
  } else if (beat.action === "structured-final") {
    await click(exact("Review evaluation PDF")); await ready(text("Review your generated evaluation PDF")); await cue("return to the form"); await click(exact("Back to editing")); await page.locator("textarea").first().fill("The scope and method are aligned. Clarify the evidence to be collected and document the planned revision before the next research stage."); await click(exact("Review evaluation PDF")); await page.getByRole("checkbox").last().check(); await cue("select Submit Final Evaluation"); await click(exact("Submit final evaluation")); await ready(text("Final evaluation · Locked"));
  } else if (beat.action === "pdf-draft") {
    await ready(page.getByLabel("PDF zoom", { exact: true })); await page.getByLabel("PDF zoom", { exact: true }).selectOption("page");
    await mark("Checkmark", .08, .18); await mark("Circle", .72, .35); await mark("Text", .1, .57, "Clarify the supporting research evidence."); await click(exact("Undo")); await click(exact("Redo")); await click(exact("Save draft")); await cue("requires a signature"); await sign();
  } else if (beat.action === "pdf-final") {
    await page.getByLabel("PDF zoom", { exact: true }).selectOption("page"); await click(exact("Preview completed PDF")); await ready(page.getByRole("dialog", { name: "Preview completed evaluation", exact: true })); await click(exact("Back to editing")); await cue("make changes after signing"); await mark("Highlight", .1, .29); await click(exact("Save draft")); await ready(page.getByText(/Edits removed|Draft saved privately/).filter({ visible: true }).first()); await sign(); await click(exact("Preview completed PDF")); await page.getByRole("checkbox").last().check(); await cue("submit the final evaluation"); await click(exact("Submit final & lock")); await ready(text("Evaluation submitted and permanently locked.")); await point(exact("Download final PDF"));
  } else if (beat.action === "records") {
    await ready(text("Grades & Recommendations")); await point(page.getByText(/submitted and locked/i).filter({ visible: true }).first());
  } else if (beat.action === "official-result") {
    await ready(text("Prepared Completed Research Defense")); await point(page.getByText(/Approved/).filter({ visible: true }).last()); await point(page.getByText(/Official|released/i).filter({ visible: true }).last());
  } else if (beat.action === "tools") {
    await click(page.getByRole("link", { name: "Calendar", exact: true })); await ready(text("Your Advisio schedule")); await click(page.getByRole("link", { name: "Manuscript Reviews", exact: true })); await ready(page.getByText(/Defense documents|Manuscript review/i).filter({ visible: true }).first()); await click(page.getByRole("link", { name: "Official Copies", exact: true })); await ready(page.getByText("Official Copies", { exact: true }).first()); await point(page.getByRole("link", { name: "Messages", exact: true })); await point(page.getByRole("link", { name: "Inbox", exact: true })); await go("/panelist/dashboard");
  }
}
