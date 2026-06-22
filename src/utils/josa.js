// ────────────────────────────────────────────────────────────
// 한국어 조사 자동 선택 헬퍼 (17단계).
//   단어 마지막 글자의 받침(종성) 유무를 유니코드로 판정해 알맞은 조사를 붙인다.
//   josa('물배지', '을/를') → '물배지를'
//   josa('불꽃몬', '이/가') → '불꽃몬이'
//   지원 쌍: '을/를', '이/가', '은/는', '와/과', '으로/로', '아/야'
//   한글 음절(0xAC00~0xD7A3)이 아니면(영문·숫자·기호) 받침 없는 것으로 간주.
// ────────────────────────────────────────────────────────────

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONG_COUNT = 28; // 종성 개수(받침 없음 포함)
const JONG_RIEUL = 8; // 'ㄹ' 받침의 종성 인덱스

// 마지막 글자의 받침 정보: { hasJong: 받침 있음, isRieul: 받침이 ㄹ }
function lastCharInfo(word) {
  if (!word || word.length === 0) return { hasJong: false, isRieul: false };
  const code = word.charCodeAt(word.length - 1);
  if (code < HANGUL_BASE || code > HANGUL_LAST) {
    return { hasJong: false, isRieul: false };
  }
  const jong = (code - HANGUL_BASE) % JONG_COUNT;
  return { hasJong: jong !== 0, isRieul: jong === JONG_RIEUL };
}

// 단어에 조사를 붙여서 반환. pair 는 통용 표기('을/를' 등)를 그대로 넘긴다.
export function josa(word, pair) {
  const { hasJong, isRieul } = lastCharInfo(word);
  let suffix;
  switch (pair) {
    case '을/를':
      suffix = hasJong ? '을' : '를';
      break;
    case '이/가':
      suffix = hasJong ? '이' : '가';
      break;
    case '은/는':
      suffix = hasJong ? '은' : '는';
      break;
    case '와/과':
      suffix = hasJong ? '과' : '와';
      break;
    case '으로/로':
      // 받침이 있어도 'ㄹ' 받침이면 '으로'가 아니라 '로'
      suffix = hasJong && !isRieul ? '으로' : '로';
      break;
    case '아/야':
      suffix = hasJong ? '아' : '야';
      break;
    default: {
      // 알 수 없는 쌍은 'A/B'(A=받침 있을 때, B=받침 없을 때)로 해석
      const parts = String(pair).split('/');
      suffix = parts.length === 2 ? (hasJong ? parts[0] : parts[1]) : '';
    }
  }
  return word + suffix;
}
