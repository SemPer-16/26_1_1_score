(function () {
  const questions = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  const state = {
    pool: [],
    current: 0,
    answers: new Map(),
  };

  const el = {
    seed: document.getElementById('seedInput'),
    limit: document.getElementById('limitInput'),
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
    question: document.getElementById('questionText'),
    answerO: document.getElementById('answerO'),
    answerX: document.getElementById('answerX'),
    result: document.getElementById('resultBox'),
    resultTitle: document.getElementById('resultTitle'),
    explanation: document.getElementById('explanationText'),
    jump: document.getElementById('jumpGrid'),
    wrongCount: document.getElementById('wrongCount'),
    wrongList: document.getElementById('wrongList'),
  };

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
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return Math.min(60, max);
    return Math.max(1, Math.min(parsed, max));
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
    const selectedUnit = el.unit.value;
    const base = selectedUnit === 'all' ? questions : questions.filter((item) => item.unit === selectedUnit);
    const limit = clampLimit(el.limit.value, base.length);
    el.limit.value = limit;
    el.limit.max = base.length;
    state.pool = shuffled(base, el.seed.value).slice(0, limit);
    state.current = 0;
    state.answers = new Map();
    renderJumpGrid();
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
    if (!chosen) return;
    if (value === chosen) button.classList.add('selected');
    if (value === question.answer) button.classList.add('correct');
    if (value === chosen && chosen !== question.answer) button.classList.add('incorrect');
  }

  function render() {
    const question = currentQuestion();
    if (!question) {
      el.question.textContent = '표시할 문항이 없습니다.';
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

    setAnswerButton(el.answerO, question, chosen);
    setAnswerButton(el.answerX, question, chosen);

    if (chosen) {
      el.result.classList.remove('hidden');
      el.resultTitle.className = `result-title ${result ? 'ok' : 'bad'}`;
      el.resultTitle.textContent = result ? `정답입니다. 정답: ${question.answer}` : `오답입니다. 정답: ${question.answer}`;
      el.explanation.textContent = question.explanation;
    } else {
      el.result.classList.add('hidden');
      el.resultTitle.textContent = '';
      el.explanation.textContent = '';
    }

    updateJumpGrid();
    renderWrongList();
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
      if (chosen) button.classList.add('done');
      if (chosen && chosen !== question.answer) button.classList.add('wrong');
    });
  }

  function renderWrongList() {
    const wrongItems = state.pool.filter((question) => {
      const chosen = state.answers.get(question.id);
      return chosen && chosen !== question.answer;
    });
    el.wrongCount.textContent = `${wrongItems.length}개`;
    el.wrongList.textContent = '';

    if (!wrongItems.length) {
      const empty = document.createElement('p');
      empty.className = 'wrong-empty';
      empty.textContent = '아직 오답이 없습니다.';
      el.wrongList.appendChild(empty);
      return;
    }

    wrongItems.forEach((question) => {
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
      detail.textContent = `내 답: ${state.answers.get(question.id)} / 정답: ${question.answer}`;

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
    el.unit.addEventListener('change', startQuiz);
    document.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'o') answerCurrent('O');
      if (event.key.toLowerCase() === 'x') answerCurrent('X');
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    });
  }

  populateUnits();
  bindEvents();
  startQuiz();
}());
