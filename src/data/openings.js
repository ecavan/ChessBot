export const OPENINGS = {
  italian_game: {
    name: 'Italian Game',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],
    deviations: {
      'e2e4 e7e5 g1f3 d7d6': {
        explanation: 'This is the Philidor Defense. Solid but passive. The book move Nc6 develops with tempo by attacking the e5 pawn.',
        bookResponse: 'd2d4',
      },
      'e2e4 e7e5 g1f3 g8f6': {
        explanation: "This is the Petrov Defense. A valid opening, but we're studying the Italian Game. Nc6 is the mainline here.",
        bookResponse: 'f3e5',
      },
      'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6': {
        explanation: 'This is the Two Knights Defense. Sharp and tactical. The Italian Game mainline is Bc5, developing the bishop to an active diagonal.',
        bookResponse: 'f3g5',
      },
      'e2e4 e7e5 g1f3 b8c6 f1c4 d7d6': {
        explanation: "This is a passive response. Bc5 is preferred as it develops a piece to an active square and prepares castling.",
        bookResponse: 'd2d4',
      },
    },
    principles: [
      'Control the center with e4/d4',
      'Develop knights before bishops',
      'Castle early (kingside)',
      "Don't move the same piece twice in the opening",
      'Develop toward the center',
    ],
  },
  sicilian_najdorf: {
    name: 'Sicilian Najdorf',
    color: 'black',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
    deviations: {
      'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5': {
        explanation: 'This is the Sveshnikov-like ...e5. While playable, ...a6 (the Najdorf) is more flexible, preventing Bb5+ and preparing ...e5 or ...b5 later.',
        bookResponse: 'c3b5',
      },
    },
    principles: [
      'Fight for the center asymmetrically with ...c5',
      'Delay ...d5 until well-prepared',
      'The a6 move prevents Bb5+ and prepares ...e5 or ...b5',
      'Develop knights to f6 and c6',
      'Be ready for tactical complications',
    ],
  },
  queens_gambit: {
    name: "Queen's Gambit Declined",
    color: 'black',
    moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
    deviations: {
      'd2d4 d7d5 c2c4 d5c4': {
        explanation: "This is the Queen's Gambit Accepted. While valid, ...e6 (the QGD) is more solid and keeps the central tension.",
        bookResponse: 'e2e3',
      },
      'd2d4 d7d5 c2c4 c7c6': {
        explanation: "This is the Slav Defense. A solid alternative, but we're studying the QGD. ...e6 develops more harmoniously.",
        bookResponse: 'g1f3',
      },
    },
    principles: [
      'Maintain the d5 pawn as long as useful',
      'Develop the kingside first',
      'Castle early',
      'Break with ...c5 when ready',
      'The e6 pawn supports d5 solidly',
    ],
  },
};
