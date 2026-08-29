import { z } from "zod";
export declare const formFieldSchema: z.ZodObject<{
    fieldKey: z.ZodString;
    label: z.ZodString;
    fieldType: z.ZodEnum<["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX", "FILE", "SIGNATURE"]>;
    isRequired: z.ZodDefault<z.ZodBoolean>;
    validationRules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    optionsJson: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sequence: number;
    fieldKey: string;
    label: string;
    fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
    isRequired: boolean;
    validationRules?: Record<string, any> | undefined;
    optionsJson?: string[] | undefined;
}, {
    sequence: number;
    fieldKey: string;
    label: string;
    fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
    isRequired?: boolean | undefined;
    validationRules?: Record<string, any> | undefined;
    optionsJson?: string[] | undefined;
}>;
export declare const formSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    organizationId: z.ZodOptional<z.ZodString>;
    researchTypeId: z.ZodOptional<z.ZodString>;
    fields: z.ZodArray<z.ZodObject<{
        fieldKey: z.ZodString;
        label: z.ZodString;
        fieldType: z.ZodEnum<["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX", "FILE", "SIGNATURE"]>;
        isRequired: z.ZodDefault<z.ZodBoolean>;
        validationRules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        optionsJson: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sequence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sequence: number;
        fieldKey: string;
        label: string;
        fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
        isRequired: boolean;
        validationRules?: Record<string, any> | undefined;
        optionsJson?: string[] | undefined;
    }, {
        sequence: number;
        fieldKey: string;
        label: string;
        fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
        isRequired?: boolean | undefined;
        validationRules?: Record<string, any> | undefined;
        optionsJson?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    fields: {
        sequence: number;
        fieldKey: string;
        label: string;
        fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
        isRequired: boolean;
        validationRules?: Record<string, any> | undefined;
        optionsJson?: string[] | undefined;
    }[];
    name: string;
    code: string;
    description?: string | undefined;
    researchTypeId?: string | undefined;
    organizationId?: string | undefined;
}, {
    fields: {
        sequence: number;
        fieldKey: string;
        label: string;
        fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "FILE" | "SIGNATURE";
        isRequired?: boolean | undefined;
        validationRules?: Record<string, any> | undefined;
        optionsJson?: string[] | undefined;
    }[];
    name: string;
    code: string;
    description?: string | undefined;
    researchTypeId?: string | undefined;
    organizationId?: string | undefined;
}>;
export declare const formSubmissionSchema: z.ZodObject<{
    formId: z.ZodString;
    researchId: z.ZodString;
    dataJson: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    researchId: string;
    formId: string;
    dataJson: Record<string, any>;
}, {
    researchId: string;
    formId: string;
    dataJson: Record<string, any>;
}>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type FormInput = z.infer<typeof formSchema>;
export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>;
//# sourceMappingURL=forms.d.ts.map