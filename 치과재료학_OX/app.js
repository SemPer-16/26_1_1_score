(function () {
  const QUESTIONS_CSV = 'questions.csv';
  const COPY_BUTTON_LABEL = '텍스트 복사';
  const DEFAULT_TIME_LIMIT = 10;
  const TIMEOUT_ANSWER = 'TIMEOUT';
  let questions = [];
  let copyStatusTimer = 0;
  let timerId = 0;
  let timerQuestionId = null;
  let timerDeadline = 0;

  const state = {
    pool: [],
    current: 0,
    answers: new Map(),
    timeLimit: DEFAULT_TIME_LIMIT,
  };

  const el = {
    seed: document.getElementById('seedInput'),
    limit: document.getElementById('limitInput'),
    timeLimit: document.getElementById('timeLimitInput'),
    unit: document.getElementById('unitSelect'),
    start: document.getElementById('startButton'),
    prev: document.getElementById('prevButton'),
    next: document.getElementById('nextButton'),
    answered: document.getElementById('answeredCount'),
    total: document.getElementById('totalCount'),
    accuracy: document.getElementById('accuracy'),
    progress: document.getElementById('progressBar'),
    index: document.getElementById('questionIndex'),
    unitName: document.getElementById('questionUnit'),
    timerBox: document.getElementById('timerBox'),
    timerLabel: document.getElementById('timerLabel'),
    timerStatus: document.getElementById('timerStatus'),
    timerBar: document.getElementById('timerBar'),
    question: document.getElementById('questionText'),
    answerO: document.getElementById('answerO'),
    answerX: document.getElementById('answerX'),
    result: document.getElementById('resultBox'),
    resultTitle: document.getElementById('resultTitle'),
    explanation: document.getElementById('explanationText'),
    jump: document.getElementById('jumpGrid'),
    wrongCount: document.getElementById('wrongCount'),
    copyWrong: document.getElementById('copyWrongButton'),
    wrongList: document.getElementById('wrongList'),
  };

  function parseCsvRows(text) {
    const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];

      if (inQuotes) {
        if (char === '"') {
          if (source[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        row.push(field);
        field = '';
        continue;
      }

      if (char === '\r') {
        if (source[i + 1] === '\n') continue;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        continue;
      }

      if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        continue;
      }

      field += char;
    }

    if (inQuotes) {
      throw new Error('CSV 따옴표가 닫히지 않았습니다.');
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter((cells) => cells.some((cell) => cell.trim()));
  }

  function parseQuestionsCsv(text) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map((header) => header.trim());
    const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index]));
    const required = ['id', 'question', 'answer', 'explanation', 'unit'];
    required.forEach((field) => {
      if (!(field in indexByHeader)) {
        throw new Error(`CSV에 ${field} 컬럼이 없습니다.`);
      }
    });

    return rows.slice(1).map((row, index) => {
      const id = Number.parseInt(row[indexByHeader.id], 10);
      const answer = String(row[indexByHeader.answer] || '').trim().toUpperCase();
      const question = row[indexByHeader.question] || '';
      const explanation = row[indexByHeader.explanation] || '';
      const unit = String(row[indexByHeader.unit] || '').trim();

      if (!Number.isFinite(id) || !question.trim() || !['O', 'X'].includes(answer) || !unit) {
        throw new Error(`CSV ${index + 2}행의 문항 형식이 올바르지 않습니다.`);
      }

      return {
        id,
        question,
        answer,
        explanation,
        unit,
      };
    });
  }

  async function loadQuestions() {
    const response = await fetch(QUESTIONS_CSV, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`${QUESTIONS_CSV} 응답 오류: ${response.status}`);
    }
    return parseQuestionsCsv(await response.text());
  }

  function hashSeed(value) {
    const text = String(value || '1');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function next() {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(items, seed) {
    const result = items.slice();
    const random = mulberry32(hashSeed(seed));
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function clampLimit(value, max) {
    if (max < 1) return 0;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return Math.min(60, max);
    return Math.max(1, Math.min(parsed, max));
  }

  function clampTimeLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_TIME_LIMIT;
    return Math.max(1, Math.min(parsed, 300));
  }

  function formatAnswerValue(value) {
    return value === TIMEOUT_ANSWER ? '시간 초과' : value;
  }

  function populateUnits() {
    const units = Array.from(new Set(questions.map((item) => item.unit))).sort((a, b) => a.localeCompare(b, 'ko'));
    units.forEach((unit) => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      el.unit.appendChild(option);
    });
  }

  function startQuiz() {
    stopTimer();
    const selectedUnit = el.unit.value;
    const base = selectedUnit === 'all' ? questions : questions.filter((item) => item.unit === selectedUnit);
    const limit = clampLimit(el.limit.value, base.length);
    state.timeLimit = clampTimeLimit(el.timeLimit.value);
    el.limit.value = limit;
    el.limit.max = base.length;
    el.timeLimit.value = state.timeLimit;
    state.pool = shuffled(base, el.seed.value).slice(0, limit);
    state.current = 0;
    state.answers = new Map();
    renderJumpGrid();
    render();
  }

  function stopTimer() {
    window.clearInterval(timerId);
    timerId = 0;
    timerQuestionId = null;
    timerDeadline = 0;
  }

  function setTimerMode(mode) {
    el.timerBox.classList.remove('low', 'expired', 'paused');
    if (mode) el.timerBox.classList.add(mode);
  }

  function setTimerBar(percent) {
    el.timerBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function renderTimerRemaining() {
    const remaining = Math.max(0, timerDeadline - Date.now());
    const duration = state.timeLimit * 1000;
    const percent = duration ? (remaining / duration) * 100 : 0;

    el.timerLabel.textContent = `남은 시간 ${Math.ceil(remaining / 1000)}초`;
    el.timerStatus.textContent = `${state.timeLimit}초 제한`;
    setTimerBar(percent);
    setTimerMode(percent <= 30 ? 'low' : '');

    if (remaining <= 0 && timerQuestionId) {
      const expiredQuestionId = timerQuestionId;
      stopTimer();
      timeoutQuestion(expiredQuestionId);
    }
  }

  function startTimer(question) {
    stopTimer();
    timerQuestionId = question.id;
    timerDeadline = Date.now() + (state.timeLimit * 1000);
    renderTimerRemaining();
    timerId = window.setInterval(renderTimerRemaining, 100);
  }

  function renderPausedTimer(question, chosen) {
    stopTimer();

    if (!question) {
      el.timerLabel.textContent = `남은 시간 ${state.timeLimit}초`;
      el.timerStatus.textContent = '대기';
      setTimerBar(0);
      setTimerMode('paused');
      return;
    }

    if (chosen === TIMEOUT_ANSWER) {
      el.timerLabel.textContent = '시간 초과';
      el.timerStatus.textContent = '오답 처리';
      setTimerBar(0);
      setTimerMode('expired');
      return;
    }

    el.timerLabel.textContent = '답변 완료';
    el.timerStatus.textContent = '정지';
    setTimerBar(100);
    setTimerMode('paused');
  }

  function syncTimer(question, chosen) {
    if (!question || state.answers.has(question.id)) {
      renderPausedTimer(question, chosen);
      return;
    }

    if (timerQuestionId === question.id && timerId) {
      renderTimerRemaining();
      return;
    }

    startTimer(question);
  }

  function timeoutQuestion(questionId) {
    const question = currentQuestion();
    if (!question || question.id !== questionId || state.answers.has(questionId)) return;
    state.answers.set(questionId, TIMEOUT_ANSWER);
    render();
  }

  function currentQuestion() {
    return state.pool[state.current];
  }

  function answerCurrent(answer) {
    const question = currentQuestion();
    if (!question) return;
    state.answers.set(question.id, answer);
    render();
  }

  function move(delta) {
    if (!state.pool.length) return;
    state.current = Math.max(0, Math.min(state.current + delta, state.pool.length - 1));
    render();
  }

  function score() {
    let correct = 0;
    state.pool.forEach((question) => {
      const chosen = state.answers.get(question.id);
      if (chosen && chosen === question.answer) correct += 1;
    });
    return {
      answered: state.answers.size,
      correct,
      wrong: state.answers.size - correct,
    };
  }

  function setAnswerButton(button, question, chosen) {
    const value = button.dataset.answer;
    button.classList.remove('selected', 'correct', 'incorrect');
    if (!state.answers.has(question.id)) return;
    if (value === chosen) button.classList.add('selected');
    if (value === question.answer) button.classList.add('correct');
    if (value === chosen && chosen !== question.answer) button.classList.add('incorrect');
  }

  function render() {
    const question = currentQuestion();
    if (!question) {
      stopTimer();
      el.total.textContent = '0';
      el.answered.textContent = '0';
      el.accuracy.textContent = '0%';
      el.progress.style.width = '0%';
      el.index.textContent = '0 / 0';
      el.unitName.textContent = '문항 없음';
      el.question.textContent = '표시할 문항이 없습니다.';
      el.prev.disabled = true;
      el.next.disabled = true;
      el.answerO.disabled = true;
      el.answerX.disabled = true;
      renderPausedTimer(null, null);
      renderWrongList();
      return;
    }

    const chosen = state.answers.get(question.id);
    const result = chosen === question.answer;
    const currentNumber = state.current + 1;
    const percent = state.pool.length ? (currentNumber / state.pool.length) * 100 : 0;
    const totals = score();
    const accuracy = totals.answered ? Math.round((totals.correct / totals.answered) * 100) : 0;

    el.total.textContent = state.pool.length;
    el.answered.textContent = totals.answered;
    el.accuracy.textContent = `${accuracy}%`;
    el.progress.style.width = `${percent}%`;
    el.index.textContent = `${currentNumber} / ${state.pool.length}`;
    el.unitName.textContent = question.unit;
    el.question.textContent = question.question;
    el.prev.disabled = state.current === 0;
    el.next.disabled = state.current === state.pool.length - 1;
    el.answerO.disabled = false;
    el.answerX.disabled = false;

    setAnswerButton(el.answerO, question, chosen);
    setAnswerButton(el.answerX, question, chosen);
    syncTimer(question, chosen);

    if (state.answers.has(question.id)) {
      el.result.classList.remove('hidden');
      el.resultTitle.className = `result-title ${result ? 'ok' : 'bad'}`;
      if (chosen === TIMEOUT_ANSWER) {
        el.resultTitle.textContent = `시간 초과입니다. 정답: ${question.answer}`;
      } else {
        el.resultTitle.textContent = result ? `정답입니다. 정답: ${question.answer}` : `오답입니다. 정답: ${question.answer}`;
      }
      el.explanation.textContent = question.explanation;
    } else {
      el.result.classList.add('hidden');
      el.resultTitle.textContent = '';
      el.explanation.textContent = '';
    }

    updateJumpGrid();
    renderWrongList();
  }

  function renderReadyState() {
    stopTimer();
    state.pool = [];
    state.current = 0;
    state.answers = new Map();
    el.total.textContent = '0';
    el.answered.textContent = '0';
    el.accuracy.textContent = '0%';
    el.progress.style.width = '0%';
    el.index.textContent = '0 / 0';
    el.unitName.textContent = '대기';
    el.question.textContent = '새로 출제를 눌러 문제를 생성하세요.';
    el.prev.disabled = true;
    el.next.disabled = true;
    el.answerO.disabled = true;
    el.answerX.disabled = true;
    el.result.classList.add('hidden');
    el.resultTitle.textContent = '';
    el.explanation.textContent = '';
    el.jump.textContent = '';
    renderPausedTimer(null, null);
    renderWrongList();
  }

  function wrongItems() {
    return state.pool.filter((question) => {
      return state.answers.has(question.id) && state.answers.get(question.id) !== question.answer;
    });
  }

  function updateCopyButton(items) {
    if (!el.copyWrong) return;
    el.copyWrong.disabled = !items.length;
    if (!items.length) {
      el.copyWrong.textContent = COPY_BUTTON_LABEL;
    }
  }

  function formatWrongNote(items) {
    const lines = [`오답노트 (${items.length}개)`];
    items.forEach((question, listIndex) => {
      const index = state.pool.findIndex((item) => item.id === question.id);
      lines.push(
        '',
        `${listIndex + 1}. ${index + 1}번 [${question.unit}]`,
        `문제: ${question.question}`,
        `내 답: ${formatAnswerValue(state.answers.get(question.id))} / 정답: ${question.answer}`,
        `해설: ${question.explanation}`
      );
    });
    return lines.join('\n');
  }

  async function writeClipboardText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      if (!document.execCommand('copy')) {
        throw new Error('복사 명령을 실행하지 못했습니다.');
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function copyWrongNote() {
    const items = wrongItems();
    if (!items.length || !el.copyWrong) return;

    el.copyWrong.disabled = true;
    window.clearTimeout(copyStatusTimer);

    try {
      await writeClipboardText(formatWrongNote(items));
      el.copyWrong.textContent = '복사됨';
    } catch (error) {
      el.copyWrong.textContent = '복사 실패';
      console.error(error);
    }

    el.copyWrong.disabled = !wrongItems().length;
    copyStatusTimer = window.setTimeout(() => {
      el.copyWrong.textContent = COPY_BUTTON_LABEL;
      updateCopyButton(wrongItems());
    }, 1400);
  }

  function renderJumpGrid() {
    el.jump.textContent = '';
    state.pool.forEach((question, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = index + 1;
      button.addEventListener('click', () => {
        state.current = index;
        render();
      });
      el.jump.appendChild(button);
    });
  }

  function updateJumpGrid() {
    Array.from(el.jump.children).forEach((button, index) => {
      const question = state.pool[index];
      const chosen = state.answers.get(question.id);
      button.className = '';
      if (index === state.current) button.classList.add('current');
      if (state.answers.has(question.id)) button.classList.add('done');
      if (state.answers.has(question.id) && chosen !== question.answer) button.classList.add('wrong');
    });
  }

  function renderWrongList() {
    const items = wrongItems();
    el.wrongCount.textContent = `${items.length}개`;
    updateCopyButton(items);
    el.wrongList.textContent = '';

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'wrong-empty';
      empty.textContent = '아직 오답이 없습니다.';
      el.wrongList.appendChild(empty);
      return;
    }

    items.forEach((question) => {
      const index = state.pool.findIndex((item) => item.id === question.id);
      const item = document.createElement('article');
      item.className = 'wrong-item';

      const moveButton = document.createElement('button');
      moveButton.type = 'button';
      moveButton.textContent = `${index + 1}번으로 이동`;
      moveButton.addEventListener('click', () => {
        state.current = index;
        render();
        document.querySelector('.quiz-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const title = document.createElement('p');
      title.textContent = question.question;

      const detail = document.createElement('p');
      detail.textContent = `내 답: ${formatAnswerValue(state.answers.get(question.id))} / 정답: ${question.answer}`;

      item.append(moveButton, title, detail);
      el.wrongList.appendChild(item);
    });
  }

  function bindEvents() {
    el.start.addEventListener('click', startQuiz);
    el.prev.addEventListener('click', () => move(-1));
    el.next.addEventListener('click', () => move(1));
    el.answerO.addEventListener('click', () => answerCurrent('O'));
    el.answerX.addEventListener('click', () => answerCurrent('X'));
    el.copyWrong.addEventListener('click', copyWrongNote);
    el.unit.addEventListener('change', startQuiz);
    document.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'o') {
        event.preventDefault();
        answerCurrent('O');
      }
      if (key === 'x') {
        event.preventDefault();
        answerCurrent('X');
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      }
    });
  }

  function setQuizEnabled(enabled) {
    [el.seed, el.limit, el.timeLimit, el.unit, el.start, el.answerO, el.answerX, el.prev, el.next].forEach((control) => {
      control.disabled = !enabled;
    });
    if (el.copyWrong) el.copyWrong.disabled = true;
  }

  function renderLoadError(error) {
    stopTimer();
    console.error(error);
    el.total.textContent = '0';
    el.answered.textContent = '0';
    el.accuracy.textContent = '0%';
    el.progress.style.width = '0%';
    el.index.textContent = '0 / 0';
    el.unitName.textContent = '로딩 오류';
    el.question.textContent = '문항 CSV를 불러오지 못했습니다.';
    el.result.classList.remove('hidden');
    el.resultTitle.className = 'result-title bad';
    el.resultTitle.textContent = '문항 로딩 실패';
    el.explanation.textContent = '로컬 파일로 직접 열었다면 HTTP 서버로 실행해 주세요.';
    el.wrongList.textContent = '';
    renderPausedTimer(null, null);
    renderWrongList();
  }

  async function init() {
    setQuizEnabled(false);
    el.question.textContent = '문항을 불러오는 중입니다.';

    try {
      questions = await loadQuestions();
      populateUnits();
      bindEvents();
      setQuizEnabled(true);
      renderReadyState();
    } catch (error) {
      renderLoadError(error);
    }
  }

  init();
}());
