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
  ruy_lopez: {
    name: 'Ruy Lopez',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'],
    deviations: {
      'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6': {
        explanation: 'This is the Berlin Defense, made famous by Kramnik. While very solid, ...a6 is the main line, challenging the bishop immediately.',
        bookResponse: 'e1g1',
      },
      'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5': {
        explanation: "This is the Schliemann/Jaenisch Gambit. Aggressive but risky. ...a6 is the classical approach, gaining space and asking the bishop's intentions.",
        bookResponse: 'd2d3',
      },
      'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6': {
        explanation: 'This is a solid but passive setup. ...Nf6 is more active, developing a piece and attacking e4. You can play ...d6 later.',
        bookResponse: 'c2c3',
      },
    },
    principles: [
      'Bb5 puts pressure on the knight defending e5',
      'Castle early to safety',
      'Build a strong pawn center with c3 and d4',
      'The bishop retreats to a4 maintain pressure while staying flexible',
      'Aim for a long-term positional advantage',
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
  london_system: {
    name: 'London System',
    color: 'white',
    moves: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'e7e6', 'g1f3', 'f8d6', 'f4g3'],
    deviations: {
      'd2d4 d7d5 c1f4 c7c5': {
        explanation: 'An active response, but we continue with the London setup. The key idea is developing the bishop to f4 BEFORE playing e3.',
        bookResponse: 'e2e3',
      },
      'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5': {
        explanation: "A natural challenge to the center. In the London, we're happy to maintain our solid structure and continue development.",
        bookResponse: 'c2c3',
      },
    },
    principles: [
      'Develop the dark-squared bishop to f4 BEFORE playing e3',
      'Build a solid pawn triangle: d4-e3-c3',
      'Develop knights to f3 and d2',
      'Castle kingside, then expand',
      'A reliable, low-theory system that works against almost anything',
    ],
  },
  kings_indian: {
    name: "King's Indian Defense",
    color: 'black',
    moves: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8'],
    deviations: {
      'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5': {
        explanation: "This is the Grunfeld Defense, a different opening entirely. In the King's Indian, we fianchetto with ...Bg7 first and play ...d6, not ...d5.",
        bookResponse: 'c4d5',
      },
      'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 e7e5': {
        explanation: "Playing ...e5 before castling is premature. Complete your kingside development with ...d6 and ...O-O first, then challenge the center.",
        bookResponse: 'd4e5',
      },
    },
    principles: [
      'Fianchetto the kingside bishop to g7',
      'Play ...d6 and castle before challenging the center',
      'Strike with ...e5 when ready (the main break)',
      'The g7 bishop is the key piece — protect it',
      'Be prepared for a complex middlegame with chances on both flanks',
    ],
  },
  french_defense: {
    name: 'French Defense',
    color: 'black',
    moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
    deviations: {
      'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4': {
        explanation: "This is the Rubinstein Variation. While playable, ...Nf6 is the Classical variation which maintains more central tension.",
        bookResponse: 'c3e4',
      },
      'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4': {
        explanation: "This is the Winawer Variation — very sharp and theoretical! ...Nf6 (the Classical) is more straightforward for learning.",
        bookResponse: 'e4e5',
      },
    },
    principles: [
      'The e6-d5 pawn chain is solid but locks in the light-squared bishop',
      'Challenge the center with ...c5 when the time is right',
      'Develop the knight to f6 to pressure e4',
      'Plan to solve the bad bishop problem (trade it or play ...b6 + ...Ba6)',
      'A strategic opening that rewards patience and planning',
    ],
  },
  caro_kann: {
    name: 'Caro-Kann Defense',
    color: 'black',
    moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'b8d7'],
    deviations: {
      'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6': {
        explanation: "Developing the knight to f6 immediately allows Ne4xf6+, doubling your pawns or trading a good piece. ...Nd7 is the Classical, keeping more flexibility.",
        bookResponse: 'e4f6',
      },
      'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5': {
        explanation: "This is the main alternative (Tartakower). While good, ...Nd7 (the Classical) offers more flexibility — you can still play ...Ngf6 and ...Bf5 later.",
        bookResponse: 'e4g3',
      },
    },
    principles: [
      'Support ...d5 with ...c6 for a solid pawn structure',
      'The light-squared bishop is not locked in (unlike the French)',
      'Develop the knight to d7 to avoid premature exchanges',
      'Play ...Ngf6, ...e6, and castle — solid and reliable',
      'A great opening for positional players who like solid positions',
    ],
  },
  scotch_game: {
    name: 'Scotch Game',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6', 'b1c3', 'f8b4'],
    deviations: {
      'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5': {
        explanation: '...Bc5 is the Scotch Classical. Solid, but ...Nf6 is more active — it develops with tempo, attacking e4 immediately.',
        bookResponse: 'c2c3',
      },
      'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 d8h4': {
        explanation: "This is Steinitz's ...Qh4!? — aggressive but risky. The queen can be chased with tempo. ...Nf6 is the modern mainline.",
        bookResponse: 'b1c3',
      },
    },
    principles: [
      'Open the center early with d4 — no slow maneuvering',
      'The knight on d4 is powerful — it centralizes with tempo',
      'Develop quickly and aim for active piece play',
      'White gets open lines at the cost of releasing central tension',
      'Kasparov revived this opening at the top level',
    ],
  },
  english_opening: {
    name: 'English Opening',
    color: 'white',
    moves: ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g1f3', 'b8c6', 'g2g3', 'f8b4'],
    deviations: {
      'c2c4 e7e5 b1c3 g8f6 g1f3 d7d5': {
        explanation: "This is playable but premature. ...Nc6 first keeps more tension — you can play ...d5 later when it's better supported.",
        bookResponse: 'c4d5',
      },
      'c2c4 c7c5': {
        explanation: "This is the Symmetrical English. A valid response, but we're drilling the Reversed Sicilian setup with ...e5.",
        bookResponse: 'b1c3',
      },
    },
    principles: [
      'Control the center from the flank with c4',
      'Fianchetto the kingside bishop (g3 + Bg2) for long-range pressure',
      'The English often transposes into other openings',
      'A flexible, strategic system — no early commitments',
      'Think of it as a Reversed Sicilian with an extra tempo',
    ],
  },
  dutch_defense: {
    name: 'Dutch Defense',
    color: 'black',
    moves: ['d2d4', 'f7f5', 'g2g3', 'g8f6', 'f1g2', 'e7e6', 'g1f3', 'f8e7', 'e1g1', 'e8g8'],
    deviations: {
      'd2d4 f7f5 g2g3 g8f6 f1g2 g7g6': {
        explanation: "This is the Leningrad Dutch with a double fianchetto. While strong, ...e6 (the Classical/Stonewall setup) is more structured for learning.",
        bookResponse: 'g1f3',
      },
      'd2d4 f7f5 g2g3 g8f6 f1g2 d7d5': {
        explanation: "This sets up the Stonewall immediately. ...e6 first is more flexible — you can choose between Stonewall (...d5) and Classical (...d6) later.",
        bookResponse: 'g1f3',
      },
    },
    principles: [
      'Control e4 with ...f5 — the key idea of the Dutch',
      'Develop the kingside and castle before committing the center',
      'The f5 pawn gives attacking chances on the kingside',
      'Watch out for the weakened e8-h5 diagonal (common early trap)',
      'An aggressive, fighting choice against 1.d4',
    ],
  },
  pirc_defense: {
    name: 'Pirc Defense',
    color: 'black',
    moves: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'f1c4', 'f8g7', 'g1f3', 'e8g8'],
    deviations: {
      'e2e4 d7d6 d2d4 g8f6 b1c3 e7e5': {
        explanation: "Playing ...e5 before fianchettoing is the Philidor-like approach. In the Pirc, ...g6 and ...Bg7 first gives you a more flexible setup with kingside counterplay.",
        bookResponse: 'd4e5',
      },
      'e2e4 d7d6 d2d4 g8f6 b1c3 c7c6': {
        explanation: "This transposes toward a Czech Pirc. ...g6 is the pure Pirc — fianchetto the bishop first, then decide on your pawn structure.",
        bookResponse: 'f2f4',
      },
    },
    principles: [
      'Let White build a big center, then undermine it',
      'Fianchetto the bishop to g7 — it will be very powerful later',
      'Play ...d6, ...Nf6, ...g6, ...Bg7, ...O-O before challenging the center',
      'Strike with ...e5 or ...c5 when the time is right',
      'A hypermodern opening — control the center with pieces, not pawns',
    ],
  },
  vienna_game: {
    name: 'Vienna Game',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f1c4', 'f8c5', 'f2f4'],
    deviations: {
      'e2e4 e7e5 b1c3 b8c6': {
        explanation: "...Nc6 is natural but allows White to choose the direction. ...Nf6 is the main line, directly challenging e4 and keeping the game sharp.",
        bookResponse: 'f1c4',
      },
      'e2e4 e7e5 b1c3 g8f6 f1c4 f8c5 d2d3': {
        explanation: "d3 is too passive here. f4! is the Vienna Gambit — the whole point of 2.Nc3! It attacks e5 and opens the f-file for your rook.",
        bookResponse: null,
      },
    },
    principles: [
      'Nc3 supports the f4 advance — the Vienna Gambit',
      'f4 is the key move — attacking the center and opening the f-file',
      'Develop the bishop to c4 before pushing f4',
      'A great surprise weapon — many opponents will be unprepared',
      'Combines Kings Gambit aggression with better development',
    ],
  },
  scholars_mate_attack: {
    name: "Scholar's Mate",
    color: 'white',
    moves: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'],
    deviations: {
      'e2e4 e7e5 f1c4 b8c6 d1h5 d7d6': {
        explanation: "...d6 blocks the bishop but doesn't defend f7. ...Nf6 is the only move that defends f7 AND develops a piece with tempo by attacking the queen.",
        bookResponse: 'h5f7',
      },
      'e2e4 e7e5 f1c4 b8c6 d1h5 d8e7': {
        explanation: "...Qe7 defends f7 but blocks the bishop and makes development awkward. ...Nf6 attacks the queen AND develops — much better!",
        bookResponse: 'b1c3',
      },
      'e2e4 e7e5 f1c4 g8f6': {
        explanation: "Good instinct developing, but ...Nc6 first is better here. It defends e5 and prepares for the Qh5 threat. After ...Nc6, if Qh5 then ...Nf6 defends everything.",
        bookResponse: 'd2d3',
      },
    },
    principles: [
      'White aims for checkmate on f7 in just 4 moves!',
      'Bc4 + Qh5 targets the weak f7 square',
      'This only works if Black plays inaccurately',
      'Learn this to WIN quick games and to DEFEND against it',
      'If Black plays ...Nf6, the queen is misplaced and must retreat',
    ],
  },
  fried_liver_attack: {
    name: 'Fried Liver Attack',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7'],
    deviations: {
      'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5': {
        explanation: "...Na5 (the Traxler-like idea) avoids the Fried Liver. But after exd5, ...Nxd5?? allows Nxf7! — the whole point. We're drilling the full attack.",
        bookResponse: 'c4b5',
      },
      'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 f8c5': {
        explanation: "...Bc5 is the Traxler Counter-Attack — very sharp! But ...d5 is the main response to Ng5. We're studying the Fried Liver line specifically.",
        bookResponse: 'g5f7',
      },
    },
    principles: [
      'Nxf7! sacrifices the knight to expose the Black king',
      'After Kxf7, White plays Qf3+ with a devastating attack',
      'The king is dragged to the center with no escape',
      'One of the most famous attacking patterns in chess',
      'Works at every level — even GMs must know the defense!',
    ],
  },
};
