# Cafe24 인스타그램 피드 — 앱 없이 퍼블 + 스크립트로 구현하기

## 1. 결론: 가능한가?

**가능합니다.** Cafe24 앱스토어 앱 없이 HTML 섹션과 JS 파일만으로 인스타그램 공식 API(`graph.instagram.com`)를 호출해서 피드를 노출할 수 있습니다.

단, 아래 두 가지는 미리 알고 시작해야 합니다.

| 이슈 | 내용 | 대응 |
| --- | --- | --- |
| **토큰 만료** | 장기 액세스 토큰은 **60일** 뒤 만료됨. 서버가 없으면 자동 갱신된 토큰을 저장할 곳이 없음 | ① 50일마다 수동 재발급·교체 ② Cloudflare Worker 프록시로 자동 갱신(권장, `worker/insta-proxy.js`) |
| **토큰 노출** | 순수 스크립트 방식은 페이지 소스에 토큰이 그대로 보임 (읽기 전용 권한이라 계정 탈취 위험은 낮지만, 남이 내 피드 조회에 쓸 수는 있음) | 프록시 사용 시 토큰이 숨겨짐 |

> 참고: 예전에 쓰던 **Instagram Basic Display API는 2024-12-04에 종료**되었습니다. 지금은 **Instagram API with Instagram Login** 방식만 쓸 수 있고, 이 방식은 **비즈니스/크리에이터(프로페셔널) 계정**에서만 동작합니다. 개인 계정은 안 됩니다.

### 방식 비교

| 방식 | 비용 | 토큰 관리 | 디자인 자유도 | 추천 상황 |
| --- | --- | --- | --- | --- |
| A. 순수 스크립트 (토큰 직접 입력) | 무료 | 60일마다 수동 교체 | 100% | 빠른 적용, 유지보수 계약 있음 |
| B. 스크립트 + Cloudflare Worker 프록시 | 무료(무료 플랜 범위) | **자동 갱신** | 100% | **권장** — 유지보수 없이 오래 운영 |
| C. Cafe24 앱스토어 앱 | 유/무료 | 앱이 처리 | 앱 제공 템플릿 한정 | 커스텀 디자인 불필요 |
| D. 외부 위젯(SnapWidget, Elfsight, Behold 등) | 대부분 유료 | 위젯이 처리 | 제한적 | 개발 리소스 없음 |

---

## 2. 업체(클라이언트)가 준비·가입해야 할 것

| # | 항목 | 누가 | 비고 |
| --- | --- | --- | --- |
| 1 | **인스타그램 계정을 프로페셔널 계정으로 전환** | 업체 | 인스타그램 앱 > 설정 > 계정 유형 및 도구 > 프로페셔널 계정으로 전환 (비즈니스 또는 크리에이터, 무료). **공개 계정**이어야 함 |
| 2 | **Meta 개발자 계정 가입** | 업체 또는 에이전시 | [developers.facebook.com](https://developers.facebook.com) — Facebook 계정으로 로그인 후 개발자 등록 (휴대폰/이메일 인증). 장기 운영을 생각하면 **업체 소유 계정으로 만드는 것을 권장** |
| 3 | **Meta 앱 생성** | 앱 소유자 | 앱 만들기 > 사용 사례 "Instagram에서 메시지 및 콘텐츠 관리" (앱 유형: 비즈니스) > **Instagram API with Instagram login** 설정 |
| 4 | **인스타그램 테스터 초대 수락** | 업체 | 앱 > 앱 역할 > 역할 > Instagram 테스터에 계정 추가 → 업체가 인스타그램(웹) 설정 > 웹사이트 권한 > 앱 및 웹사이트 > **테스터 초대**에서 수락 |
| 5 | **액세스 토큰 생성** | 앱 소유자 | Instagram API 설정 > "액세스 토큰 생성" > 인스타그램 계정 추가(업체 로그인 필요) → 장기 토큰(60일) 발급 |
| 6 | (방식 B) **Cloudflare 가입** | 업체 또는 에이전시 | [dash.cloudflare.com](https://dash.cloudflare.com) 무료 플랜. Worker + KV 사용 |

- **페이스북 페이지 연결은 필요 없습니다** (Instagram Login 방식 기준. Facebook Login 방식으로 갈 때만 FB 페이지 연결 필요).
- 본인 계정 피드만 보여주는 용도는 앱을 **개발 모드(Development)** 로 두고 테스터 계정으로 사용할 수 있어, 보통 **앱 검수(App Review)·비즈니스 인증 없이** 진행됩니다. (Meta 정책은 수시로 바뀌므로 작업 시점에 대시보드 안내를 확인)
- 업체에 요청할 것 정리: ① 프로페셔널 전환 완료 여부 ② 인스타 로그인 정보 또는 토큰 발급 시 실시간 로그인/2단계 인증 협조 ③ 테스터 초대 수락 ④ (B 방식) Cloudflare 계정

---

## 3. 작업 순서 (에이전시)

1. 업체 준비사항(위 1~5) 완료 → **장기 토큰** 확보
2. 토큰 테스트: 브라우저 주소창에
   `https://graph.instagram.com/v23.0/me/media?fields=id,media_type,media_url,permalink&limit=3&access_token=토큰`
   → JSON `data` 배열이 나오면 정상
3. 파일 업로드 (FTP 또는 디자인 편집기 > 파일 업로드)
   - `js/insta-feed.js` → 스킨 내 예: `/layout/basic/js/insta-feed.js`
   - CSS는 스킨의 메인 스타일(SCSS: `html/_skin/import/main`)에 `.insta-feed` 블록 병합
4. 메인 HTML(예: `/index.html`)에 `index.html`의 `<section class="main-section ... " id="instagram">` 블록 삽입, 하단에 스크립트 연결
   ```html
   <script src="/layout/basic/js/insta-feed.js"></script>
   ```
5. `.insta-feed`의 `data-token`(A 방식) 또는 `data-endpoint`(B 방식) 입력
6. PC/모바일 확인, 토큰 만료일 **캘린더 등록**(A 방식이면 50일째 재발급 알림)

### data 속성 옵션

| 속성 | 기본값 | 설명 |
| --- | --- | --- |
| `data-token` | (빈 값) | 장기 액세스 토큰 (A 방식) |
| `data-endpoint` | (빈 값) | 프록시 주소 (B 방식, 값이 있으면 token보다 우선) |
| `data-limit` | `8` | 노출 개수 |
| `data-cache` | `60` | 브라우저 캐시(분). API 호출 수/속도 제한 대응 |

토큰·엔드포인트가 모두 비어 있으면 **데모 데이터**로 노출되므로 시안 단계에서 그대로 확인할 수 있습니다.

---

## 4. Cafe24 작업 시 주의사항

- **`{$ }` 문법 충돌**: Cafe24 스마트디자인은 HTML 안의 `{$변수}`를 모듈 변수로 해석합니다. 인라인 `<script>`에서 템플릿 리터럴(`` `${a}` ``)을 쓰면 깨질 수 있으니 **스크립트는 반드시 외부 .js 파일**로 분리합니다. (샘플 JS도 템플릿 리터럴을 쓰지 않음)
- **모바일 스킨 분리 운영 시** 모바일 스킨(`/m/`) 메인에도 동일하게 삽입해야 합니다. (반응형 단일 스킨이면 1회)
- `media_url`은 인스타그램 CDN 주소로 **일정 시간 후 만료**됩니다. 이미지 URL을 HTML에 하드코딩하거나 오래 저장하지 말고 항상 API로 받아옵니다. (샘플은 브라우저 캐시 60분)
- 영상(`VIDEO`)은 `thumbnail_url`, 캐러셀(`CAROUSEL_ALBUM`)은 첫 장 이미지가 노출되며 아이콘 배지로 구분합니다.
- 캡션은 `textContent`로만 삽입해 XSS를 막습니다.
- 토큰 만료 시 피드 영역에 "불러오지 못했습니다" 문구가 나오고 콘솔에 `[insta-feed]` 경고가 찍힙니다 → 토큰 재발급 후 `data-token` 교체 (또는 B 방식 Worker KV 확인).
- 토큰 수동 갱신 API (발급 24시간 이후 ~ 만료 전에만 가능):
  `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=기존토큰`

---

## 5. 파일 구성

```
cafe24-instagram-feed/
├── index.html            ← 최종 샘플 (미르나인 기본 뼈대 + main-section01 인스타 피드)
├── scss/insta-feed.scss  ← 스타일 원본 (BEM: .insta-feed__*)
├── css/insta-feed.css    ← 컴파일 결과
├── js/insta-feed.js      ← 피드 스크립트 (바닐라 JS, 의존성 없음)
└── worker/insta-proxy.js ← (선택) Cloudflare Worker 프록시: 토큰 숨김 + 자동 갱신
```
