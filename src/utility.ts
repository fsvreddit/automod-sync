export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

/**
 * Conceals UNICODE tokens from YAML parser, so that it does not attempt to parse them.
 * Why a duck? Why not! I chose to use a high unicode character here precisely because Automod
 * wiki pages cannot ever have them. Therefore there is no conceivable way that replacing
 * \U with the duck emoji (and back again) could result in a broken rule.
 */
export function replaceUnicodeTokens (input: string): string {
    const regex = /\\U([0-9A-F]{8})/g;

    let output = input;
    const matches = input.matchAll(regex);
    for (const match of matches) {
        output = replaceAll(output, match[0], `🦆${match[1]}`);
    }

    return output;
}

/**
 * Restores UNICODE tokens concealed with replaceUnicodeTokens
 */
export function restoreUnicodeTokens (input: string): string {
    const regex = /🦆([0-9A-F]{8})/g;
    let output = input;
    const matches = input.matchAll(regex);
    for (const match of matches) {
        output = replaceAll(output, match[0], `\\U${match[1]}`);
    }

    return output;
}

// export function replaceSpecialCharacters (input: string): string {
//     function isHighCharacter (input: string): boolean {
//         const codepoint = input.codePointAt(0);
//         return codepoint !== undefined && codepoint > 65535;
//     }

//     const characters = [...input];
//     const highCharacters = _.uniq(characters.filter(isHighCharacter));

//     let output = input;
//     for (const character of highCharacters) {
//         const codePoint = character.codePointAt(0);

//         if (codePoint) {
//             const hex = codePoint.toString(16).toUpperCase();
//             const replacement = `\\U${"0".repeat(8 - hex.length)}${hex}`;
//             output = replaceAll(output, character, replacement);
//         }
//     }

//     return output;
// }
