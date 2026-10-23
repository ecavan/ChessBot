/**
 * Basics: short lessons on what decides games below 1000. Each has the idea, three worked examples
 * (Lichess puzzles, CC0, rated about 400–1150) and a theme for practice puzzles.
 * example = [id, fen, uci moves, rating]: the first move is the opponent's, as in all puzzles.
 */
export const LESSONS = [
  {
    id: "hanging", title: "Free pieces", theme: "hangingPiece",
    idea: "Most games under 1000 are decided by a piece left where it can be taken for free.",
    body: ["A piece is hanging when it is attacked and not defended, or attacked by something cheaper than itself. Taking it costs you nothing.", "Every time he moves, look at what his move left behind: the piece that moved may now be loose, and so may whatever it used to defend."],
    checks: ["What did his last move stop defending?", "Can I take anything for free?", "Is anything of mine attacked and undefended?"],
    examples: [["T9Nx6", "4n2k/pp4pP/5rP1/3pR3/8/3P1PQK/2q5/8 b - - 12 43", "c2d3 e5e8 f6f8 e8f8", 515], ["53T6q", "b2k3r/2b2ppp/R3p3/8/4PB2/5P2/1P2K1PP/8 b - - 0 28", "c7f4 a6a8 d8e7 a8h8", 637], ["9DFJ3", "2b3k1/p1r1Nppp/8/1PR5/P2NnPP1/3pr2P/8/3R2K1 b - - 2 28", "c7e7 c5c8 e7e8 c8e8", 491]],
  },
  {
    id: "defend", title: "Blunder check", theme: "defensiveMove",
    idea: "Before you move, ask what he would do if it were his turn. Then make sure your move still handles it.",
    body: ["Look at his checks, captures and threats: every check he could give, every capture he could make, every piece of yours he attacks.", "If one of them wins something, deal with it first: move the piece, defend it, block, or make a bigger threat of your own."],
    checks: ["What is he threatening right now?", "After my move, what are his checks and captures?", "Does my move leave something hanging?"],
    examples: [["cRieq", "1r3n1k/6pp/Rq3r2/4p3/3pB3/2pQ2P1/2P2PP1/R5K1 b - - 9 36", "b6b1 a1b1 b8b1 g1h2", 1030], ["JBSLe", "5bk1/p1p4p/1p1p2p1/1B2q1B1/PP2n2P/6n1/2P3PK/R3Q3 w - - 3 28", "b5c4 d6d5 c4d5 e5d5", 1019], ["0WwQ3", "3r3r/p1p1k1q1/2Qp1p2/3Bp3/P3P2p/3P1b2/5PPB/R4RK1 w - - 3 23", "c6c7 d8d7 c7d7 e7d7", 854]],
  },
  {
    id: "mate1", title: "Mate in one", theme: "mateIn1",
    idea: "Always look at every check you have. Sometimes one of them is mate.",
    body: ["Checkmate means the king is attacked and has no escape: no square to run to, no way to block, and the checking piece can't be taken.", "Most mates in one happen against a king boxed in by its own pieces. Count the king's escape squares and ask which check covers all of them."],
    checks: ["List every check I have.", "Where can his king go after each one?", "Can he take the checking piece or block?"],
    examples: [["AlfeN", "r1q2rk1/pbpn1ppp/1p6/3Pp1N1/8/6P1/PPQ1PPBP/R2R2K1 b - - 0 15", "c8d8 c2h7", 617], ["JRWT9", "2b3k1/r3nppp/p1nRp3/1p2N3/1P2P3/PBN5/5PPP/6K1 b - - 2 18", "c6e5 d6d8", 426], ["ET05H", "r1bq1rk1/1pp1bppp/pn6/4P3/3nQ3/3B1NB1/PPPN2PP/R4RK1 b - - 4 13", "e7c5 e4h7", 615]],
  },
  {
    id: "backrank", title: "Back-rank mate", theme: "backRankMate",
    idea: "A king behind a wall of its own pawns can be mated by a rook or queen on the back rank.",
    body: ["If the pawns in front of a castled king haven't moved, the king has no way out. A rook or queen landing on the back rank is mate unless something can take it or block.", "Defending it is simple: give your king a window (h3 or h6) when you have a quiet moment, and keep a rook on the back rank until you do."],
    checks: ["Is his king stuck behind its pawns?", "Can my rook or queen reach his back rank?", "Who guards that rank, and can I remove or distract them?"],
    examples: [["Hk3G6", "r1bq1rk1/1pn4p/pn2p1p1/2p3N1/P2bN3/3P2Q1/BPP3PP/R1B2RK1 w - - 2 17", "g1h1 f8f1", 580], ["LHVLn", "r1b1qQ1k/ppp3pp/8/3np3/3P4/8/PP4PP/RNB2RK1 b - - 0 19", "e8f8 f1f8", 438], ["jBx9M", "2kr3r/ppp2p1p/2n2N2/8/5b2/5P2/PPP2PPP/2KR1B1R w - - 1 13", "c1b1 d8d1", 485]],
  },
  {
    id: "fork", title: "Forks", theme: "fork",
    idea: "One piece attacks two things at once. He can only save one.",
    body: ["Knights fork best because nothing can block them, but every piece can fork: a pawn attacking two pieces, a queen attacking a loose piece and the king.", "Look for two targets that are undefended or worth more than your forking piece, and a square that attacks both. A check plus an attack is the strongest fork."],
    checks: ["Which of his pieces are loose or valuable?", "Is there one square that hits two of them?", "Can I give check while attacking something else?"],
    examples: [["xsw0X", "8/8/R4p2/5b2/6kp/6p1/6P1/6K1 w - - 2 59", "g1f1 f5d3 f1e1 d3a6", 741], ["F0iSR", "8/7p/3r4/1R3bk1/6p1/1B4P1/PP4K1/8 w - - 0 42", "b3c2 d6d2 g2g1 d2c2", 746], ["TMHl9", "8/7p/6p1/2bpk3/6P1/5P1P/4K3/2N5 b - - 2 67", "e5f4 c1d3 f4g3 d3c5", 672]],
  },
  {
    id: "pin", title: "Pins", theme: "pin",
    idea: "A piece that can’t move without exposing something more valuable behind it.",
    body: ["Bishops, rooks and queens pin along lines. If the piece behind is the king, the pinned piece can't legally move at all.", "Once a piece is pinned, attack it again, with a pawn if you can: he can't run away with it."],
    checks: ["Are his king and queen on a line with a piece between?", "Can my bishop, rook or queen line up on them?", "Is one of his pieces already pinned, and can I attack it again?"],
    examples: [["LlM4F", "3r4/p3k2p/3qb3/2p3p1/8/1P2N3/P1P1QPPP/6K1 b - - 3 27", "h7h6 e3f5 e7f6 f5d6", 901], ["vWHD5", "rn3rk1/ppp5/3p1npp/3Pp3/4P3/2N2B2/PPPQ1K2/R7 w - - 0 17", "d2h6 f6g4 f2e2 g4h6", 983], ["tthp3", "2kr3r/ppp2p2/6P1/2b1p3/4Q3/2P5/PP3qPP/RN3RK1 w - - 0 18", "f1f2 d8d1 e4e1 d1e1", 860]],
  },
  {
    id: "skewer", title: "Skewers", theme: "skewer",
    idea: "A pin turned around: the valuable piece is in front, and when it moves, the one behind falls.",
    body: ["Skewers usually come with check. The king has to move, and whatever stood behind it on the same line is lost.", "Look for his king and an undefended rook or queen on the same rank, file or diagonal, with nothing between them."],
    checks: ["Are his king and another piece on one line?", "Can I check along that line?", "Is the piece behind undefended?"],
    examples: [["p3I3b", "3N3R/ppp1k3/2p5/8/6PK/1P6/r7/8 w - - 0 46", "g4g5 a2h2 h4g3 h2h8", 811], ["Hmnop", "8/8/3k2r1/p2P2pp/P1K5/7P/8/1R6 b - - 1 44", "g5g4 b1b6 d6e5 b6g6", 831], ["SzD4B", "4b3/1r6/RPp1p3/2k3p1/4p1P1/5K2/8/1R6 w - - 0 40", "f3e4 e8g6 e4e5 g6b1", 832]],
  },
  {
    id: "discovered", title: "Discovered attacks", theme: "discoveredAttack",
    idea: "Move one piece out of the way, and the piece behind it attacks. Two threats in one move.",
    body: ["When your bishop, rook or queen is lined up behind one of your own pieces, moving that front piece opens the line. The front piece can make its own threat at the same time.", "Discovered check is the strongest: he must answer the check, and the piece that moved takes whatever it attacked."],
    checks: ["Which of my pieces are lined up behind my own pieces?", "What does the line hit if I open it?", "Can the moving piece check or attack something too?"],
    examples: [["2ufj5", "r1b1k2r/1p2bp1p/pq2p1p1/3pP3/3N4/1P1B4/P4PPP/RN1Q1RK1 b kq - 0 12", "b6d4 d3b5 a6b5 d1d4", 838], ["Ko1ZD", "r2r2k1/ppq2ppp/3bp3/8/3nB3/4B2P/PP3PP1/1R1Q1RK1 w - - 0 17", "d1d4 d6h2 g1h1 d8d4", 810], ["21tP4", "3rr1k1/pp3p2/6p1/3B3p/3R3P/6b1/PP4P1/3R3K b - - 0 28", "e8e5 d5f7 g8f7 d4d8", 738]],
  },
  {
    id: "trapped", title: "Trapped pieces", theme: "trappedPiece",
    idea: "A piece with nowhere safe to go can be won just by attacking it.",
    body: ["Pieces get trapped on the edge of the board and deep in the opponent's camp: a bishop that grabbed a pawn on a7, a knight on the rim, a queen hunting pawns.", "Before you grab material, check that your piece can get back out. When his piece has gone far, count its escape squares."],
    checks: ["Has one of his pieces wandered far from home?", "How many safe squares does it have?", "Can I attack it so that none are left?"],
    examples: [["6HipK", "r2q3r/pQn3pp/1bpkp3/8/2P1pP2/8/PP1P2PP/RNB2R1K w - - 3 16", "b1c3 a8b8 b7b8 d8b8", 1137], ["FVyHX", "1k1r1b1r/ppp3pp/3p1p2/6B1/3qP1Q1/3B4/PPP3PP/RN5K w - - 0 14", "g5d2 d4b2 g4d1 b2a1", 1148], ["Hz2to", "r2qkb1r/ppp2ppp/3p4/3np3/1P4b1/3B1N2/P1PN1PPP/R1BQK2R w KQkq - 0 11", "a2a3 d5c3 c1b2 c3d1", 1115]],
  },
  {
    id: "defender", title: "Removing the defender", theme: "capturingDefender",
    idea: "If one piece holds his position together, take it, chase it or distract it.",
    body: ["Sometimes a target is defended only once. Capture the defender (even giving up material), push it away with a pawn, or lure it somewhere else, and the target falls.", "Ask of every piece he has: what is it defending? A piece with two jobs can't do both."],
    checks: ["What is defending the thing I want?", "Can I take that defender or chase it away?", "Does one of his pieces have two jobs?"],
    examples: [["MVzDL", "8/1b3k1p/p6P/3Rrp2/1P2p3/6PB/5P2/3R2K1 b - - 0 44", "e5d5 d1d5 b7d5 h3f5", 872], ["IuHqC", "rn2kb1r/pp2ppp1/2p5/3b4/3P3B/2P2N1P/P1P2PP1/R3KB1R w KQkq - 1 12", "f1e2 d5f3 e2f3 h8h4", 936], ["bGQO8", "1q4k1/4rp1p/2n3p1/3p4/Q1pPb3/2P2NP1/4BP1P/4R1K1 w - - 0 26", "a4c6 e4f3 e2f3 e7e1", 1001]],
  },
  {
    id: "mate2", title: "Mate in two", theme: "mateIn2",
    idea: "Forcing moves first: a check or a sacrifice that leaves him one reply, then mate.",
    body: ["Two-move mates usually start with a check or a capture that takes away his choices. Look at the most forcing moves first, even ones that give up a piece.", "Picture the position after his only reply and look for the mate in one there."],
    checks: ["What are my checks and captures?", "After each, what can he do?", "Is there a mate in one in the position that follows?"],
    examples: [["fIBFV", "5Q2/7p/6b1/6pk/6P1/P6P/7K/3qq3 b - - 0 54", "h5h4 f8h6 g6h5 h6h5", 639], ["OUSxK", "3rr1k1/p4ppp/2p5/2Qb4/7N/2P3PP/PP3P2/3Rq1K1 w - - 0 30", "d1e1 e8e1 g1h2 e1h1", 681], ["fD5ea", "1k5r/2p2ppn/B3p1p1/2q5/8/2P3B1/1P1R1P1P/2KR4 b - - 1 31", "c5a7 d2d8 h8d8 d1d8", 483]],
  },
  {
    id: "promotion", title: "Promotion", theme: "promotion",
    idea: "A pawn that reaches the last rank becomes a queen. Clear its path and it can be worth more than any piece.",
    body: ["A passed pawn has no enemy pawns in front of it or on the files beside it. The closer it gets, the more of his army it ties down.", "To push it through, remove or distract the piece blocking it, often with a sacrifice or a check, then promote."],
    checks: ["Do I have a passed pawn?", "What stops it from queening?", "Can I deflect or capture the blocker?"],
    examples: [["7g5Se", "r5k1/3P1ppp/8/6P1/5BKP/1pq5/p7/R1R5 b - - 1 38", "c3a1 c1c8 a8c8 d7c8q", 1071], ["yhmXL", "5rk1/2P2ppp/3Q4/1p3P2/2qp2P1/4n2P/5K2/4R3 b - - 4 39", "f8c8 d6d8 c8d8 c7d8q", 1071], ["wTkjw", "1R6/2P1kpp1/3p3p/3Pp3/2P1P3/8/K6P/3q4 b - - 4 55", "d1a4 a2b2 a4c4 c7c8q", 939]],
  },
];
export const lessonById = (id) => LESSONS.find(l => l.id === id);
