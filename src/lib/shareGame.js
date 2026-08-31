// Shares a game by its own details URL rather than whatever page the share was
// tapped from: /random draws afresh on every visit, so its URL would land the
// recipient on some other game entirely.
export async function shareGame(game) {
  if (!game) return;
  const url = `${window.location.origin}/games/${game.id}`;
  const shareData = { title: game.title, text: game.description || undefined, url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to share', err);
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(url).catch((err) => console.error('Failed to copy link', err));
  }
}
