import {replaceSpecialCharacters} from "./utility.js";

test("Test replacement of special characters", () => {
    const input = "# 🏴 is a flag";
    const expected = "# \\U0001F3F4 is a flag";

    const actual = replaceSpecialCharacters(input);
    expect(actual).toEqual(expected);
});
