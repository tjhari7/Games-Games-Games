export const ALPHABET_INDEX_LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

// Groups titles that don't start with a letter under "#", matching the
// convention of iOS-style alphabet indexes.
export function letterFor(title) {
  const ch = (title || "").trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

// Splits a list (already sorted) into consecutive { letter, items } groups
// by the first letter of getTitle(item).
export function groupByLetter(items, getTitle) {
  const groups = [];
  for (const item of items) {
    const letter = letterFor(getTitle(item));
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) {
      last.items.push(item);
    } else {
      groups.push({ letter, items: [item] });
    }
  }
  return groups;
}
