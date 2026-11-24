// Castling rights from the game's move list.
//
// A board shows where the kings and rooks stand, not whether they moved: a king
// that castled and walked back, or a rook that left a1 and returned, looks the
// same as one that never moved. The move list records that history, so each
// content script passes the SAN moves it can read and gets back the castling
// rights that history still allows.
(() => {
  const FIGURINES = { '♔': 'K', '♚': 'K', '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N', '♙': '', '♟': '' };

  // Rook home squares and the right each one carries.
  const ROOK_SQUARES = { h1: 'K', a1: 'Q', h8: 'k', a8: 'q' };

  // Reduce a displayed move ("12.", "Nf3+", "0-0", "♘xe5!?") to plain SAN.
  function normalizeSan(text) {
    if (typeof text !== 'string') return null;
    let san = text.replace(/[♔♚♕♛♖♜♗♝♘♞♙♟]/g, glyph => FIGURINES[glyph])
      // Icon fonts can leave private-use glyphs in the text; keep SAN only.
      .replace(/[^a-hxKQRBNO0-9=+#!?.\-]/g, '')
      .replace(/^\d+\.+/, '')
      .replace(/[+#!?]+$/g, '')
      .replace(/0/g, 'O');
    if (/^O-O(-O)?$/.test(san)) return san;
    if (!/[a-h][1-8]/.test(san)) return null;
    return san;
  }

  // Squares a move lands on. Castling also moves the rook, but the rook only
  // moves from its own home square, so the castling side already loses it.
  function destination(san) {
    const squares = san.replace(/=[QRBN]$/, '').match(/[a-h][1-8]/g);
    return squares ? squares[squares.length - 1] : null;
  }

  // sanMoves: main-line moves in order, starting with White's first move of a
  // game from the standard starting position.
  function lostCastlingRights(sanMoves) {
    const lost = new Set();
    if (!Array.isArray(sanMoves)) return lost;
    sanMoves.forEach((text, ply) => {
      const san = normalizeSan(text);
      if (!san) return;
      const white = ply % 2 === 0;
      if (san.startsWith('O-O') || san.startsWith('K')) {
        // Any king move, castling included, ends both rights for that side.
        for (const right of white ? 'KQ' : 'kq') lost.add(right);
        return;
      }
      // A move that lands on a rook's home square means that rook left or was
      // captured there; either way its right is gone for good.
      const right = ROOK_SQUARES[destination(san)];
      if (right) lost.add(right);
    });
    return lost;
  }

  // Combine rights read from the board ("KQkq", "Kq", "-") with the move list.
  function castlingRights(boardRights, sanMoves) {
    const lost = lostCastlingRights(sanMoves);
    const rights = [...(boardRights === '-' ? '' : boardRights || '')]
      .filter(right => !lost.has(right))
      .join('');
    return rights || '-';
  }

  globalThis.ChessingMoveHistory = { normalizeSan, lostCastlingRights, castlingRights };
})();
