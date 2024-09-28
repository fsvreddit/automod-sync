import { replaceUnicodeTokens, restoreUnicodeTokens } from "./utility.js";

test("Replacement of special characters high values", () => {
    const input = "# \\U0001F3F4 is a flag";

    const actual = restoreUnicodeTokens(replaceUnicodeTokens(input));
    expect(actual).toEqual(input);
});

test("Replacement of special characters low values values", () => {
    const input = "body (regex): [ \"\\U00000400-\\U000004FF+\" ]";

    const actual = restoreUnicodeTokens(replaceUnicodeTokens(input));
    expect(actual).toEqual(input);
});
