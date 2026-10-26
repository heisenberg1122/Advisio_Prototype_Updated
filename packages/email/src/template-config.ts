import {
  notificationTemplates,
  type NotificationTemplate,
} from "./templates/notifications.js";

export function notificationTemplateOverrides(
  value: unknown,
): Record<string, NotificationTemplate> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Template overrides must be a JSON object.");
  const templates = { ...notificationTemplates };
  for (const [key, entry] of Object.entries(value)) {
    if (
      !/^[a-z][a-z0-9_]{0,79}$/.test(key) ||
      !entry ||
      Array.isArray(entry) ||
      typeof entry !== "object"
    )
      throw new Error("Invalid template entry.");
    const template = { ...templates[key], ...entry } as NotificationTemplate;
    if (
      ![template.subject, template.heading, template.button].every(
        (field) => typeof field === "string" && field.trim().length > 0,
      ) ||
      !Array.isArray(template.paragraphs) ||
      !template.paragraphs.length ||
      !template.paragraphs.every((paragraph) => typeof paragraph === "string")
    )
      throw new Error(`Invalid template: ${key}`);
    templates[key] = template;
  }
  return templates;
}
