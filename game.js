// 끝말잇기 경주로 — 입력한 단어가 구불구불 이어져 말이 달릴 길이 됩니다.

// ---------- 설정 ----------
const FIRST_WORD = '과자';   // 시작 단어
const FONT = 60;             // 길 글자 크기(px)
const BAND = FONT + 24;      // 길 폭: 위아래 테두리 선 사이 거리(px)
const EDGE = 3;              // 테두리 선 두께(px)
const HORSE_W = 252;         // 말 그림 너비(px) — style.css 의 .horse img 와 맞출 것
const HORSE_H = Math.round(HORSE_W * 219 / 320);
const START_X = 30;          // 말 꼬리가 시작하는 화면 왼쪽 여백
const MARGIN = 24;           // 화면 가장자리 여백
const FRAME_MS = 110;        // 제 속도로 달릴 때 말 그림 한 장이 보이는 시간(ms)
const IDLE_LIMIT = 4;        // 마지막 단어 이후 이 시간(초) 안에 다음 단어를 못 이으면 실패
const SLOW_START = 1.2;      // 마지막 단어 이후 이 시간(초)까지는 제 속도, 그 뒤로 점점 느려져 IDLE_LIMIT 에 길 끝에서 멈춤
const HORSE_FRAMES = ['assets/horse1.png', 'assets/horse2.png', 'assets/horse3.png'];

const board = document.getElementById('board');
const route = document.getElementById('route');
const edgeOuter = document.getElementById('edge-outer');
const edgeInner = document.getElementById('edge-inner');
const roadText = document.getElementById('road-text');
const roadPath = document.getElementById('road-path');
const goal = document.getElementById('goal');
const horse = document.getElementById('horse');
const horseImg = document.getElementById('horse-img');
const form = document.getElementById('word-form');
const input = document.getElementById('word-input');
const hint = document.getElementById('hint');
const message = document.getElementById('message');

const words = [];

// ---------- 한글 처리 ----------
const HANGUL_START = 0xac00;
const isHangulWord = (w) => /^[가-힣]+$/.test(w);

function decompose(ch) {
  const code = ch.charCodeAt(0) - HANGUL_START;
  return { cho: Math.floor(code / 588), jung: Math.floor((code % 588) / 28), jong: code % 28 };
}
function compose({ cho, jung, jong }) {
  return String.fromCharCode(HANGUL_START + cho * 588 + jung * 28 + jong);
}

// 두음법칙: 녀→여, 력→역, 라→나 등
function dueum(ch) {
  const d = decompose(ch);
  const iyVowels = [2, 6, 7, 12, 17, 20]; // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
  if (d.cho === 5) return compose({ ...d, cho: iyVowels.includes(d.jung) ? 11 : 2 }); // ㄹ
  if (d.cho === 2 && iyVowels.includes(d.jung)) return compose({ ...d, cho: 11 });     // ㄴ
  return null;
}

function allowedStarts(lastChar) {
  const alt = dueum(lastChar);
  return alt ? [lastChar, alt] : [lastChar];
}

// ---------- 랜덤 경로 만들기 ----------
// 좌측 상단(말 코끝)에서 출발해 좌우로 굽이치며 화면 오른쪽 아래에서 끝나는 길.
const rand = (a, b) => a + Math.random() * (b - a);

function buildRoute() {
  const W = board.clientWidth;
  const H = board.clientHeight;
  const startX = START_X + HORSE_W;
  const topY = MARGIN + HORSE_H - BAND / 2 + 6;   // 말이 화면 위로 잘리지 않을 높이
  const bottomY = H - MARGIN - BAND / 2;
  const avail = bottomY - topY;

  // 줄 수(홀수: 마지막 줄이 오른쪽으로 향해야 오른쪽 아래에서 끝남)
  const options = [];
  for (let n = 3; n <= 9; n += 2) {
    const gap = avail / (n - 1);
    if (gap >= BAND * 1.45 && gap <= BAND * 3.2) options.push(n);
  }
  if (options.length === 0) for (let n = 3; n <= 9; n += 2) if (avail / (n - 1) >= BAND * 1.3) options.push(n);
  const rows = options.length ? options[Math.floor(Math.random() * options.length)] : 1;
  const gap = rows > 1 ? avail / (rows - 1) : 0;
  const radius = gap / 2;

  // 직선으로 달리다가, 줄 끝에서만 반원으로 꺾여 다음 줄로 넘어감.
  // 꺾이는 위치(왼쪽/오른쪽 끝)는 매번 조금씩 랜덤.
  const f = (n) => n.toFixed(1);
  let y = rows > 1 ? topY : bottomY;
  let d = `M${f(startX)},${f(y)}`;
  for (let r = 0; r < rows; r++) {
    const goingRight = r % 2 === 0;
    if (r === rows - 1) {                       // 마지막 줄: 오른쪽 아래 끝까지 직선
      d += ` L${f(W - MARGIN)},${f(y)}`;
      break;
    }
    const turnX = goingRight
      ? W - MARGIN - radius - BAND / 2 - rand(0, W * 0.15)
      : MARGIN + radius + BAND / 2 + rand(0, W * 0.15);
    d += ` L${f(turnX)},${f(y)}`;               // 직선
    y += gap;
    d += ` A${f(radius)},${f(radius)} 0 0 ${goingRight ? 1 : 0} ${f(turnX)},${f(y)}`; // 반원 회전
  }
  return d;
}

let routeLen = 0;

function setupRoute() {
  route.setAttribute('d', buildRoute());
  routeLen = route.getTotalLength();
  edgeOuter.style.strokeWidth = BAND + EDGE * 2;
  edgeInner.style.strokeWidth = BAND;
  roadText.style.fontSize = FONT + 'px';
  const end = route.getPointAtLength(routeLen);
  goal.setAttribute('x', end.x - 20);
  goal.setAttribute('y', end.y - BAND / 2 - 8);
  updateEdges();
}

// ---------- 단어 깔기 ----------
const WORD_GAP = '  ';   // 단어 사이 띄어쓰기

function layWord(word) {
  if (words.length > 0) roadPath.appendChild(document.createTextNode(WORD_GAP));
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  t.textContent = word;
  roadPath.appendChild(t);
  words.push(word);
  updateEdges();
}

// 지금까지 깔린 길 길이(첫 글자 앞 여백 + 글자들), 경로 끝을 넘지 않게
function roadLength() {
  return Math.min(routeLen, 14 + roadText.getComputedTextLength() + 10);
}

// 테두리 선은 글자가 있는 곳까지만 보이게
function updateEdges() {
  const dash = `${roadLength()} ${routeLen + 100}`;
  edgeOuter.style.strokeDasharray = dash;
  edgeInner.style.strokeDasharray = dash;
}

// ---------- 말 ----------
HORSE_FRAMES.forEach((src) => { new Image().src = src; }); // 미리 불러와 깜빡임 방지

let progress = 0;        // 말 코끝이 길 위에서 나아간 거리(px)
let horseFrame = 0;
let frameTimer = 0;
let started = false;     // 첫 단어를 이으면 출발
let finished = false;    // 도착 또는 실패로 게임이 끝남
let idle = 0;            // 마지막 단어를 이은 뒤 지난 시간(초)

function placeHorse() {
  const s = Math.max(0, Math.min(routeLen, progress));
  const p = route.getPointAtLength(s);
  const a = route.getPointAtLength(Math.max(0, s - 2));
  const b = route.getPointAtLength(Math.min(routeLen, s + 2));
  let deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  // 왼쪽으로 달릴 땐 뒤집어서 말이 거꾸로 서지 않게
  let flip = 1;
  if (Math.abs(deg) > 90) { deg -= 180 * Math.sign(deg); flip = -1; }
  horse.style.transform =
    `translate(${p.x}px, ${p.y}px) rotate(${deg}deg) scaleX(${flip}) ` +
    `translate(${-HORSE_W + 8}px, ${-HORSE_H + BAND / 2 - 8}px)`;
}

// ---------- 말 속도 ----------
// 단어를 이을 때마다 "지금 위치 → 새 길 끝" 구간을 IDLE_LIMIT 초 동안 달리도록 속도를 정합니다.
//  - 처음 SLOW_START 초는 일정한 속도(cruise)로 달리고
//  - 그 뒤로 점점 느려져 IDLE_LIMIT 초에 딱 길 끝에서 멈춥니다.
// 단어를 빨리 이을수록 남은 길이 길어지니 말도 더 빨리 달려요.
let segFrom = 0;   // 구간 시작 위치
let segTo = 0;     // 구간 끝(길 끝)
let cruise = 0;    // 이번 구간의 제 속도(px/초)

function startSegment() {
  segFrom = progress;
  segTo = roadLength();
  idle = 0;
  cruise = (segTo - segFrom) / (SLOW_START + (IDLE_LIMIT - SLOW_START) / 2);
}

// t초 지났을 때 구간에서 나아간 거리와 그때 속도
function segmentAt(t) {
  const T = IDLE_LIMIT, t1 = SLOW_START, v = cruise;
  if (t <= t1) return { dist: v * t, speed: v };
  const u = Math.min(t, T) - t1;
  const slow = T - t1;
  return { dist: v * t1 + v * (u - (u * u) / (2 * slow)), speed: v * (1 - u / slow) };
}

let lastTime = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (!finished) {
    let power = 1;   // 다리 움직임 빠르기 (1 = 제 속도, 0 = 멈춤)
    if (started) {
      idle += dt;
      const { dist, speed } = segmentAt(idle);
      progress = Math.min(segTo, segFrom + dist);
      power = cruise > 0 ? speed / cruise : 0;

      if (progress >= routeLen - 1) endGame(true);
      else if (idle >= IDLE_LIMIT) endGame(false);
    }

    // 스톱모션: 말1 → 말2 → 말3 반복. 느려질수록 다리도 느리게
    frameTimer += dt * 1000 * power;
    if (frameTimer >= FRAME_MS) {
      frameTimer = 0;
      horseFrame = (horseFrame + 1) % HORSE_FRAMES.length;
      horseImg.src = HORSE_FRAMES[horseFrame];
    }
  }

  placeHorse();
  requestAnimationFrame(tick);
}

// ---------- 게임 끝 / 다시하기 ----------
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const retryBtn = document.getElementById('retry');

function endGame(win) {
  finished = true;
  input.disabled = true;
  form.querySelector('button').disabled = true;
  const count = words.length - 1;
  if (win) {
    overlayTitle.textContent = '🏁 도착!';
    overlayText.textContent = `단어 ${count}개로 결승점까지 길을 이었어요.`;
  } else {
    overlayTitle.textContent = '게임 실패';
    overlayText.textContent = `${IDLE_LIMIT}초 안에 단어를 잇지 못해 말이 멈췄어요. (이은 단어 ${count}개)`;
  }
  overlay.classList.toggle('win', win);
  overlay.hidden = false;
  retryBtn.focus();
}

function restart() {
  words.length = 0;
  roadPath.textContent = '';
  progress = 0;
  idle = 0;
  segFrom = segTo = cruise = 0;
  started = false;
  finished = false;
  horseFrame = 0;
  horseImg.src = HORSE_FRAMES[0];
  overlay.hidden = true;
  message.textContent = '';
  input.value = '';
  input.disabled = false;
  form.querySelector('button').disabled = false;
  setupRoute();          // 새 랜덤 길
  layWord(FIRST_WORD);
  updateHint();
  input.focus();
}

retryBtn.addEventListener('click', restart);

// ---------- 안내 문구 ----------
function updateHint() {
  if (finished) return;
  const lastChar = words[words.length - 1].slice(-1);
  const starts = allowedStarts(lastChar);
  const lead = started ? '' : '단어를 이으면 말이 출발해요! · ';
  const left = Math.max(0, Math.round((routeLen - roadLength()) / FONT));
  const tail = roadLength() >= routeLen ? '길 완성! 결승점까지 달려요' : `결승점까지 약 ${left}글자`;
  hint.innerHTML = `${lead}다음 단어는 <b>${starts.join(' / ')}</b>(으)로 시작 · ${tail}`;
}

// ---------- 입력 처리 ----------
function reject(msg) {
  message.textContent = msg;
  input.classList.remove('shake');
  void input.offsetWidth;
  input.classList.add('shake');
}

function addWord(raw) {
  if (finished) return;
  const word = raw.trim();
  if (!word) return;
  if (!isHangulWord(word)) return reject('한글 단어만 입력할 수 있어요.');
  if (word.length < 2) return reject('두 글자 이상 입력해 주세요.');
  if (words.includes(word)) return reject(`'${word}'는 이미 사용한 단어예요.`);
  if (roadLength() >= routeLen) return reject('길이 이미 결승점까지 이어졌어요!');

  const starts = allowedStarts(words[words.length - 1].slice(-1));
  if (!starts.includes(word[0])) {
    return reject(`'${starts.join("' 또는 '")}'(으)로 시작해야 해요.`);
  }

  layWord(word);
  started = true;
  startSegment();         // 새 길 끝을 향해 다시 제 속도로
  message.textContent = '';
  input.value = '';
  updateHint();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  addWord(input.value);
  input.focus();
});

// 한글 IME 조합 중 Enter 가 두 번 들어가는 문제 방지
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.isComposing) e.preventDefault();
});

// 아무 곳이나 키를 누르면 입력창으로 포커스
document.addEventListener('keydown', (e) => {
  if (!overlay.hidden) return;
  if (document.activeElement !== input && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
    input.focus();
  }
});

// 화면 크기가 바뀌면 새 길을 다시 그림 (단어는 그대로 따라감)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { setupRoute(); updateHint(); }, 200);
});

// ---------- 시작 ----------
setupRoute();
layWord(FIRST_WORD);
updateHint();
// 글꼴이 늦게 불러와지면 글자 폭이 바뀌므로 다시 계산
document.fonts && document.fonts.ready.then(() => { updateEdges(); updateHint(); });
requestAnimationFrame(tick);
