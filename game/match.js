// คะแนนของชุดการแข่งขันอยู่กับห้อง ไม่อยู่กับเกมแต่ละรอบ
const TARGET_WINS = 3;

function createMatch() {
  return { target: TARGET_WINS, round: 0, scores: {}, winner: null, roundWinner: null };
}

function beginRound(match, playerIds) {
  if (match.winner) {
    match.round = 0;
    match.scores = {};
    match.winner = null;
  }
  for (const id of playerIds) {
    if (!Object.hasOwn(match.scores, id)) match.scores[id] = 0;
  }
  match.round++;
  match.roundWinner = null;
}

// afterChange อาจถูกเรียกซ้ำหลังจบเกม: ให้แต้มได้แค่ครั้งเดียวต่อรอบ
function recordRoundWin(match, playerId) {
  if (!match.round || match.roundWinner || match.winner || !Object.hasOwn(match.scores, playerId)) return false;
  match.roundWinner = playerId;
  match.scores[playerId]++;
  if (match.scores[playerId] >= match.target) match.winner = playerId;
  return true;
}

module.exports = { createMatch, beginRound, recordRoundWin };
