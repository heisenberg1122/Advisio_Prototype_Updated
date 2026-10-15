import { describe, expect, it } from "vitest";
import { COLLEGE_THEMES, resolveCollegeTheme, CourseThemeKey } from "./college-themes";

describe("resolveCollegeTheme", () => {
  it.each([
    ["COA", "coa"],
    ["CEA", "cea"],
    ["CHTM", "chtm"],
    ["CIT", "cit"],
    ["CNP", "cnp"],
    ["SAS", "sas"],
    ["SBPA", "sbpa"],
    ["SOE", "soe"],
  ] as const)("maps college %s to its verified college theme key", (code, key) => {
    expect(resolveCollegeTheme({ code }).key).toBe(key);
  });

  const ALL_20_COURSES: Array<[string, CourseThemeKey]> = [
    ["BSA", "bsa"],
    ["BSAIS", "bsais"],
    ["BSARCH", "bsarch"],
    ["BSCE", "bsce"],
    ["BSCPE", "bscpe"],
    ["BSIE", "bsie"],
    ["BSHM", "bshm"],
    ["BSTM", "bstm"],
    ["BSIT", "bsit"],
    ["BLIS", "blis"],
    ["BSN", "bsn"],
    ["BSPH", "bsph"],
    ["ABCOMM", "abcomm"],
    ["BSCRIM", "bscrim"],
    ["BHS", "bhs"],
    ["BSPSYCH", "bspsych"],
    ["BSBA-MM", "bsba-mm"],
    ["BSBA-OM", "bsba-om"],
    ["BEED", "beed"],
    ["BSED", "bsed"],
  ];

  it.each(ALL_20_COURSES)(
    "maps degree program %s directly to its specific course theme %s",
    (programCode, expectedKey) => {
      expect(resolveCollegeTheme(null, { code: programCode }).key).toBe(expectedKey);
      expect(resolveCollegeTheme({ code: programCode }).key).toBe(expectedKey);
    },
  );

  it("verifies BSIT primary accent is changed to #58647A and retains its exact palette", () => {
    const bsit = COLLEGE_THEMES.bsit;
    expect(bsit.referenceColor).toBe("#58647A");
    expect(bsit.primaryInteractive).toBe("#58647A");
    expect(bsit.appBackground).toBe("#EFF1F1");
    expect(bsit.sidebarBackground).toBe("#DEE2E1");
    expect(bsit.headerBackground).toBe("#DEE2E1");
    expect(bsit.primaryCardBackground).toBe("#F6F7F7");
    expect(bsit.activeNavBackground).toBe("#CFD5D3");
  });

  it("verifies BLIS preserves its exact palette with accent #58647A", () => {
    const blis = COLLEGE_THEMES.blis;
    expect(blis.referenceColor).toBe("#58647A");
    expect(blis.primaryInteractive).toBe("#58647A");
    expect(blis.appBackground).toBe("#F0F1F3");
    expect(blis.sidebarBackground).toBe("#DFE2E6");
    expect(blis.headerBackground).toBe("#DFE2E6");
    expect(blis.primaryCardBackground).toBe("#F7F7F8");
    expect(blis.activeNavBackground).toBe("#D0D4DA");
  });

  it("verifies all 20 courses have exact assigned light mode palettes from the design reference", () => {
    // 1. College of Accountancy
    expect(COLLEGE_THEMES.bsa.primaryInteractive).toBe("#815D00");
    expect(COLLEGE_THEMES.bsa.appBackground).toBe("#FCF9EE");
    expect(COLLEGE_THEMES.bsa.sidebarBackground).toBe("#F9F2DB");
    expect(COLLEGE_THEMES.bsa.primaryCardBackground).toBe("#FDFCF6");
    expect(COLLEGE_THEMES.bsa.activeNavBackground).toBe("#F5ECCA");

    expect(COLLEGE_THEMES.bsais.primaryInteractive).toBe("#926B10");
    expect(COLLEGE_THEMES.bsais.appBackground).toBe("#FCF9F0");
    expect(COLLEGE_THEMES.bsais.sidebarBackground).toBe("#F8F2DF");
    expect(COLLEGE_THEMES.bsais.primaryCardBackground).toBe("#FDFCF6");
    expect(COLLEGE_THEMES.bsais.activeNavBackground).toBe("#F5ECCF");

    // 2. College of Engineering and Architecture
    expect(COLLEGE_THEMES.bsarch.primaryInteractive).toBe("#B53A24");
    expect(COLLEGE_THEMES.bsarch.appBackground).toBe("#F8EDEB");
    expect(COLLEGE_THEMES.bsarch.sidebarBackground).toBe("#F1DAD5");
    expect(COLLEGE_THEMES.bsarch.primaryCardBackground).toBe("#FBF5F4");
    expect(COLLEGE_THEMES.bsarch.activeNavBackground).toBe("#EAC8C2");

    expect(COLLEGE_THEMES.bsce.primaryInteractive).toBe("#AC4323");
    expect(COLLEGE_THEMES.bsce.appBackground).toBe("#F8EEEB");
    expect(COLLEGE_THEMES.bsce.sidebarBackground).toBe("#EFDBD5");
    expect(COLLEGE_THEMES.bsce.primaryCardBackground).toBe("#FBF6F4");
    expect(COLLEGE_THEMES.bsce.activeNavBackground).toBe("#E8CAC1");

    expect(COLLEGE_THEMES.bscpe.primaryInteractive).toBe("#AB452B");
    expect(COLLEGE_THEMES.bscpe.appBackground).toBe("#F7EEEC");
    expect(COLLEGE_THEMES.bscpe.sidebarBackground).toBe("#EEDCD7");
    expect(COLLEGE_THEMES.bscpe.primaryCardBackground).toBe("#FBF6F4");
    expect(COLLEGE_THEMES.bscpe.activeNavBackground).toBe("#E7CBC4");

    expect(COLLEGE_THEMES.bsie.primaryInteractive).toBe("#B44C2A");
    expect(COLLEGE_THEMES.bsie.appBackground).toBe("#F8EFEC");
    expect(COLLEGE_THEMES.bsie.sidebarBackground).toBe("#F1DDD7");
    expect(COLLEGE_THEMES.bsie.primaryCardBackground).toBe("#FBF6F4");
    expect(COLLEGE_THEMES.bsie.activeNavBackground).toBe("#EACDC3");

    // 3. College of Hospitality and Tourism Management
    expect(COLLEGE_THEMES.bshm.primaryInteractive).toBe("#B20D53");
    expect(COLLEGE_THEMES.bshm.appBackground).toBe("#F8E9F0");
    expect(COLLEGE_THEMES.bshm.sidebarBackground).toBe("#F0D1DE");
    expect(COLLEGE_THEMES.bshm.primaryCardBackground).toBe("#FBF3F6");
    expect(COLLEGE_THEMES.bshm.activeNavBackground).toBe("#E9BBCF");

    expect(COLLEGE_THEMES.bstm.primaryInteractive).toBe("#AF245F");
    expect(COLLEGE_THEMES.bstm.appBackground).toBe("#F8EBF1");
    expect(COLLEGE_THEMES.bstm.sidebarBackground).toBe("#F0D5E1");
    expect(COLLEGE_THEMES.bstm.primaryCardBackground).toBe("#FBF4F7");
    expect(COLLEGE_THEMES.bstm.activeNavBackground).toBe("#E9C2D2");

    // 4. College of Information Technology
    expect(COLLEGE_THEMES.bsit.primaryInteractive).toBe("#58647A");
    expect(COLLEGE_THEMES.blis.primaryInteractive).toBe("#58647A");

    // 5. College of Nursing and Pharmacy
    expect(COLLEGE_THEMES.bsn.primaryInteractive).toBe("#26703E");
    expect(COLLEGE_THEMES.bsn.appBackground).toBe("#EBF2EE");
    expect(COLLEGE_THEMES.bsn.sidebarBackground).toBe("#D6E4DA");
    expect(COLLEGE_THEMES.bsn.primaryCardBackground).toBe("#F4F8F5");
    expect(COLLEGE_THEMES.bsn.activeNavBackground).toBe("#C2D7C9");

    expect(COLLEGE_THEMES.bsph.primaryInteractive).toBe("#386D42");
    expect(COLLEGE_THEMES.bsph.appBackground).toBe("#EDF2EE");
    expect(COLLEGE_THEMES.bsph.sidebarBackground).toBe("#D9E3DB");
    expect(COLLEGE_THEMES.bsph.primaryCardBackground).toBe("#F5F8F6");
    expect(COLLEGE_THEMES.bsph.activeNavBackground).toBe("#C7D6CA");

    // 6. School of Arts and Sciences
    expect(COLLEGE_THEMES.abcomm.primaryInteractive).toBe("#234B80");
    expect(COLLEGE_THEMES.abcomm.appBackground).toBe("#EBEFF4");
    expect(COLLEGE_THEMES.abcomm.sidebarBackground).toBe("#D5DDE7");
    expect(COLLEGE_THEMES.abcomm.primaryCardBackground).toBe("#F4F6F9");
    expect(COLLEGE_THEMES.abcomm.activeNavBackground).toBe("#C1CDDB");

    expect(COLLEGE_THEMES.bscrim.primaryInteractive).toBe("#274466");
    expect(COLLEGE_THEMES.bscrim.appBackground).toBe("#ECEEF1");
    expect(COLLEGE_THEMES.bscrim.sidebarBackground).toBe("#D6DBE2");
    expect(COLLEGE_THEMES.bscrim.primaryCardBackground).toBe("#F4F6F7");
    expect(COLLEGE_THEMES.bscrim.activeNavBackground).toBe("#C3CBD4");

    expect(COLLEGE_THEMES.bhs.primaryInteractive).toBe("#395A7D");
    expect(COLLEGE_THEMES.bhs.appBackground).toBe("#EDF0F3");
    expect(COLLEGE_THEMES.bhs.sidebarBackground).toBe("#D9E0E6");
    expect(COLLEGE_THEMES.bhs.primaryCardBackground).toBe("#F5F7F8");
    expect(COLLEGE_THEMES.bhs.activeNavBackground).toBe("#C8D1DB");

    expect(COLLEGE_THEMES.bspsych.primaryInteractive).toBe("#4C5682");
    expect(COLLEGE_THEMES.bspsych.appBackground).toBe("#EFF0F4");
    expect(COLLEGE_THEMES.bspsych.sidebarBackground).toBe("#DDDFE7");
    expect(COLLEGE_THEMES.bspsych.primaryCardBackground).toBe("#F6F7F9");
    expect(COLLEGE_THEMES.bspsych.activeNavBackground).toBe("#CDD0DC");

    // 7. School of Business and Public Administration
    expect(COLLEGE_THEMES["bsba-mm"].primaryInteractive).toBe("#855E00");
    expect(COLLEGE_THEMES["bsba-mm"].appBackground).toBe("#FBF8EE");
    expect(COLLEGE_THEMES["bsba-mm"].sidebarBackground).toBe("#F7F0DB");
    expect(COLLEGE_THEMES["bsba-mm"].primaryCardBackground).toBe("#FDFBF6");
    expect(COLLEGE_THEMES["bsba-mm"].activeNavBackground).toBe("#F4E9CA");

    expect(COLLEGE_THEMES["bsba-om"].primaryInteractive).toBe("#866914");
    expect(COLLEGE_THEMES["bsba-om"].appBackground).toBe("#FBF8EF");
    expect(COLLEGE_THEMES["bsba-om"].sidebarBackground).toBe("#F7F1DD");
    expect(COLLEGE_THEMES["bsba-om"].primaryCardBackground).toBe("#FDFBF6");
    expect(COLLEGE_THEMES["bsba-om"].activeNavBackground).toBe("#F3EACD");

    // 8. School of Education
    expect(COLLEGE_THEMES.beed.primaryInteractive).toBe("#302B8A");
    expect(COLLEGE_THEMES.beed.appBackground).toBe("#ECECF4");
    expect(COLLEGE_THEMES.beed.sidebarBackground).toBe("#D8D7E9");
    expect(COLLEGE_THEMES.beed.primaryCardBackground).toBe("#F5F4F9");
    expect(COLLEGE_THEMES.beed.activeNavBackground).toBe("#C5C4DE");

    expect(COLLEGE_THEMES.bsed.primaryInteractive).toBe("#3B3075");
    expect(COLLEGE_THEMES.bsed.appBackground).toBe("#EDECF3");
    expect(COLLEGE_THEMES.bsed.sidebarBackground).toBe("#D9D8E5");
    expect(COLLEGE_THEMES.bsed.primaryCardBackground).toBe("#F5F5F8");
    expect(COLLEGE_THEMES.bsed.activeNavBackground).toBe("#C7C5D8");
  });

  it("verifies the shared dark mode base surfaces across all courses match Screenshot 3", () => {
    for (const [, key] of ALL_20_COURSES) {
      const theme = COLLEGE_THEMES[key];
      expect(theme.dark.appBackground).toBe("#111820");
      expect(theme.dark.sidebarBackground).toBe("#19232D");
      expect(theme.dark.headerBackground).toBe("#19232D");
      expect(theme.dark.primaryCardBackground).toBe("#222D38");
      expect(theme.dark.activeNavBackground).toBe("#303744");
      expect(theme.dark.primaryText).toBe("#F1F5F9");
      expect(theme.dark.secondaryText).toBe("#A8B6C6");
    }
  });

  it("supports historical computing-college codes", () => {
    expect(resolveCollegeTheme({ code: "CCS" }).key).toBe("cit");
    expect(resolveCollegeTheme({ code: "CICT" }).key).toBe("cit");
  });

  it("uses the Advisio default for an unassigned college", () => {
    expect(resolveCollegeTheme(null)).toEqual(COLLEGE_THEMES.default);
    expect(resolveCollegeTheme({ code: "SHS" }).key).toBe("default");
  });
});
