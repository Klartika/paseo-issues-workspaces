import { describe, expect, it } from "vitest";
import {
  filterValues,
  formatValue,
  hasNone,
  personSelected,
  setFilter,
  setNone,
  toggleFilter,
  tokenize,
} from "./query-filters";

describe("tokenize", () => {
  it("keeps quoted values together", () => {
    expect(tokenize('assignee:@me label:"good first issue"  NOT iOS in:title')).toEqual([
      "assignee:@me",
      'label:"good first issue"',
      "NOT",
      "iOS",
      "in:title",
    ]);
  });

  it("handles an empty query and an unterminated quote", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize('label:"oops')).toEqual(['label:"oops']);
  });
});

describe("formatValue", () => {
  it("quotes values with spaces and leaves others bare", () => {
    expect(formatValue("bug")).toBe("bug");
    expect(formatValue("PEM1 · Early Adopter Program")).toBe('"PEM1 · Early Adopter Program"');
    expect(formatValue('say "hi"')).toBe('"say hi"');
  });
});

describe("filterValues and hasNone", () => {
  const query = 'assignee:@me label:bug label:"good first issue" -label:wontfix no:milestone';

  it("reads the values of one qualifier, unquoted, ignoring negations", () => {
    expect(filterValues(query, "label")).toEqual(["bug", "good first issue"]);
    expect(filterValues(query, "assignee")).toEqual(["@me"]);
    expect(filterValues(query, "author")).toEqual([]);
  });

  it("sees no:<key>", () => {
    expect(hasNone(query, "milestone")).toBe(true);
    expect(hasNone(query, "label")).toBe(false);
  });

  it("matches qualifier names in any case", () => {
    expect(filterValues("Label:bug", "label")).toEqual(["bug"]);
  });
});

describe("setFilter", () => {
  it("adds a filter at the end", () => {
    expect(setFilter("assignee:@me", "author", "octocat")).toBe("assignee:@me author:octocat");
  });

  it("replaces the existing value and any no: for the same key", () => {
    expect(setFilter("assignee:@me no:assignee label:bug", "assignee", "octocat")).toBe("label:bug assignee:octocat");
  });

  it("removes the filter when given null, keeping everything else", () => {
    expect(setFilter("assignee:@me NOT iOS in:title", "assignee", null)).toBe("NOT iOS in:title");
  });

  it("quotes values with spaces", () => {
    expect(setFilter("", "milestone", "PEM1 · Early Adopter Program")).toBe('milestone:"PEM1 · Early Adopter Program"');
  });

  it("leaves negated filters of the same key alone", () => {
    expect(setFilter("-author:bot", "author", "octocat")).toBe("-author:bot author:octocat");
  });
});

describe("toggleFilter", () => {
  it("adds a second label alongside the first", () => {
    expect(toggleFilter("label:bug", "label", "android")).toBe("label:bug label:android");
  });

  it("removes a label that is there, whatever its case or quoting", () => {
    expect(toggleFilter('label:Bug label:"good first issue"', "label", "bug")).toBe('label:"good first issue"');
    expect(toggleFilter('label:"good first issue"', "label", "good first issue")).toBe("");
  });

  it("drops no:label when a label is picked", () => {
    expect(toggleFilter("assignee:@me no:label", "label", "bug")).toBe("assignee:@me label:bug");
  });
});

describe("setNone", () => {
  it("replaces every value with no:<key>", () => {
    expect(setNone("label:bug label:android assignee:@me", "label", true)).toBe("assignee:@me no:label");
  });

  it("turns no:<key> off", () => {
    expect(setNone("assignee:@me no:label", "label", false)).toBe("assignee:@me");
  });
});

describe("personSelected", () => {
  it("treats @me as the signed-in login", () => {
    expect(personSelected("assignee:@me", "assignee", "ajma", "ajma")).toBe(true);
    expect(personSelected("assignee:@me", "assignee", "octocat", "ajma")).toBe(false);
    expect(personSelected("assignee:@me", "assignee", "ajma", null)).toBe(false);
  });

  it("matches a login in any case", () => {
    expect(personSelected("author:OctoCat", "author", "octocat", null)).toBe(true);
  });
});
