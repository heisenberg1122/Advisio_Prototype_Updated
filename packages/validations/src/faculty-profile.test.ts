import { describe, it, expect } from "vitest";
import {
  facultyProfileUpdateSchema,
  educationRecordSchema,
  calculateProfileCompletion,
} from "./faculty-profile.js";

describe("Faculty Profile Validation Schemas", () => {
  it("validates a complete faculty profile update input", () => {
    const input = {
      academicTitle: "Ph.D., PE",
      facultyDesignation: "Associate Professor",
      department: "Information Technology",
      biography: "Experienced academic researcher with over 10 years of advising capstone teams.",
      teachingBackground: "Teaching software engineering, database systems, and AI methodologies.",
      mentoringPhilosophy: "Guided mentorship with focus on empirical rigor and agile delivery.",
      preferredProjectTypes: "Applied Web/Mobile systems and machine learning pipelines.",
      expertiseKeywords: ["Web Development", "Artificial Intelligence", "Database Systems"],
      researchInterests: ["Machine Learning", "Educational Technology"],
      specializedTopics: ["Applied NLP in Education", "Distributed Microservices"],
      supervisionMethodologies: ["Agile/Scrum", "Design Science Research"],
      acceptedResearchTypes: ["Applied Research", "Experimental Research"],
      advisingPreferences: "Weekly check-ins required; prototype-first approach.",
      educations: [
        {
          id: "edu-1",
          degreeLevel: "DOCTORATE",
          degreeName: "Ph.D. in Computer Science",
          fieldOfStudy: "Computer Science",
          institution: "University of the Assumption",
          graduationYear: 2020,
        },
        {
          id: "edu-2",
          degreeLevel: "BACHELORS",
          degreeName: "B.S. in Information Technology",
          fieldOfStudy: "Information Technology",
          institution: "University of the Assumption",
          graduationYear: 2012,
        },
      ],
      certifications: [
        {
          id: "cert-1",
          title: "AWS Certified Solutions Architect",
          issuingBody: "Amazon Web Services",
          yearIssued: 2023,
          licenseNumber: "AWS-12345",
        },
      ],
      experiences: [
        {
          id: "exp-1",
          type: "TEACHING",
          title: "Associate Professor",
          organization: "College of Computing",
          startYear: 2018,
          endYear: null,
          isCurrent: true,
          description: "Leading undergraduate capstone courses.",
        },
      ],
      publications: [
        {
          id: "pub-1",
          title: "Machine Learning in Academic Advising",
          venue: "Philippine Journal of Computing",
          year: 2024,
          authors: "Santos, M. & Reyes, J.",
          url: "https://doi.org/10.1000/example",
        },
      ],
      awards: [
        {
          id: "award-1",
          title: "Outstanding Faculty Researcher",
          issuingOrganization: "University of the Assumption",
          year: 2023,
          description: "Recognized for research mentoring excellence.",
        },
      ],
    };

    const result = facultyProfileUpdateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("handles empty / partial profile updates with defaults", () => {
    const input = {
      biography: "Short biography for testing.",
      expertiseKeywords: ["Web Development"],
    };

    const result = facultyProfileUpdateSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.educations).toEqual([]);
      expect(result.data.certifications).toEqual([]);
      expect(result.data.experiences).toEqual([]);
      expect(result.data.publications).toEqual([]);
      expect(result.data.awards).toEqual([]);
    }
  });

  it("rejects invalid education records with missing required fields", () => {
    const invalidEdu = {
      id: "edu-1",
      degreeLevel: "INVALID_LEVEL",
      degreeName: "",
      fieldOfStudy: "CS",
      institution: "UA",
    };

    const result = educationRecordSchema.safeParse(invalidEdu);
    expect(result.success).toBe(false);
  });

  it("calculates completion percentage and suggestions accurately", () => {
    const emptyResult = calculateProfileCompletion(null);
    expect(emptyResult.percentage).toBe(0);
    expect(emptyResult.isComplete).toBe(false);
    expect(emptyResult.suggestions.length).toBeGreaterThan(0);

    const partialResult = calculateProfileCompletion({
      academicTitle: "Ph.D.",
      biography: "This is a detailed biography that satisfies the character threshold.",
      educations: [
        {
          id: "1",
          degreeLevel: "DOCTORATE",
          degreeName: "Ph.D.",
          fieldOfStudy: "IT",
          institution: "UA",
          graduationYear: 2020,
        },
      ],
      expertiseKeywords: ["Software Engineering"],
    });

    // title (10) + bio (15) + edu (20) + expertise (15) = 60
    expect(partialResult.percentage).toBe(60);
    expect(partialResult.suggestions).toContain("Add your research interests and specialized topics");

    const fullResult = calculateProfileCompletion({
      academicTitle: "Ph.D.",
      biography: "Comprehensive faculty biography with sufficient detail.",
      educations: [
        {
          id: "1",
          degreeLevel: "DOCTORATE",
          degreeName: "Ph.D.",
          fieldOfStudy: "CS",
          institution: "UA",
          graduationYear: 2020,
        },
      ],
      expertiseKeywords: ["AI"],
      researchInterests: ["Machine Learning"],
      mentoringPhilosophy: "Collaborative and structured research guidance.",
      experiences: [
        {
          id: "1",
          type: "TEACHING",
          title: "Professor",
          organization: "UA",
          startYear: 2015,
          endYear: null,
          isCurrent: true,
        },
      ],
      publications: [
        {
          id: "1",
          title: "Research Paper",
          venue: "Journal",
          year: 2024,
        },
      ],
    });

    expect(fullResult.percentage).toBeGreaterThanOrEqual(85);
    expect(fullResult.isComplete).toBe(true);
  });
});
