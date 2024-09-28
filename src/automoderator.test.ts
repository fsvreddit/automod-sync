import { replacedRuleWithActionsPreserved } from "./automoderator.js";

test("Preservation of actions", () => {
    const existing = `
#include subname rulename
title: "My Title"
set_locked: true
`;

    const incoming = `
#share rulename
title: "My New Title"
`;

    const ruleToInsert = replacedRuleWithActionsPreserved(existing, incoming);

    const replacedRuleContainsNewTitle = ruleToInsert.includes("My New Title");
    const replacedRuleContainsSetLocked = ruleToInsert.includes("set_locked: true");

    expect(replacedRuleContainsNewTitle).toBeTruthy();
    expect(replacedRuleContainsSetLocked).toBeTruthy();
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
