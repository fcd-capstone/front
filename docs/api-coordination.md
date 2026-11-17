# 백엔드 연동 상태

2026-11-17 기준 `fcd-capstone/backend`의 커밋 `1f36db3`과 `openapi-implemented.json`, 실제 `app/server.py` 구현을 확인했습니다. 별도 전달받은 `FCD_frontend_optional_integration.zip`은 참고 자료로 검토했으며, 화면을 덮어쓰지 않고 기존 다크 디자인에 연결했습니다.

## 현재 연결한 API

기본 URL은 `http://localhost:8000/api/v1`이며 성공 응답은 `{ data, meta }` 형식입니다. 현재 오류는 FastAPI의 `{ detail }` 형식을 처리합니다.

| 메서드 | 경로                      | 용도                                                          |
| ------ | ------------------------- | ------------------------------------------------------------- |
| GET    | `/health`                 | 서버 버전·기능 지원 확인                                      |
| GET    | `/datasets`               | 측정 파일 목록                                                |
| POST   | `/sessions`               | `{mode: "replay", dataset_id, speed: 1}`로 일시정지 세션 생성 |
| GET    | `/sessions/{id}`          | 상태·배속·서버 재생 시각·generation                           |
| GET    | `/sessions/{id}/snapshot` | 노드별 현재 수치·품질·측정 시각                               |
| PATCH  | `/sessions/{id}/replay`   | play/pause/stop/seek/set_speed                                |
| GET    | `/sessions/{id}/series`   | 노드·센서·최근 5분 시계열                                     |
| GET    | `/sessions/{id}/stream`   | `snapshot.updated` SSE                                        |

## 제어 규칙

- `seek`는 `{action: "seek", ts}`를 전송합니다. generation이 증가하고 state는 paused, 수신 데이터는 초기화됩니다. 이후 play가 필요합니다.
- 완료·중지 후 play는 서버가 409를 반환하므로, UI의 다시 재생은 먼저 시작점으로 seek한 뒤 play합니다.
- 배속은 0.5/1/2/4/5/10입니다. 완료·중지 상태에서는 배속을 변경하지 않습니다.
- SSE는 재연결 이력 버퍼가 없으므로 1초 REST 폴링을 병행합니다. 이전 세션/세대의 SSE는 무시합니다.
- 서버 404 세션 만료는 새 세션 생성 안내로 처리합니다.

## 데이터 규칙 변경 반영

- B 습도는 사용하지 않으며, A 습도도 카드에만 표시합니다. 양쪽 모두 humidity series는 미지원입니다.
- B CO₂·차압 series는 미지원이며 카드에서 미설치로 표시합니다.
- B v2 보정값은 서버에서 적용합니다. 프론트에서는 재보정하지 않습니다.
- 카드 품질: ok/missing/disabled/not_installed/saturated/warmup/stale.
- 그래프는 ok 값만 표시하고 결측을 연결하지 않습니다. 포화·예열은 수치가 있어도 그래프에서 제외합니다.
- CO₂ 5000ppm 이상 포화 처리, 보정용 첫 30분 예열 제외는 서버 규칙입니다.
- 노드 상태는 재생 데이터 상태이며 실제 장비 연결 상태를 나타내지 않습니다.

## 후속 협의가 필요한 기능

현재 백엔드의 analysis, labels, live 기능은 미지원입니다. `/events`는 빈 배열을 반환하며 정상 판정이 아닙니다. UI는 미지원 안내를 표시하고, 가상 데모는 `/?mode=demo`로 분리했습니다.

추후 원인 판별 API가 준비되면 이벤트 ID, 원인 코드, 신뢰도 범위, 판단 근거, 우선순위 점수·등급·산출 근거, 이벤트 시작·종료, 저신뢰·복합/판별 불가 상태를 확정해야 합니다. 조치 상태·메모 저장과 실험 라벨(run/start/end) API도 별도로 필요합니다.

원본값/보정값 전환, 보정 버전 메타데이터, 차압 부호 확정, 인증, 배포 서버 주소와 CORS도 후속 협의 항목입니다.
