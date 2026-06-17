# 치과재료학 OX 퀴즈

엑셀 문제은행을 기반으로 만든 정적 웹 퀴즈입니다. 빌드 과정이나 서버 없이 `index.html`을 브라우저에서 열면 동작합니다.

## 파일 구성

- `index.html`: 화면 구조
- `style.css`: 반응형 스타일
- `app.js`: 랜덤 출제, 채점, 오답노트 로직
- `questions.js`: 엑셀에서 변환한 10,000문항 데이터
- `치과재료학_OX퀴즈_랜덤풀이_10000제.xlsx`: 원본 엑셀 파일

## GitHub Pages 배포

1. 이 폴더의 파일을 GitHub 저장소에 올립니다.
2. 저장소의 `Settings` > `Pages`로 이동합니다.
3. `Deploy from a branch`를 선택합니다.
4. 브랜치는 `main`, 폴더는 `/root`를 선택합니다.
5. 안내되는 Pages 주소로 접속합니다.

## 문항 데이터 갱신

엑셀의 `OX퀴즈_10000` 시트를 수정한 뒤 `questions.js`를 다시 생성하면 됩니다. 데이터 구조는 다음 필드를 사용합니다.

- `id`
- `question`
- `answer`
- `explanation`
- `unit`
