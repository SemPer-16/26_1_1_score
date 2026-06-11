# GitHub Pages 배포

이 폴더는 `index.html`을 엔트리로 사용하는 정적 PWA 구조입니다.

## 포함 파일

- `index.html`: GitHub Pages 루트 진입점
- `manifest.webmanifest`: 설치 정보
- `sw.js`: 오프라인 캐시용 service worker
- `icons/icon.svg`: 앱 아이콘
- `해부학_성적_mobile.html`: 원본 모바일 단일 파일

## 배포 순서

1. 이 폴더 내용을 GitHub 저장소 루트에 올립니다.
2. GitHub 저장소에서 `Settings -> Pages`로 이동합니다.
3. `Build and deployment`에서 `Source`를 `Deploy from a branch`로 선택합니다.
4. 배포 브랜치를 `main` 또는 `master`, 폴더는 `/ (root)`로 선택합니다.
5. 저장 후 몇 분 뒤 `https://<사용자명>.github.io/<저장소명>/` 주소로 접속합니다.

## 아이폰 Safari 설치

1. GitHub Pages 주소를 Safari로 엽니다.
2. 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.

## 데이터 갱신

현재 데이터는 `index.html` 내부에 직접 들어 있습니다.
엑셀을 바꿨다면 `index.html`과 `해부학_성적_mobile.html` 안의 `const students = [...]`를 최신 데이터로 교체한 뒤 다시 푸시해야 합니다.
