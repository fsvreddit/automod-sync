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

test("Replacement of unicode characters lower ranges", () => {
    const input = "body (regex): [ \"\\U00000400-\\U000004FF+\" ]";
    const output = replacedRuleWithActionsPreserved(input, input);
    expect(output).toEqual(input);
});
