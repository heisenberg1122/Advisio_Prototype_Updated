import { describe, expect, it } from "vitest";
import {
  notificationTemplates,
  renderNotificationEmail,
} from "./templates/notifications.js";
import { notificationTemplateOverrides } from "./template-config.js";

const data = {
  firstName: "Maria",
  actorName: "Prof. Reyes",
  title: "Milestone 1",
  workflowName: "Research Methods",
  scope: "Department",
  message: "Please review the feedback.",
  dueDate: "October 30, 2026 (Asia/Manila)",
  teamName: "Team Alpha",
  researchTitle: "Campus Research",
  result: "Approved",
  collegeName: "College of Computing",
  roles: "Adviser, Panelist",
};
const options = {
  webUrl: "https://advisio.example",
  actionUrl: "/student/tasks?projectId=123&taskId=456",
};
describe("branded notification templates", () => {
  it("renders all fifteen with resolved variables, plain text, branding, and accessible actions", () => {
    expect(Object.keys(notificationTemplates)).toHaveLength(15);
    for (const key of Object.keys(notificationTemplates)) {
      const rendered = renderNotificationEmail(key, data, options);
      expect(rendered.subject).not.toMatch(/\{\w+\}/);
      expect(rendered.html).not.toMatch(/\{\w+\}/);
      expect(rendered.html).toContain('alt="Advisio"');
      expect(rendered.html).toContain("max-width:600px");
      expect(rendered.html).toContain("projectId=123&amp;taskId=456");
      expect(rendered.text).toContain("Hello Maria");
      expect(rendered.text).toContain("https://advisio.example/student/tasks");
    }
  });
  it("preserves the invitation token fragment and escapes recipient and college details", () => {
    const token = "a".repeat(64);
    const actionUrl = `/accept-invitation#token=${token}`;
    const rendered = renderNotificationEmail(
      "institutional_invitation",
      { ...data, firstName: "<Maria>", collegeName: "Arts & Sciences" },
      { ...options, actionUrl },
    );
    expect(rendered.subject).toBe("Your Advisio college access invitation");
    expect(rendered.html).toContain("Hello &lt;Maria&gt;");
    expect(rendered.html).toContain("Arts &amp; Sciences");
    expect(rendered.html).toContain(
      `href="https://advisio.example${actionUrl}"`,
    );
    expect(rendered.html).toContain("Accept invitation</a>");
    expect(rendered.text).toContain(`https://advisio.example${actionUrl}`);
    expect(rendered.text).toContain("Adviser, Panelist");
    expect(rendered.text).toContain("48 hours");
    expect(rendered.text).toContain("This link can only be used once");
    expect(rendered.text).toContain(
      "Your password, home college, and access to other colleges will remain unchanged",
    );
  });
  it("escapes all dynamic HTML and renders user content as text", () => {
    const rendered = renderNotificationEmail(
      "announcement",
      {
        ...data,
        title: '<img src=x onerror="alert(1)">',
        firstName: "<script>bad</script>",
        message: '<a href="javascript:alert(1)">bad</a>',
      },
      options,
    );
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain("&lt;img");
  });
  it("rejects external action links, unsafe image protocols, and missing variables", () => {
    expect(() =>
      renderNotificationEmail("announcement", data, {
        ...options,
        actionUrl: "https://evil.example",
      }),
    ).toThrow("inside Advisio");
    expect(() =>
      renderNotificationEmail("announcement", data, {
        ...options,
        logoUrl: "javascript:alert(1)",
      }),
    ).toThrow("logo");
    expect(() => renderNotificationEmail("announcement", {}, options)).toThrow(
      "Missing notification variable",
    );
  });
  it("supports partial overrides and new templates without changing the renderer", () => {
    const templates = notificationTemplateOverrides({
      account_approved: { heading: "Welcome aboard" },
      custom_event: {
        subject: "News: {title}",
        heading: "Latest news",
        paragraphs: ["{message}"],
        button: "Read More",
      },
    });
    expect(
      renderNotificationEmail("account_approved", data, {
        ...options,
        templates,
      }).html,
    ).toContain("Welcome aboard");
    expect(
      renderNotificationEmail("custom_event", data, { ...options, templates })
        .subject,
    ).toBe("News: Milestone 1");
    expect(notificationTemplates.account_approved.heading).not.toBe(
      "Welcome aboard",
    );
    expect(() =>
      notificationTemplateOverrides({
        incomplete: { heading: "Missing other fields" },
      }),
    ).toThrow();
  });
});
