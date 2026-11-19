# 백엔드 연동 상태

2026-11-19 기준 `fcd-capstone/backend` 커밋 `73ecd80`의 v0.4 구현과 UPDATE_v0.3.md, UPDATE_v0.4.md, openapi-implemented.json을 확인했습니다. 기본 CSV 화면과 별도 가상 데모를 유지하면서 이벤트·처리 보고·실험 라벨을 추가 연결했습니다.

## 연결한 API

기본 URL은 `http://localhost:8000/api/v1`입니다. 성공 응답은 `{ data, meta }`, 오류는 FastAPI의 `{ detail }` 형식을 처리합니다.

| 메서드 | 경로                              | 용도                                       |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/health`                         | 버전·분석 설정·라벨 지원 확인              |
| GET    | `/datasets`                       | sample / calibration / experiment 목록     |
| POST   | `/sessions`                       | 일시정지 재생 세션 생성                    |
| GET    | `/sessions/{id}`                  | 상태·배속·시각·generation·분석 비활성 사유 |
| GET    | `/sessions/{id}/snapshot`         | 노드별 수치·품질·분석 요약·활성 이벤트 수  |
| PATCH  | `/sessions/{id}/replay`           | play/pause/stop/seek/set_speed             |
| GET    | `/sessions/{id}/series`           | 노드·센서별 최근 5분 시계열                |
| GET    | `/sessions/{id}/stream`           | snapshot.updated SSE                       |
| GET    | `/sessions/{id}/events`           | 현재 재생 세대 이벤트 목록                 |
| GET    | `/sessions/{id}/events/{eventId}` | 판단 근거·권장 조치·처리 이력              |
| PATCH  | `/sessions/{id}/events/{eventId}` | 버전 검사를 포함한 처리 보고 저장          |
| GET    | `/datasets/{datasetId}/labels`    | 실험 회차·취소·제외·오프라인 평가 마스크   |

## 분석 상태

- v0.3 이상에서 이벤트 API를 지원합니다. 현재 기본 rules.json은 비활성·빈 규칙입니다. API 구현과 실험으로 검증된 원인 분류의 완료는 다릅니다.
- sample은 `format_only`, calibration은 `calibration_only`, 규칙이 없는 experiment는 `rules_not_configured`로 안내합니다. health.capabilities.analysis=false는 현재 규칙 설정이 꺼져 있음을 의미할 수 있습니다.
- snapshot의 warming_up / anomaly / no_rule_match / uncertain을 각각 분석 준비 중 / 추정 원인 / 규칙 미충족 / 판별 보류로 표시합니다. no_rule_match를 정상으로 바꾸지 않습니다.
- 복수 원인의 snapshot.cause=null은 단일 원인으로 채우지 않으며 이벤트 목록으로 상세 조회합니다.
- confidence=null은 미제공입니다. priority.score는 설정자가 정한 검증 전 고정값이며 가중치 기반 위험도·확률·평가 정확도가 아닙니다.
- 근거의 unit=null은 단위를 임의로 붙이지 않습니다.
- 이벤트 목록은 REST로 1초마다 재조회합니다. SSE는 snapshot만 제공하므로 이를 이벤트 이력 스트림으로 해석하지 않습니다.

## 처리 보고

- 상태는 new(미확인), acknowledged(접수), in_progress(확인 중), resolved(조치 완료)입니다.
- 서버가 허용하는 전진 상태만 선택할 수 있습니다. 이상 lifecycle active/ended와 처리 상태는 별개입니다.
- PATCH 본문은 `{handling_status, note, expected_version}`입니다. 보고 저장에 실패하면 메모를 유지합니다.
- 409 충돌 시 최신 이벤트를 재조회하고 상태 확인 후 다시 저장하도록 안내합니다. 자동으로 덮어쓰거나 재시도하지 않습니다.
- 메모는 최대 2000자이며 상태 변경과 함께 저장합니다. 메모 단독 수정·동일 상태 저장·완료 상태 수정은 현재 API에서 지원하지 않습니다.
- 보고는 SQLite에 저장되지만 세션은 메모리입니다. 서버 재시작 후 과거 세션·보고를 다시 조회하는 API는 아직 없습니다.

## 재생 격리

- seek는 generation을 증가시키고 일시정지·수신 구간 초기화를 수행합니다. 이후 play가 필요합니다.
- 시점 이동 시 이전 이벤트 선택을 해제합니다. 이전 세션/세대의 이벤트와 SSE는 현재 화면에 표시하지 않습니다.
- 보고 저장 중에는 재생 제어를 잠가 현재 보고 대상의 세대가 바뀌지 않도록 합니다.
- 완료·중지 후 다시 재생은 시작점으로 seek 후 play합니다. 배속은 0.5/1/2/4/5/10입니다.
- 세션 404는 새 세션 생성 안내로 처리합니다. SSE는 이력 버퍼가 없어 1초 REST 폴링을 병행합니다.

## v0.4 데이터 변경

- B 보정은 v3이며 PM은 무보정입니다. 프론트에서 재보정하지 않습니다.
- 차압은 원본 부호를 화면에 표시하고, 백엔드 분석 특징에서만 부호를 반전합니다.
- 2026-11-17 16:48 KST 이전 모션은 배선 사유로 사용 안 함입니다. `disabled`를 미감지 0으로 바꾸지 않습니다.
- B 습도는 제외, A 습도는 카드 전용입니다. 습도 시계열 및 B CO₂·차압 시계열은 요청하지 않습니다.
- 예열·포화·결측·갱신 지연·미설치·사용 안 함을 구분합니다. 그래프는 quality=ok만 표시하고 결측을 연결하지 않습니다.
- DB 식별 키는 node+ts이며 seq=0을 허용합니다. 프론트는 서버가 제공하는 측정값을 재생하므로 별도 중복 제거를 수행하지 않습니다.
- 기본 DB는 backend_v04.sqlite3입니다. 이전 DB_PATH는 그대로 사용하면 호환되지 않습니다. 새 경로로 CSV를 재적재하며 기존 DB를 덮어쓰지 않습니다.

## 실험 라벨

선택한 experiment 데이터셋의 라벨을 조회합니다. 연결된 라벨이 없는 데이터셋은 빈 목록을 표시합니다. 자동 판별 결과와 실제 실험 원인 라벨을 구분합니다.

취소(cancelled), 파일럿 시각·모션 오염(pilot_timing_or_motion), run 48 PM, run 79 A 모션 마스크를 표시합니다. 센서 마스크는 오프라인 평가 전용이며 화면 수치나 온라인 규칙에 적용하지 않습니다. 오프라인 평가 JSON·학습 결과는 운영 판별에 자동 적용되지 않습니다.

## 남은 범위

실험으로 검증된 규칙 확정·학습 모델 적용, 가중치 기반 우선순위, MQTT live, 과거 세션 재개·조회, 인증·감사 기록은 후속 범위입니다. 가상 데모는 `/?mode=demo`로 분리하고 서버 데이터와 혼합하지 않습니다.
