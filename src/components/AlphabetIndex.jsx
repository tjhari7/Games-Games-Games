import { useRef, useState } from 'react';
import { ALPHABET_INDEX_LETTERS } from '../lib/alphabetIndex.js';

// Fixed A-Z (+ #) index rail for jumping to a lettered section in a long
// alphabetically-sorted list. Supports tap-to-jump and iOS-style drag
// scrubbing: press and drag up/down the rail to sweep through letters,
// with a magnified bubble showing the letter currently under the finger.
// Letters with no matching section render dimmed and inert.
export default function AlphabetIndex({ presentLetters, onSelect }) {
  const lastLetterRef = useRef(null);
  const [activeLetter, setActiveLetter] = useState(null);
  const [bubbleY, setBubbleY] = useState(0);

  function letterAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const letterEl = el?.closest('.alphabet-index-letter');
    return letterEl?.dataset.letter || null;
  }

  function handleMove(clientX, clientY) {
    const letter = letterAtPoint(clientX, clientY);
    if (!letter) return;
    setBubbleY(clientY);
    setActiveLetter(letter);
    if (presentLetters.has(letter) && lastLetterRef.current !== letter) {
      lastLetterRef.current = letter;
      onSelect(letter);
    }
  }

  function handlePointerDown(e) {
    // Capture so drags that momentarily leave the rail's narrow hit area
    // keep receiving move events; safe to ignore if the browser rejects it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no-op
    }
    lastLetterRef.current = null;
    handleMove(e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (e.buttons === 0) return;
    handleMove(e.clientX, e.clientY);
  }

  function endDrag() {
    setActiveLetter(null);
    lastLetterRef.current = null;
  }

  return (
    <>
      <div
        className="alphabet-index"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {ALPHABET_INDEX_LETTERS.map((letter) => {
          const present = presentLetters.has(letter);
          return (
            <span
              key={letter}
              data-letter={letter}
              className={`alphabet-index-letter ${present ? '' : 'alphabet-index-letter-empty'}`}
              aria-label={`Jump to ${letter}`}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {activeLetter && (
        <div className="alphabet-index-bubble" style={{ top: bubbleY }} aria-hidden="true">
          {activeLetter}
        </div>
      )}
    </>
  );
}
