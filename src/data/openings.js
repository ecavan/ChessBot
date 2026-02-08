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
  scandinavian_defense: {
    name: 'Scandinavian Defense',
    color: 'black',
    moves: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'd2d4', 'g8f6', 'g1f3', 'c8f5', 'f1c4', 'e7e6'],
    deviations: {
      'e2e4 d7d5 e4d5 g8f6': {
        explanation: "This is the Scandinavian with ...Nf6 (the Modern variation). While solid, ...Qxd5 is the classical Scandi — the queen comes out early but it works! She retreats to a5 with purpose.",
        bookResponse: 'd2d4',
      },
      'e2e4 d7d5 e4d5 d8d5 b1c3 d5d8': {
        explanation: "Retreating to d8 wastes the tempo you gained. ...Qa5 is the best square — it's safe from attack, eyes the e1-a5 diagonal, and supports future ...c6 or ...Bb4 ideas.",
        bookResponse: 'd2d4',
      },
      'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6': {
        explanation: "...Qd6 is playable but blocks your d-pawn and bishop development. ...Qa5 is more natural — the queen is active and out of the way.",
        bookResponse: 'd2d4',
      },
    },
    principles: [
      'Strike the center immediately with ...d5 on move 1',
      'The queen comes out early but retreats to a safe, active square on a5',
      'Develop the light-squared bishop to f5 BEFORE playing ...e6',
      'Build a solid structure with ...e6, ...c6, ...Bd6 or ...Bc5',
      'The Scandi is a great practical weapon — easy to play, hard to refute',
    ],
  },
  elephant_gambit: {
    name: 'Elephant Gambit',
    color: 'black',
    moves: ['e2e4', 'e7e5', 'g1f3', 'd7d5', 'e4d5', 'e5e4', 'f3e5', 'g8f6', 'd2d3', 'f8d6'],
    deviations: {
      'e2e4 e7e5 g1f3 d7d5 e4d5 d8d5': {
        explanation: "Recapturing with the queen is natural but gives White easy development with Nc3. The gambit idea is ...e4! — pushing the pawn forward to kick the knight and seize space.",
        bookResponse: 'b1c3',
      },
      'e2e4 e7e5 g1f3 d7d5 e4d5 e5e4 f3e5 f8d6': {
        explanation: "Developing the bishop first is tempting but ...Nf6 is more accurate — it develops with tempo, threatens the d5 pawn, and prepares rapid development.",
        bookResponse: 'd2d4',
      },
    },
    principles: [
      'Surprise! ...d5 on move 2 sacrifices a pawn for rapid development',
      'After exd5, push ...e4! — the key move, attacking the knight',
      'Develop quickly: ...Nf6, ...Bd6, ...O-O with active piece play',
      'Black gets excellent development compensation for the pawn',
      'A great surprise weapon — most opponents will be out of book immediately',
    ],
  },
  englund_gambit: {
    name: 'Englund Gambit',
    color: 'black',
    moves: ['d2d4', 'e7e5', 'd4e5', 'b8c6', 'g1f3', 'd8e7', 'c1f4', 'e7b4', 'f4d2', 'b4b2'],
    deviations: {
      'd2d4 e7e5 d4e5 d7d6': {
        explanation: "...d6 tries to recover the pawn directly but leads to a boring position. ...Nc6 is the gambit way — develop fast and create threats! The queen will come to e7 with pressure.",
        bookResponse: 'e5d6',
      },
      'd2d4 e7e5 d4e5 b8c6 g1f3 g8e7': {
        explanation: "...Nge7 develops but misses the key idea. ...Qe7 pins the e5 pawn to the king! After Bf4, ...Qb4+ wins the b2 pawn with a discovered trick.",
        bookResponse: 'c1f4',
      },
      'd2d4 e7e5 d4e5 b8c6 g1f3 d8e7 c1f4 d7d6': {
        explanation: "...d6 recovers the pawn but misses the trap. ...Qb4+! is the star move — it forces Bd2 and then ...Qxb2 grabs the b-pawn with a playable position.",
        bookResponse: 'e5d6',
      },
    },
    principles: [
      '1...e5!? is a shock weapon against 1.d4 — most d4 players are unprepared',
      'After dxe5, develop the knight to c6 and queen to e7',
      'The key trick: ...Qb4+ forces Bd2, then ...Qxb2 wins a pawn',
      'Not objectively best, but practically very effective at club level',
      'Play for rapid development and tactical chances',
    ],
  },
  stafford_gambit: {
    name: 'Stafford Gambit',
    color: 'black',
    moves: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'b8c6', 'e5c6', 'd7c6', 'd2d3', 'f8c5'],
    deviations: {
      'e2e4 e7e5 g1f3 g8f6 f3e5 b8c6 e5f3': {
        explanation: "White retreated! That's actually the safe line. But in practice, most players play Nxc6 — that's what we're drilling. After Nxc6 dxc6, Black gets rapid development.",
        bookResponse: 'e2e4',
      },
      'e2e4 e7e5 g1f3 g8f6 f3e5 f6e4': {
        explanation: "...Nxe4 is the safe Petrov continuation. But ...Nc6! is the Stafford Gambit — you sacrifice the pawn for a ferocious attack! After Nxc6 dxc6, your pieces fly out.",
        bookResponse: 'd2d4',
      },
    },
    principles: [
      'Sacrifice the e5 pawn to get explosive development',
      'After Nxc6 dxc6, develop ...Bc5 targeting f2',
      'Common traps: ...Ng4 threatening ...Qh4 and ...Nxf2 forks',
      'Made famous by Eric Rosen — packed with deadly traps',
      'Even if White plays accurately, Black gets practical attacking chances',
    ],
  },
  kings_gambit: {
    name: "King's Gambit",
    color: 'white',
    moves: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4', 'f3e5'],
    deviations: {
      'e2e4 e7e5 f2f4 d7d5': {
        explanation: "This is the Falkbeer Counter-Gambit! Bold, but we're studying the King's Gambit Accepted. After ...exf4, Black grabs the pawn and White gets a strong center + open f-file.",
        bookResponse: 'e4d5',
      },
      'e2e4 e7e5 f2f4 f8c5': {
        explanation: "The King's Gambit Declined with ...Bc5. Solid but passive. We're drilling the Accepted line where Black takes exf4 and tries to hold the extra pawn.",
        bookResponse: 'g1f3',
      },
      'e2e4 e7e5 f2f4 e5f4 g1f3 d7d6': {
        explanation: "...d6 is solid but gives White an easy game. ...g5! is the fighting move — Black defends the f4 pawn and prepares ...g4 to kick the knight. This is the classic King's Gambit battle.",
        bookResponse: 'd2d4',
      },
    },
    principles: [
      'f4 sacrifices a pawn for rapid central control and the open f-file',
      'The most romantic opening in chess — used by Morphy, Anderssen, and Tal',
      'After exf4, Nf3 develops and prevents ...Qh4+',
      'Black tries to hold the pawn with ...g5; White attacks with h4',
      'Ne5 is a powerful outpost — White gets a dangerous initiative',
    ],
  },
  evans_gambit: {
    name: 'Evans Gambit',
    color: 'white',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'b2b4', 'c5b4', 'c2c3', 'b4a5', 'd2d4', 'e5d4', 'e1g1'],
    deviations: {
      'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4c5': {
        explanation: "...Bc5 retreats but gives White a strong center after d4. ...Ba5 is the main line — the bishop stays active on the diagonal and can retreat to b6 later.",
        bookResponse: 'd2d4',
      },
      'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4e7': {
        explanation: "...Be7 is too passive. ...Ba5 maintains pressure. The Evans is all about activity — don't be timid, keep pieces on aggressive squares!",
        bookResponse: 'd2d4',
      },
      'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 d7d6': {
        explanation: "...d6 is solid but lets White build a massive center. ...exd4 is the principled response — accept the gambit and try to survive the attack!",
        bookResponse: 'd1b3',
      },
    },
    principles: [
      'b4! sacrifices a pawn to deflect the Black bishop and build a huge center',
      'After c3 and d4, White has pawns on e4 and d4 with open lines',
      'Castle quickly (O-O) and launch an attack with rapid development',
      'Kasparov used the Evans Gambit to beat Anand — it works at any level!',
      'A favorite of Bobby Fischer and other aggressive players',
    ],
  },
  budapest_gambit: {
    name: 'Budapest Gambit',
    color: 'black',
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6g4', 'c1f4', 'b8c6', 'g1f3', 'f8b4', 'b1d2', 'd8e7'],
    deviations: {
      'd2d4 g8f6 c2c4 e7e5 d4e5 f6e4': {
        explanation: "...Ne4 (the Fajarowicz) is a different gambit entirely. ...Ng4! is the Budapest — the knight attacks e5 and prepares ...Bc5 or ...Bb4+ with active piece play.",
        bookResponse: 'a2a3',
      },
      'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 c1f4 g7g5': {
        explanation: "...g5 tries to win the bishop but weakens the kingside too much. ...Nc6 is the main line — develop pieces and put pressure on e5 before committing pawns.",
        bookResponse: 'f4g3',
      },
    },
    principles: [
      '2...e5!? shocks d4 players — most are not prepared for this gambit',
      'After dxe5, ...Ng4 attacks the e5 pawn immediately',
      'Develop actively: ...Bb4+, ...Nc6, ...Qe7 all pressure e5',
      'Black often regains the pawn with a comfortable position',
      'A practical surprise weapon against 1.d4 2.c4 players',
    ],
  },
};
