import { z } from "zod";
export const formFieldSchema = z.object({
    fieldKey: z.string().min(1).max(50),
    label: z.string().min(1).max(150),
    fieldType: z.enum([
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "DATE",
        "SELECT",
        "RADIO",
        "CHECKBOX",
        "FILE",
        "SIGNATURE",
    ]),
    isRequired: z.boolean().default(false),
    validationRules: z.record(z.any()).optional(),
    optionsJson: z.array(z.string()).optional(),
    sequence: z.number().int(),
});
export const formSchema = z.object({
    name: z.string().min(3).max(150),
    code: z.string().min(2).max(50),
    description: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    researchTypeId: z.string().uuid().optional(),
    fields: z.array(formFieldSchema).min(1, "Form must have at least one field"),
});
export const formSubmissionSchema = z.object({
    formId: z.string().uuid("Invalid form ID"),
    researchId: z.string().uuid("Invalid research ID"),
    dataJson: z.record(z.any()),
});
//# sourceMappingURL=forms.js.map