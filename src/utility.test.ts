import { replacedRuleWithActionsPreserved } from "./automoderator.js";
import { replaceSpecialCharacters } from "./utility.js";

test("Replacement of special characters", () => {
    const input = "# 🏴 is a flag";
    const expected = "# \\U0001F3F4 is a flag";

    const actual = replaceSpecialCharacters(input);
    expect(actual).toEqual(expected);
});

test("Replacement of unicode characters lower ranges", () => {
    const input = "body (regex): [ \"\\U00000400-\\U000004FF+\" ]";
    const output = replacedRuleWithActionsPreserved(input, input);
    expect(output).toEqual(input);
});
