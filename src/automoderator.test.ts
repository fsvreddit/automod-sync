import { replacedRuleWithActionsPreserved } from "./automoderator.js";

test("Preservation of actions", () => {
    const existing = `
#include subname rulename
priority: -1
title: "My Title"
set_locked: true
`;

    const incoming = `
#share rulename
priority: -5
title: "My New Title"
`;

    const ruleToInsert = replacedRuleWithActionsPreserved(existing, incoming);

    const replacedRuleContainsNewTitle = ruleToInsert.includes("My New Title");
    const replacedRuleContainsSetLocked = ruleToInsert.includes("set_locked: true");
    const replacedRuleContainsPriorityMinus5 = ruleToInsert.includes("priority: -1");

    expect(replacedRuleContainsNewTitle).toBeTruthy();
    expect(replacedRuleContainsSetLocked).toBeTruthy();
    expect(replacedRuleContainsPriorityMinus5).toBeTruthy();
});

test("Preservation of unicode tokens", () => {
    const existing = `
#include subname rulename
title (regex): ["[\\U00000400-\\U000004FF]+"]
set_locked: true
`;

    const incoming = `
#share rulename
title (regex): ["[\\U00000400-\\U000004FF]+"]
set_locked: true
`;

    const ruleToInsert = replacedRuleWithActionsPreserved(existing, incoming);
    const ruleIncludesUnicodeTokens = ruleToInsert.includes("\\U00000400") && ruleToInsert.includes("\\U000004FF");
    expect(ruleIncludesUnicodeTokens).toBeTruthy();
});

test("Child replacements work", () => {
    const existing = `
#include subname rulename
type: comment
body (regex): ["[\\U00000400-\\U000004FF]+"]
parent_submission:
    set_flair: ["a", "b"]
`;

    const incoming = `
#share rulename
type: comment
body (regex): ["[\\U00000400-\\U000004FF]+"]
parent_submission:
    set_locked: true
`;

    const ruleToInsert = replacedRuleWithActionsPreserved(existing, incoming);
    console.log(ruleToInsert);

    expect(ruleToInsert.includes("set_flair")).toBeTruthy();
    expect(ruleToInsert.includes("set_locked")).toBeFalsy();
});
