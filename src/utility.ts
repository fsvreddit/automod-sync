import _ from "lodash";

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

export function replaceSpecialCharacters (input: string): string {
    function isHighCharacter (input: string): boolean {
        const codepoint = input.codePointAt(0);
        return codepoint !== undefined && codepoint > 65535;
    }

    const characters = [...input];
    const highCharacters = _.uniq(characters.filter(isHighCharacter));

    let output = input;
    for (const character of highCharacters) {
        const codePoint = character.codePointAt(0);

        if (codePoint) {
            const hex = codePoint.toString(16).toUpperCase();
            const replacement = `\\U${"0".repeat(8 - hex.length)}${hex}`;
            output = replaceAll(output, character, replacement);
        }
    }

    return output;
}
