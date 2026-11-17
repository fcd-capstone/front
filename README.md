# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## 실행 방법

Node.js 24 LTS와 npm을 사용합니다.

```sh
npm ci
npm run dev
```

개발 서버 주소는 터미널에 표시됩니다. 기본 주소는 `http://localhost:5173`입니다.

```sh
npm run build     # TypeScript 검사 및 배포용 dist 생성
npm run preview   # 빌드 결과 확인
npm run lint      # 정적 검사
npm run test:e2e  # 브라우저 동작 검증
```

브라우저 테스트는 로컬에서 설치된 Google Chrome을 사용합니다. CI에서는 `npx playwright install --with-deps chromium`으로 브라우저를 준비합니다.

## 기술 스택

- React + TypeScript + Vite
- CSS Modules + CSS 변수 기반 다크 테마
- TanStack Query + 데이터 소스 인터페이스
- Recharts 시계열 차트 (지연 로딩)
- Lucide 아이콘
- Playwright 브라우저 테스트, Oxlint 정적 검사, Prettier 포맷

## 현재 구현

- **대시보드**: 노드 A·B 측정값, 센서 선택 비교 그래프, 가상 원인과 근거·신뢰도·우선순위
- **이벤트 이력**: 5개 가상 시나리오의 예시 이벤트, 처리 상태 필터, 상세 조회
- **실험·재생**: 원인 5종 선택, 2분 가상 데이터 재생, 일시정지·초기화·시점 이동·1/2/4배속
- **조치 보고**: 미확인·확인 중·조치 완료와 메모를 브라우저 localStorage에 저장
- 데스크톱·모바일 레이아웃, 미설치·결측 구분, 결측 그래프 단절

가상 시나리오는 30초부터 이상 패턴을 발생시킵니다. 차트와 센서 카드의 수치는 같은 생성 함수를 사용합니다. 이벤트 목록은 전체 예시 목록이며 실제 발생 로그가 아닙니다. 고정된 점수와 신뢰도는 모델 평가 결과가 아닙니다. 정상 관찰 구간의 값 역시 정상 기준값을 정의하지 않습니다.

## API 연동 준비

- `src/domain/types.ts`: 측정값·이벤트·조치 보고 및 `SensorSource` 인터페이스
- `src/data/mock.ts`: 가상 시나리오, 센서 메타데이터, 현재 목업 데이터 소스
- `src/App.tsx`: 화면·재생·로컬 보고 상태
- `src/SensorChart.tsx`: 시계열 차트
- `docs/api-coordination.md`: 백엔드와 확정할 연동 항목

현재 실제 HTTP 요청, MQTT 연결, CSV 업로드, 모델 학습은 구현하지 않았습니다. API 연동 시 센서 소스 외에 이벤트·조치·재생 제어도 서버 데이터로 전환해야 합니다. 실제 실험 라벨 조회는 API 제공 후 연결합니다.
