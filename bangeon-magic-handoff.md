# 방언이 터지는 마법 — 마도서 핸드오프 문서

> 이 문서 한 장으로 GitHub 레포 셋업이 끝나도록 설계됨.
> 클로드코드(또는 사람)가 이 md 하나 보고 11개 파일을 그대로 생성·푸시·연결할 수 있다.

---

## 0. TL;DR — 클로드코드용 1줄 지시

```
이 md를 읽고 § 5에 명시된 11개 파일을 정확히 그 경로/내용으로 생성한 뒤,
git init → 모든 파일 add → commit → GitHub 레포에 푸시.
배포 절차는 § 8 참고.
```

---

## 1. 무엇을 만드는가

**방언이 터지는 마법**은 nesy.app 위에 올라가는 마도서다.
호출 AI(Claude / ChatGPT)가 사용자 메시지에 호출어 `알랄랄랄랄` 또는 다국어 첨삭 의도를 감지하면 이 마도서를 호출한다.

**한 줄 정의**: Grammarly 대체급 다국어 첨삭 + 학습 표현을 자동 SRS 플래시카드로 적재하는 도구.

### 차별점 (왜 Grammarly가 아닌가)

1. **다국어 + 임의 언어 지원** — 영어, 일본어, 중국어뿐 아니라 "메이플 키보드배틀어" 같은 sociolect까지. target_language는 자연어로 박힘.
2. **학습 루프 내장** — 첨삭에서 잡힌 실수가 자동으로 플래시카드(VOCAB / GRAMMAR / PHRASE)로 적재되고 SRS로 복습됨.
3. **변명 시스템 (메타인지)** — 사용자가 첨삭에 동의 안 하면 최대 5턴까지 우기기 가능. 우기기 로그는 시각화에 노출되어 자기 약점 패턴을 보여줌.
4. **호출 AI 자연어 티키타카** — 분석·예시 생성·번역·언어 감지를 호출 AI가 직접 함. 마도서는 저장·스케줄링·매칭에만 집중.

---

## 2. 설계 결정 사항 (의도 기록)

| # | 결정 | 이유 |
|---|---|---|
| 1 | 자연어 목표설정 + 5~7문항 온보딩 인터뷰 | 짧은 자연어만 받으면 GPT 평균치 추측 품질이 LEGA보다 떨어짐. 길게 받으면 사용자가 안 씀. 인터뷰로 한 번에 끝냄. |
| 2 | 변명 5턴 제한 + 우기기 로그 보존 | 무한 우기기 방지. 로그는 시각화에 띄워 메타인지 도구로 활용 — 이게 LEGA에 없던 진짜 차별점. |
| 3 | 마도서는 LLM 호출 안 함 | nesy 지침: "Do NOT add a secret to call another LLM". 분석·예시 생성은 전부 호출 AI(Claude/ChatGPT) 몫. 마도서는 저장·SRS·매칭·로그 누적. |
| 4 | 카드 3타입 (VOCAB / GRAMMAR / PHRASE) + cloze 지원 | 응용언어학 SLA + Anki 커뮤니티 권장: minimum info, cloze deletion, context-rich, active recall. LEGA의 단순 Q→A보다 한 단계 진화. |
| 5 | 시각화 채택 | LEGA는 시각화 거의 없었음. 우기기 통계 / 빈도 / 카테고리 / 14일 시계열을 board에 띄움. |
| 6 | 카테고리 동적 (AI가 카드 적재 시 분류) | "법률영어"와 "메이플어"의 카테고리 체계가 같을 수 없음. 호출 AI가 도메인에 맞게 자유 분류. |
| 7 | SRS 복습은 카드 시스템에 통합 | level 0~5, 간격 [1,3,7,14,30,60]일. LEGA와 동일 알고리즘. |
| 8 | 응답 언어 모드 = `target_only` 기본 | Grammarly처럼 immersive. 사용자가 모국어 설명 요청 시 전환. user_settings로 변경 가능. |
| 9 | 태그 풀로 한 사용자 다중 도메인 관리 | 워크스페이스 분리 안 함. 1차 태그(목표) + 2차 태그(AI 자동분류) + 3차 태그(수동) 조합. |
| 10 | target_language는 카드마다 박힘 | 한 사용자가 법률영어 + 일본어 + 메이플어 동시 학습 가능. user_settings에 default만 두고 카드마다 override. |
| 11 | 호출어 `알랄랄랄랄` + 광범위한 description 트리거 | 명시적 호출어는 보조. 메인은 "외국어 첨삭 의도 자동 감지". 둘 다 살려서 무의식 호출 + 의식 호출 모두 커버. |

### 의심해둘 약점 (나중에 모니터링)

- **사용 흐름의 마찰**: Grammarly는 브라우저 확장이라 어디서든 자동. 이건 사용자가 Claude/ChatGPT 앱 켜고 텍스트를 줘야 함. 와이프 카톡 댓글 케이스에서 부자연스러울 수 있음.
- **5초 budget**: 카드 1000장 넘으면 `data.list("card:")` 한방이 느려질 수 있음. 키 구조에 `card:{lang}:{id}` 분할 이미 적용해 부분 대비.
- **변명 로그 = 잠재 자산**: 사용자별 격리 namespace라 자동 공유는 안 됨. 나중에 익명화해서 다른 마도서에 활용할지 별도 의사결정.

---

## 3. 아키텍처 한눈에

```
사용자
  │
  │  "이 영문 이메일 첨삭해줘, 알랄랄랄랄"
  ▼
호출 AI (Claude / ChatGPT)
  │  ┌─ 문법/어색/격상 직접 분석
  │  ├─ 예시 생성 (필요 시)
  │  ├─ 변명 판정 (acquitted / corrected / give_up)
  │  └─ 응답 언어 매핑
  ▼
방언이 터지는 마법 (nesy 마도서)
  │  ┌─ 저장 (data API, KV)
  │  ├─ 카드 풀 중복 매칭
  │  ├─ SRS 다음 복습일 계산
  │  ├─ 변명 로그 누적 + 5턴 카운트
  │  ├─ 시각화 HTML 렌더링
  │  └─ instruction_to_caller로 호출 AI에 응답 가이드
  ▼
nesy.app (V8 isolate + Supabase KV + Bun bundler)
```

**원칙 한 줄**: 호출 AI는 "두뇌", 마도서는 "기억과 기록".

---

## 4. 9개 tool + 1개 visualization (manifest 요약)

| Tool | 역할 | 트리거 phrase |
|---|---|---|
| `onboard` | 첫 사용 시 학습 프로파일 저장 (인터뷰 결과) | "처음 쓸게", "온보딩", "목표 설정" |
| `check_text` | 호출 AI 분석 결과를 받아 카드 풀과 매칭 + 세션 저장 | "첨삭", "자연스러워?", "어색한지", "Grammarly 돌려줘" |
| `save_correction` | 사용자가 인정한 첨삭 항목을 카드로 적재 | "인정", "저장", "오답노트 추가" |
| `defend` | 변명 턴 카운트 + 로그 누적 (판정은 호출 AI가) | "내 의도는", "변명할게", "이건 일부러" |
| `add_card` | 첨삭과 무관한 직접 카드 추가 | "단어장 추가", "외워야겠다", "플래시카드 만들어" |
| `get_review_queue` | 오늘 복습 큐 (또는 전체 풀) | "오늘 복습", "복습 시작", "외울 거 있어?" |
| `grade_card` | SRS 채점 → level / next_review 갱신 | 복습 중 알았음/모르겠음 |
| `list_cards` | 카드 풀 조회/검색/필터 | "내 카드 몇 개", "법률영어 카드만", "우긴 거" |

**Visualization**: `render_board` — 4개 탭 (overview / by_tag / timeline / defended). user board에서 자동 렌더.

**user_settings 5개**: `default_target_language`, `native_language`, `response_language_mode`, `daily_review_target`, `srs_intervals`.

---

## 5. 디렉토리 구조 + 11개 파일 전체

```
/
├── nesy.yaml                   # 매니페스트
├── package.json                # 의존성 없음
├── README.md                   # nesy 페이지용 짧은 설명
├── index.ts                    # run() 디스패처
├── lib/
│   ├── settings.ts             # readSettings, languageReminder
│   ├── srs.ts                  # SRS_DEFAULT, nextReviewDate
│   └── utils.ts                # uid, todayISO, normalizeKey
└── handlers/
    ├── onboard.ts
    ├── check.ts                # check_text + save_correction
    ├── defend.ts
    ├── cards.ts                # add_card + list_cards
    ├── review.ts               # get_review_queue + grade_card
    └── board.ts                # render_board
```

---

### 5.1 `nesy.yaml`

```yaml
tools:
  - name: onboard
    description: |
      사용자가 처음으로 이 마도서를 쓸 때 학습 프로파일을 저장한다.
      "방언이 터지는 마법 처음 쓸게", "온보딩", "프로파일 만들어줘", "내 목표 설정",
      또는 사용자가 학습 목적을 자연어로 설명하면 호출한다.

      호출 AI(너)의 역할: 사용자에게 다음 5~7가지를 자연어 대화로 물어본 뒤 결과를 정리해서 이 tool에 넘긴다.
        1. 학습 목표 한 줄 (예: "한국 법무법인에서 미국 클라이언트 상대하는 비즈니스 영어")
        2. target_language (영어/일본어/중국어/기타 — 메이플 욕설어 같은 sociolect도 가능)
        3. 사용자의 native_language (한국어 기본)
        4. 현재 수준 (초/중/상 — 자가진단)
        5. 사용 맥락 (이메일/계약서/대화/게임 등 자주 쓰는 장면)
        6. 톤·레지스터 선호 (formal / casual / 둘 다)
        7. 약점 인식 (사용자가 "내가 자주 실수하는 거"라고 말한 것)

      입력은 이미 인터뷰가 끝난 뒤 정리된 결과여야 한다. 인터뷰 전이면 먼저 사용자와 대화한다.

      반환: 저장된 프로파일과 다음 단계 안내.
    inputSchema:
      type: object
      required: [goal, target_language, native_language]
      properties:
        goal:
          type: string
          description: 학습 목표 한 줄 요약
        target_language:
          type: string
          description: 학습 대상 언어. ISO 코드 또는 자연어 라벨 (en, ja, zh, "메이플 욕설어" 등)
        native_language:
          type: string
          description: 사용자 모국어 (기본 ko)
        level:
          type: string
          description: "초/중/상 또는 beginner/intermediate/advanced"
        contexts:
          type: array
          description: 사용 맥락 키워드 배열 (예 ["email", "contract", "chat"])
        tone_preference:
          type: string
          description: formal / casual / both
        known_weaknesses:
          type: string
          description: 사용자가 인식한 자기 약점 (자유 텍스트)

  - name: check_text
    description: |
      사용자가 작성한 외국어 텍스트를 첨삭하는 도구.
      Grammarly 같은 도구를 대체하는 다국어 첨삭/교정 엔진.

      트리거 phrase: "이거 첨삭해줘", "이 문장 자연스러워?", "어색한 부분 잡아줘", "이메일 좀 봐줘",
      "이거 일본어로 맞나?", "더 formal하게", "이거 grammarly 돌려줘 같은 거",
      또는 사용자가 외국어 문장을 던지며 검토를 요청할 때 항상 호출.

      ⚠️ 중요: 호출 AI(너)가 직접 텍스트를 분석해서 errors 배열을 채워서 넣는다.
      이 tool은 분석 엔진이 아니라 "분석 결과를 사용자 카드 풀과 매칭하고 응답을 구조화해서 돌려주는" 역할을 한다.
      네가 해야 할 분석:
        - grammar 오류 (문법 규칙 위반)
        - awkward 표현 (의미는 통하지만 부자연스러움)
        - upgrade 제안 (더 격상된/적절한 표현)
      각 항목에 original / corrected / category / rule_or_reason 을 채워서 넘긴다.
      카테고리는 grammar/awkward/upgrade 외에도 학습 도메인에 맞는 동적 카테고리(예: "honorific", "register") 가능.

      반환: errors 각각에 기존 카드 풀과 매칭된 중복 정보 포함. 사용자에게 인정/변명 옵션 제시.

      응답 언어 규칙: 사용자가 학습 중인 target_language로 응답하는 것이 기본.
      단 사용자가 native_language로 설명을 요청하면 그 언어로.
    inputSchema:
      type: object
      required: [original_text, errors]
      properties:
        original_text:
          type: string
          description: 사용자가 쓴 원문
        target_language:
          type: string
          description: 이 텍스트의 언어 (en, ja 등). 미지정 시 사용자 프로파일 기본값
        mode:
          type: string
          description: "email / contract / chat / casual / 기타 — 사용자 맥락"
        errors:
          type: array
          description: |
            호출 AI가 직접 분석한 항목들. 각 항목은:
            { "original": str, "corrected": str, "category": str, "rule_or_reason": str, "severity": "high"|"medium"|"low" }
        polished_version:
          type: string
          description: 전체 첨삭 후 완성본

  - name: save_correction
    description: |
      check_text 결과 중 사용자가 인정한 첨삭 항목을 카드로 적재한다.
      "이거 인정", "맞네 저장해줘", "전부 인정", "오답노트에 추가" 등에 호출.

      자동으로 카드 타입 결정:
        - 단일 단어/숙어 → vocab
        - 문법 규칙 위반 → grammar
        - 문장/관용구 패턴 → phrase

      이미 같은 카드가 풀에 있으면 카운트만 증가시키고 신규 생성 안 함.
    inputSchema:
      type: object
      required: [original, corrected, category, target_language]
      properties:
        original:
          type: string
          description: 사용자가 잘못 쓴 표현
        corrected:
          type: string
          description: 올바른 표현
        category:
          type: string
          description: grammar / awkward / upgrade / 기타 동적 카테고리
        target_language:
          type: string
          description: 학습 대상 언어
        rule_or_reason:
          type: string
          description: 왜 틀렸는지 / 왜 더 나은지 설명
        example_sentence:
          type: string
          description: 호출 AI가 생성한 예문 (선택)
        cloze_format:
          type: string
          description: |
            cloze deletion 형식 예시. 예 "{{c1::Contact}} someone" — {{c1::정답}} 형태.
            grammar/phrase 카드에 강력 권장.
        tags:
          type: array
          description: 사용자 정의 태그 + 자동 분류 태그 (예 ["법률영어", "email", "transitive_verb"])

  - name: defend
    description: |
      사용자가 첨삭/제안에 동의하지 않고 "내 의도는 ~다"라고 우길 때 호출한다.
      트리거: "근데 내 의도는", "이건 일부러 그런 건데", "변명할게", "이 표현이 맞을 텐데".

      ⚠️ 5턴 제한: 같은 original 항목에 대해 최대 5턴까지 변명 가능.
      마도서가 턴 카운트를 관리하므로 호출 AI는 매번 이 tool을 호출해서 현재 turn_number를 받아본다.
      5턴 초과 시 자동 종료 및 "포기" 로그 적재.

      ⚠️ 판정 자체는 호출 AI(너)가 한다. 마도서는 변명 내용과 판정 결과를 로그에 누적할 뿐.
      네 판정은 verdict 필드로 넘긴다: "acquitted"(무죄) / "corrected"(재판정) / "give_up"(사용자가 포기) / "pending"(다음 턴 필요).

      반환: 누적된 우기기 로그 (시각화 및 메타인지에 사용).
    inputSchema:
      type: object
      required: [original_correction_id, user_argument, turn_number]
      properties:
        original_correction_id:
          type: string
          description: 변명 대상 카드 ID (save_correction 결과로 받은 ID, 또는 original 텍스트 자체)
        user_argument:
          type: string
          description: 사용자가 이번 턴에 한 주장
        turn_number:
          type: integer
          description: 현재 변명 턴 번호 (1~5)
        verdict:
          type: string
          description: 이번 턴 판정. "acquitted" / "corrected" / "give_up" / "pending"
        verdict_reason:
          type: string
          description: 호출 AI의 판정 근거
        final_expression:
          type: string
          description: corrected/acquitted 시 최종 채택될 표현

  - name: add_card
    description: |
      첨삭과 무관하게 사용자가 직접 단어·문법·관용구를 카드로 추가할 때 호출.
      트리거: "이 단어 단어장에 추가", "이 표현 외워야겠다", "플래시카드 만들어줘".

      호출 AI(너)는 사용자가 던진 raw 입력을 받아서 카드 구조로 정리한 뒤 이 tool을 호출한다.
      필요시 예문/cloze를 직접 생성해서 같이 넘긴다 (마도서는 LLM 호출 안 함).
    inputSchema:
      type: object
      required: [front, back, card_type, target_language]
      properties:
        front:
          type: string
          description: 카드 앞면 (학습 대상 표현)
        back:
          type: string
          description: 카드 뒷면 (의미·번역·설명)
        card_type:
          type: string
          description: "vocab / grammar / phrase"
        target_language:
          type: string
          description: 학습 대상 언어
        examples:
          type: array
          description: 예문 배열 (호출 AI가 생성)
        cloze_format:
          type: string
          description: cloze 형식 (선택)
        tags:
          type: array
          description: 태그 배열

  - name: get_review_queue
    description: |
      오늘 복습할 카드 큐를 반환한다. SRS(간격반복) 스케줄에 따라 nextReview 일자가 지난 카드만 포함.
      트리거: "오늘 복습", "플래시카드 시작", "복습 시작", "뭐 외울 거 있어?", "알랄랄랄랄 복습".

      필터 가능: target_language, tags, card_type. 미지정 시 전체.
      필터를 자연어로 받았을 때 호출 AI가 변환해서 넘긴다 ("법률영어만" → tags=["법률영어"]).
    inputSchema:
      type: object
      properties:
        target_language:
          type: string
          description: 특정 언어만 필터
        tags:
          type: array
          description: 특정 태그만 필터 (OR 조건)
        card_type:
          type: string
          description: vocab / grammar / phrase 중 하나만
        limit:
          type: integer
          description: 최대 카드 수 (기본 20)
        include_all:
          type: boolean
          description: true면 nextReview 무시하고 전체 풀에서 추출 (전체 플래시카드 모드)

  - name: grade_card
    description: |
      복습 카드 한 장을 채점한다. "알았음/모르겠음" 또는 0~5 점수.
      트리거: 사용자가 복습 중 정답 확인 후 평가할 때.

      SRS 알고리즘: 정답이면 level +1, 다음 복습 [1,3,7,14,30,60]일 후. 오답이면 level 0 리셋.
    inputSchema:
      type: object
      required: [card_id, correct]
      properties:
        card_id:
          type: string
          description: 채점할 카드 ID
        correct:
          type: boolean
          description: true=알았음, false=모르겠음

  - name: list_cards
    description: |
      카드 풀을 조회/검색한다. "내 카드 몇 개?", "법률영어 카드만 보여줘", "최근 추가한 거",
      "우긴 거 있어?" 등에 호출.

      태그/언어/카테고리/검색어로 필터 가능. 우기기 기록 있는 카드만 별도 필터 가능.
    inputSchema:
      type: object
      properties:
        target_language:
          type: string
        tags:
          type: array
        card_type:
          type: string
        search:
          type: string
          description: front/back 텍스트 부분 일치 검색
        only_defended:
          type: boolean
          description: true면 우기기 로그 있는 카드만
        sort:
          type: string
          description: "recent / frequency / level"
        limit:
          type: integer

user_settings:
  - key: default_target_language
    type: string
    default: en
    description: 새 카드를 만들 때 기본 학습 언어 (사용자가 명시 안 했을 때)
  - key: native_language
    type: string
    default: ko
    description: 사용자 모국어
  - key: response_language_mode
    type: enum
    options: [target_only, native_only, mixed, auto]
    default: target_only
    description: |
      호출 AI 응답 언어 모드.
      target_only=학습 언어로만 (Grammarly처럼 immersive),
      native_only=설명은 항상 모국어로,
      mixed=예시는 target, 설명은 native,
      auto=사용자가 그때그때 요청한 언어
  - key: daily_review_target
    type: integer
    default: 20
    description: 하루 목표 복습 카드 수
  - key: srs_intervals
    type: list_string
    default: ["1", "3", "7", "14", "30", "60"]
    description: SRS 복습 간격 (일 단위, level 0~5)

visualization:
  function: render_board
  cadence: 300
  height: 480
  inputSchema:
    type: object
    properties:
      view:
        type: string
        description: "overview / by_tag / timeline / defended"
      target_language:
        type: string
      tag:
        type: string
```

---

### 5.2 `package.json`

```json
{
  "name": "bangeon-magic",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {}
}
```

---

### 5.3 `README.md`

```markdown
# 방언이 터지는 마법

Grammarly 대체급 다국어 첨삭·교정 도구 + 학습한 표현을 자동으로 SRS 플래시카드로 적재하는 마도서. 호출어 `알랄랄랄랄`.

## 무엇을 하는가
- **자연어 목표설정 + 5~7문항 온보딩 인터뷰**로 학습 프로파일 생성 (target_language는 영어/일본어/메이플어 등 자유).
- 호출 AI(Claude/ChatGPT)가 직접 grammar/awkward/upgrade 분석 → 마도서는 카드 풀 중복 매칭·세션 저장·응답 구조화.
- **변명 시스템**: 첨삭에 동의 안 하면 최대 5턴까지 우기기. 마도서가 턴 카운트·로그를 누적, 판정은 호출 AI가.
- **SRS 플래시카드**: vocab / grammar / phrase 세 타입, cloze deletion 지원, level 0~5, 간격 [1,3,7,14,30,60]일.
- **다국어 풀 + 태그 관리**: 한 사용자가 법률영어, 일본어, 메이플어 동시 학습.
- **시각화 대시보드** (`render_board`): 언어/타입 분포, 14일 추이, 태그 빈도, 우기기 통계.
- **응답 언어 모드**: 기본은 target_language로만 (immersive). 사용자가 모국어 요청 시 전환.

## 디자인 원칙
- **마도서는 LLM을 호출하지 않는다.** 분석·예시·번역은 전부 호출 AI 몫. 마도서는 저장·SRS·매칭·로그·응답 구조화.
- 모든 응답에 `instruction_to_caller` 필드 포함 → 호출 AI 응답 가이드.

## 배포
1. 이 레포를 GitHub default branch에 푸시.
2. nesy.app 마도서 에디터에서 이 레포 연결.
3. "지금 가져오기" 클릭 → Bun이 번들링 후 V8 isolate 배포.

## Secrets
없음. 외부 API 호출 없음. 호출 AI도 직접 부르지 않음.

## 호출어
`알랄랄랄랄` — 사용자 메시지에 박히면 호출 AI가 이 마도서 우선 호출. 의미 없는 의성어라 다른 마도서와 충돌 0%.
```

---

### 5.4 `index.ts`

```typescript
import { readSettings } from "./lib/settings";
import { handleOnboard } from "./handlers/onboard";
import { handleCheckText, handleSaveCorrection } from "./handlers/check";
import { handleDefend } from "./handlers/defend";
import { handleAddCard, handleListCards } from "./handlers/cards";
import { handleGetReviewQueue, handleGradeCard } from "./handlers/review";
import { handleRenderBoard } from "./handlers/board";

export type RunInput = {
  input: { tool: string; args: Record<string, any> };
  secrets: Record<string, string>;
  data: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(
      prefix?: string,
      limit?: number
    ): Promise<{ key: string; value: any; updated_at: string }[]>;
  };
};

export async function run({ input, data }: RunInput): Promise<unknown> {
  const settings = await readSettings(data);

  switch (input.tool) {
    case "onboard":
      return handleOnboard(input.args, data, settings);
    case "check_text":
      return handleCheckText(input.args, data, settings);
    case "save_correction":
      return handleSaveCorrection(input.args, data, settings);
    case "defend":
      return handleDefend(input.args, data, settings);
    case "add_card":
      return handleAddCard(input.args, data, settings);
    case "list_cards":
      return handleListCards(input.args, data, settings);
    case "get_review_queue":
      return handleGetReviewQueue(input.args, data, settings);
    case "grade_card":
      return handleGradeCard(input.args, data, settings);
    case "render_board":
      return handleRenderBoard(input.args, data, settings);
    default:
      throw new Error(`Unknown tool: ${input.tool}`);
  }
}
```

---

### 5.5 `lib/utils.ts`

```typescript
export function uid(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString();
}

export function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
```

---

### 5.6 `lib/srs.ts`

```typescript
export const SRS_DEFAULT = [1, 3, 7, 14, 30, 60];

export function nextReviewDate(level: number, intervals: number[]): string {
  const days = intervals[Math.min(level, intervals.length - 1)] ?? 60;
  return new Date(Date.now() + days * 86400000).toISOString();
}
```

---

### 5.7 `lib/settings.ts`

```typescript
import type { RunInput } from "../index";
import { SRS_DEFAULT } from "./srs";

export type Settings = {
  default_target_language: string;
  native_language: string;
  response_language_mode: "target_only" | "native_only" | "mixed" | "auto";
  daily_review_target: number;
  srs_intervals: number[];
};

export async function readSettings(data: RunInput["data"]): Promise<Settings> {
  const s = ((await data.get("__settings")) as any) ?? {};
  return {
    default_target_language: s.default_target_language ?? "en",
    native_language: s.native_language ?? "ko",
    response_language_mode: s.response_language_mode ?? "target_only",
    daily_review_target: s.daily_review_target ?? 20,
    srs_intervals: (s.srs_intervals ?? SRS_DEFAULT.map(String)).map((x: any) =>
      parseInt(x, 10)
    ),
  };
}

export function languageReminder(settings: Settings, targetLang: string): string {
  switch (settings.response_language_mode) {
    case "target_only":
      return `INSTRUCTION_TO_CALLER: Respond to the user in ${targetLang} only. If the user explicitly requests an explanation in ${settings.native_language}, then switch.`;
    case "native_only":
      return `INSTRUCTION_TO_CALLER: Respond in ${settings.native_language}.`;
    case "mixed":
      return `INSTRUCTION_TO_CALLER: Examples in ${targetLang}; explanations in ${settings.native_language}.`;
    default:
      return `INSTRUCTION_TO_CALLER: Match the user's last message language.`;
  }
}
```

---

### 5.8 `handlers/onboard.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { todayISO } from "../lib/utils";

export async function handleOnboard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const profile = {
    goal: args.goal,
    target_language: args.target_language,
    native_language: args.native_language ?? settings.native_language,
    level: args.level ?? "intermediate",
    contexts: args.contexts ?? [],
    tone_preference: args.tone_preference ?? "both",
    known_weaknesses: args.known_weaknesses ?? "",
    created_at: todayISO(),
  };
  await data.set("profile:current", profile);

  return {
    message: `프로파일 저장 완료. 목표: "${profile.goal}" / 언어: ${profile.target_language}. 이제 첨삭하거나 카드를 추가할 수 있습니다.`,
    profile,
    instruction_to_caller: languageReminder(settings, profile.target_language),
  };
}
```

---

### 5.9 `handlers/check.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { uid, todayISO, normalizeKey } from "../lib/utils";

export async function handleCheckText(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const errors = (args.errors ?? []) as any[];

  // Match each error against existing card pool to find duplicates
  const existing = await data.list("card:");
  const matched = errors.map((e) => {
    const key = normalizeKey(e.original);
    const dup = existing.find((row) => {
      const v = row.value as any;
      return (
        v && normalizeKey(v.front) === key && v.target_language === targetLang
      );
    });
    return {
      ...e,
      duplicate_of: dup ? (dup.value as any).id : null,
      previous_count: dup ? (dup.value as any).count ?? 1 : 0,
    };
  });

  // Save the check session so we can reference it later for defense
  const sessionId = uid();
  await data.set(`session:${sessionId}`, {
    id: sessionId,
    original_text: args.original_text,
    polished_version: args.polished_version,
    errors: matched,
    target_language: targetLang,
    created_at: todayISO(),
  });

  return {
    session_id: sessionId,
    errors: matched,
    polished_version: args.polished_version,
    summary: `${matched.length}개 항목 발견 (${matched.filter((m) => m.duplicate_of).length}개는 반복 패턴).`,
    instruction_to_caller:
      languageReminder(settings, targetLang) +
      " 사용자에게 각 항목을 보여주고 인정/변명 옵션을 제시하세요.",
  };
}

export async function handleSaveCorrection(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language;
  const front = args.original;
  const back = args.corrected;
  const key = normalizeKey(front);

  // Find existing card with same front + language
  const existing = await data.list("card:");
  const dup = existing.find((row) => {
    const v = row.value as any;
    return v && normalizeKey(v.front) === key && v.target_language === targetLang;
  });

  if (dup) {
    const v = dup.value as any;
    v.count = (v.count ?? 1) + 1;
    v.last_seen = todayISO();
    v.back = back;
    v.rule_or_reason = args.rule_or_reason ?? v.rule_or_reason;
    await data.set(dup.key, v);
    return {
      action: "incremented",
      card_id: v.id,
      count: v.count,
      instruction_to_caller: languageReminder(settings, targetLang),
    };
  }

  // Infer card_type from category if not provided
  let cardType = "grammar";
  if (args.category === "vocab" || args.category === "awkward") cardType = "vocab";
  if (args.cloze_format)
    cardType = args.category === "vocab" ? "vocab" : "phrase";

  const card = {
    id: uid(),
    front,
    back,
    card_type: cardType,
    category: args.category,
    rule_or_reason: args.rule_or_reason ?? "",
    example_sentence: args.example_sentence ?? "",
    cloze_format: args.cloze_format ?? "",
    target_language: targetLang,
    tags: args.tags ?? [],
    count: 1,
    level: 0,
    created_at: todayISO(),
    last_seen: todayISO(),
    next_review: nextReviewDate(0, settings.srs_intervals),
    defense_log: [],
  };

  await data.set(`card:${targetLang}:${card.id}`, card);
  return {
    action: "created",
    card,
    instruction_to_caller: languageReminder(settings, targetLang),
  };
}
```

---

### 5.10 `handlers/defend.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { todayISO, normalizeKey } from "../lib/utils";

export async function handleDefend(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const turn = args.turn_number ?? 1;
  const cardId = args.original_correction_id;

  // Find the card
  const rows = await data.list("card:");
  const target = rows.find((r) => (r.value as any)?.id === cardId);

  // If no card exists yet, store defense in a pending log keyed by the original text
  let card: any;
  let key: string;
  if (target) {
    card = target.value;
    key = target.key;
  } else {
    key = `pending_defense:${normalizeKey(cardId)}`;
    const existing = await data.get(key);
    card = existing ?? { id: cardId, defense_log: [], created_at: todayISO() };
  }

  card.defense_log = card.defense_log ?? [];
  card.defense_log.push({
    turn,
    user_argument: args.user_argument,
    verdict: args.verdict,
    verdict_reason: args.verdict_reason,
    final_expression: args.final_expression ?? null,
    timestamp: todayISO(),
  });

  // Handle terminal verdicts
  let outcome = "pending";
  if (args.verdict === "acquitted") {
    outcome = "acquitted";
    card.status = "acquitted";
    if (card.count && card.count > 1) card.count -= 1;
  } else if (args.verdict === "corrected") {
    outcome = "corrected";
    if (args.final_expression) card.back = args.final_expression;
  } else if (args.verdict === "give_up" || turn >= 5) {
    outcome = "given_up";
    card.status = "given_up";
  }

  await data.set(key, card);

  return {
    turn_number: turn,
    turns_remaining: Math.max(0, 5 - turn),
    outcome,
    defense_log: card.defense_log,
    instruction_to_caller:
      languageReminder(
        settings,
        card.target_language ?? settings.default_target_language
      ) +
      (turn >= 5
        ? " 5턴 한도 도달. 더 이상 변명 불가."
        : ` ${5 - turn}턴 남음.`),
  };
}
```

---

### 5.11 `handlers/cards.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { uid, todayISO } from "../lib/utils";

export async function handleAddCard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const targetLang = args.target_language ?? settings.default_target_language;
  const card = {
    id: uid(),
    front: args.front,
    back: args.back,
    card_type: args.card_type ?? "vocab",
    examples: args.examples ?? [],
    cloze_format: args.cloze_format ?? "",
    target_language: targetLang,
    tags: args.tags ?? [],
    count: 1,
    level: 0,
    created_at: todayISO(),
    last_seen: todayISO(),
    next_review: nextReviewDate(0, settings.srs_intervals),
    defense_log: [],
  };
  await data.set(`card:${targetLang}:${card.id}`, card);
  return {
    action: "created",
    card,
    instruction_to_caller: languageReminder(settings, targetLang),
  };
}

export async function handleListCards(
  args: any,
  data: RunInput["data"],
  _settings: Settings
) {
  const rows = await data.list("card:");
  let cards = rows.map((r) => r.value as any).filter(Boolean);

  if (args.target_language)
    cards = cards.filter((c) => c.target_language === args.target_language);
  if (args.tags && args.tags.length) {
    cards = cards.filter((c) =>
      (c.tags ?? []).some((t: string) => args.tags.includes(t))
    );
  }
  if (args.card_type) cards = cards.filter((c) => c.card_type === args.card_type);
  if (args.only_defended)
    cards = cards.filter((c) => (c.defense_log ?? []).length > 0);
  if (args.search) {
    const q = args.search.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.front?.toLowerCase().includes(q) || c.back?.toLowerCase().includes(q)
    );
  }

  if (args.sort === "recent")
    cards.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
  else if (args.sort === "level")
    cards.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  else cards.sort((a, b) => (b.count ?? 1) - (a.count ?? 1));

  return {
    cards: cards.slice(0, args.limit ?? 50),
    total: cards.length,
  };
}
```

---

### 5.12 `handlers/review.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings, languageReminder } from "../lib/settings";
import { nextReviewDate } from "../lib/srs";
import { todayISO } from "../lib/utils";

export async function handleGetReviewQueue(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const rows = await data.list("card:");
  const now = todayISO();
  let cards = rows
    .map((r) => r.value as any)
    .filter((c) => c && (args.include_all || !c.next_review || c.next_review <= now));

  if (args.target_language)
    cards = cards.filter((c) => c.target_language === args.target_language);
  if (args.card_type)
    cards = cards.filter((c) => c.card_type === args.card_type);
  if (args.tags && args.tags.length) {
    cards = cards.filter((c) =>
      (c.tags ?? []).some((t: string) => args.tags.includes(t))
    );
  }

  // Sort by frequency desc, then level asc (weak high-frequency first)
  cards.sort(
    (a, b) => (b.count ?? 1) - (a.count ?? 1) || (a.level ?? 0) - (b.level ?? 0)
  );

  const limit = args.limit ?? settings.daily_review_target;
  cards = cards.slice(0, limit);

  return {
    queue: cards,
    total: cards.length,
    instruction_to_caller:
      languageReminder(
        settings,
        args.target_language ?? settings.default_target_language
      ) + " 카드를 한 장씩 제시하고 사용자가 답한 뒤 grade_card로 채점하세요.",
  };
}

export async function handleGradeCard(
  args: any,
  data: RunInput["data"],
  settings: Settings
) {
  const rows = await data.list("card:");
  const target = rows.find((r) => (r.value as any)?.id === args.card_id);
  if (!target) throw new Error(`Card not found: ${args.card_id}`);
  const card = target.value as any;
  card.level = args.correct
    ? Math.min((card.level ?? 0) + 1, settings.srs_intervals.length - 1)
    : 0;
  card.next_review = nextReviewDate(card.level, settings.srs_intervals);
  card.last_seen = todayISO();
  await data.set(target.key, card);
  return {
    card_id: card.id,
    new_level: card.level,
    next_review: card.next_review,
  };
}
```

---

### 5.13 `handlers/board.ts`

```typescript
import type { RunInput } from "../index";
import { type Settings } from "../lib/settings";
import { todayISO } from "../lib/utils";

export async function handleRenderBoard(
  args: any,
  data: RunInput["data"],
  _settings: Settings
) {
  const rows = await data.list("card:");
  const cards = rows.map((r) => r.value as any).filter(Boolean);

  const view = args.view ?? "overview";
  const total = cards.length;
  const byType: Record<string, number> = { vocab: 0, grammar: 0, phrase: 0, other: 0 };
  const byLang: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let defended = 0;
  let acquitted = 0;
  let givenUp = 0;

  const today = new Date();
  const daily: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    daily[d] = 0;
  }

  for (const c of cards) {
    const t = c.card_type ?? "other";
    byType[t] = (byType[t] ?? 0) + 1;
    byLang[c.target_language ?? "?"] = (byLang[c.target_language ?? "?"] ?? 0) + 1;
    for (const tag of c.tags ?? []) byTag[tag] = (byTag[tag] ?? 0) + 1;
    if ((c.defense_log ?? []).length > 0) {
      defended++;
      if (c.status === "acquitted") acquitted++;
      if (c.status === "given_up") givenUp++;
    }
    const d = (c.created_at ?? "").slice(0, 10);
    if (d in daily) daily[d]++;
  }

  const tagRows = Object.entries(byTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const langRows = Object.entries(byLang).sort((a, b) => b[1] - a[1]);
  const dailyMax = Math.max(1, ...Object.values(daily));
  const safeTotal = Math.max(1, total);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,'Noto Sans KR',sans-serif;background:#0f1923;color:#e8e4df;padding:14px;margin:0;font-size:13px}
h2{color:#c9a96e;font-size:14px;margin:0 0 10px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat{background:#14222f;padding:10px;border-radius:6px;text-align:center}
.stat .v{font-size:22px;color:#c9a96e;font-weight:700}
.stat .l{font-size:10px;color:#5a6a7a;margin-top:2px}
.row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px}
.row .label{min-width:80px;color:#7a8a9a}
.bar{height:6px;background:#1a2a3a;border-radius:3px;flex:1;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#c9a96e,#a08040)}
.spark{display:flex;gap:2px;align-items:flex-end;height:40px;margin-top:6px}
.spark div{flex:1;background:#5d8ae8;border-radius:1px;min-height:1px}
.tab{display:flex;gap:6px;margin-bottom:12px}
.tab button{padding:4px 10px;background:transparent;border:1px solid #2a3a4a;color:#7a8a9a;border-radius:14px;font-size:10px;cursor:pointer}
.tab button.on{border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.1)}
.def{padding:8px;background:rgba(232,184,93,0.08);border-radius:6px;margin-top:8px;font-size:11px}
.def .num{color:#e8b85d;font-weight:700}
</style></head><body>
<h2>방언이 터지는 마법 ▸ 보드</h2>
<div class="tab">
  ${["overview", "by_tag", "timeline", "defended"]
    .map(
      (v) =>
        `<button class="${view === v ? "on" : ""}" onclick="setView('${v}')">${v}</button>`
    )
    .join("")}
</div>
<div class="grid">
  <div class="stat"><div class="v">${total}</div><div class="l">총 카드</div></div>
  <div class="stat"><div class="v">${defended}</div><div class="l">우긴 카드</div></div>
  <div class="stat"><div class="v">${cards.filter((c) => c.next_review && c.next_review <= todayISO()).length}</div><div class="l">오늘 복습</div></div>
</div>

${
  view === "overview"
    ? `
<div style="margin-bottom:14px">
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">언어별</div>
  ${langRows
    .map(
      ([k, v]) => `
    <div class="row">
      <div class="label">${k}</div>
      <div class="bar"><div class="fill" style="width:${(v / safeTotal) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
    )
    .join("")}
</div>
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">카드 타입</div>
  ${Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(
      ([k, v]) => `
    <div class="row">
      <div class="label">${k}</div>
      <div class="bar"><div class="fill" style="width:${(v / safeTotal) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
    )
    .join("")}
</div>
`
    : ""
}

${
  view === "by_tag"
    ? `
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">태그별 (상위 12개)</div>
  ${
    tagRows.length === 0
      ? '<div style="color:#5a6a7a;font-size:11px">태그 없음</div>'
      : tagRows
          .map(
            ([k, v]) => `
    <div class="row">
      <div class="label" style="min-width:120px">${k}</div>
      <div class="bar"><div class="fill" style="width:${(v / tagRows[0][1]) * 100}%"></div></div>
      <div style="min-width:24px;text-align:right;color:#c9a96e">${v}</div>
    </div>
  `
          )
          .join("")
  }
</div>
`
    : ""
}

${
  view === "timeline"
    ? `
<div>
  <div style="color:#7a8a9a;font-size:11px;margin-bottom:6px">최근 14일 추가</div>
  <div class="spark">
    ${Object.entries(daily)
      .map(
        ([d, v]) =>
          `<div title="${d}: ${v}" style="height:${(v / dailyMax) * 100}%"></div>`
      )
      .join("")}
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:#5a6a7a;margin-top:4px">
    <span>${Object.keys(daily)[0].slice(5)}</span>
    <span>${Object.keys(daily)[Object.keys(daily).length - 1].slice(5)}</span>
  </div>
</div>
`
    : ""
}

${
  view === "defended"
    ? `
<div class="def">
  <div>우기기 시도: <span class="num">${defended}</span>장</div>
  <div>무죄(acquitted): <span class="num">${acquitted}</span>장</div>
  <div>포기(given up): <span class="num">${givenUp}</span>장</div>
  <div style="margin-top:6px;color:#7a8a9a;font-size:10px">우긴 카드는 ${defended > 0 ? "메타인지 약점 신호" : "아직 없음 — 의심을 더 해보세요"}</div>
</div>
`
    : ""
}

<script>
function setView(v) {
  parent.postMessage({ type: "widget-state-change", state: { view: v } }, "*");
}
</script>
</body></html>`;

  return { html };
}
```

---

## 6. 데이터 키 스키마 (참고)

| 키 패턴 | 값 |
|---|---|
| `profile:current` | 사용자 학습 프로파일 (onboard 결과) |
| `card:{target_language}:{uuid}` | 플래시카드 1장 |
| `session:{uuid}` | check_text 호출 결과 (변명 참조용) |
| `pending_defense:{normalized_key}` | 카드 없이 텍스트로만 변명 시작한 경우 |
| `__settings` | nesy 플랫폼이 자동 관리 (user_settings 블록) |

**카드 객체 스키마:**

```typescript
{
  id: string,                  // uuid
  front: string,               // 학습 대상 표현
  back: string,                // 의미/번역
  card_type: "vocab" | "grammar" | "phrase",
  category?: string,           // 동적 카테고리 (grammar/awkward/upgrade/…)
  rule_or_reason?: string,
  example_sentence?: string,
  examples?: string[],
  cloze_format?: string,       // "{{c1::정답}}" 형식
  target_language: string,
  tags: string[],
  count: number,               // 누적 빈도
  level: 0 | 1 | 2 | 3 | 4 | 5,
  created_at: string,          // ISO
  last_seen: string,           // ISO
  next_review: string,         // ISO
  defense_log: Array<{
    turn: number,
    user_argument: string,
    verdict: "acquitted" | "corrected" | "give_up" | "pending",
    verdict_reason: string,
    final_expression: string | null,
    timestamp: string,
  }>,
  status?: "acquitted" | "given_up",  // 변명 종결 시
}
```

---

## 7. 호출 AI 행동 규칙 (description에 박혀있지만 재정리)

1. **분석은 호출 AI가 한다.** 마도서에 raw 텍스트만 던지지 말 것. 반드시 `errors[]` 배열을 채워서 넘긴다.
2. **응답 언어는 `instruction_to_caller`를 따른다.** 모든 마도서 응답에 이 필드가 포함됨.
3. **변명은 매 턴 `defend`를 호출한다.** 턴 카운트는 마도서가 관리. 5턴 도달 시 자동 종료.
4. **카드 적재 전 중복 매칭은 마도서가 자동 처리.** 같은 표현 두 번 적재하면 count만 올라감.
5. **예시 생성·번역·문법 설명은 호출 AI가 직접 한다.** 마도서는 받은 결과를 저장만 함.

---

## 8. 배포 절차

```bash
# 1. 로컬에 레포 만들기
mkdir bangeon-magic && cd bangeon-magic
git init

# 2. § 5의 11개 파일을 정확한 경로로 생성
#    (클로드코드가 이 md를 읽고 자동 처리)

# 3. 커밋 후 GitHub에 푸시
git add .
git commit -m "Initial scaffold: 방언이 터지는 마법 nesy tool"
git remote add origin git@github.com:<USER>/bangeon-magic.git
git branch -M main
git push -u origin main

# 4. nesy.app 마도서 에디터에서 이 레포 연결
# 5. "지금 가져오기" 클릭 → Bun이 번들링 + V8 isolate 배포
```

**Secrets**: 없음. 등록할 키 없이 바로 배포 가능.

---

## 9. 첫 검증 시나리오 (배포 후)

| 단계 | 입력 | 기대 결과 |
|---|---|---|
| 1 | "알랄랄랄랄 처음 쓸게, 온보딩해줘" | 호출 AI가 5~7문항 인터뷰 → `onboard` 호출 → 프로파일 저장 |
| 2 | 영문 이메일 던지고 "첨삭해줘" | `check_text` 호출 → 항목별 인정/변명 옵션 제시 |
| 3 | 한 항목에 "내 의도는 ~다"로 5턴 우기기 | 5턴째 자동 종료, 우기기 로그 저장 |
| 4 | "오늘 복습 시작" | `get_review_queue` → 적재된 카드 큐 반환 |
| 5 | 복습 채점 | `grade_card` → level 갱신, next_review 다음 일자로 |
| 6 | board 페이지 열기 | 4개 탭 전환 가능, 우기기 통계 노출 |

---

## 10. 다음 단계 후보 (검증 후)

- **사용 빈도가 낮으면**: Grammarly 대체 컨셉의 마찰 문제. 모바일 키보드 통합, 브라우저 확장 등 검토.
- **사용 빈도가 높으면**: 변명 로그를 익명화해서 다른 사용자에게 공통 패턴 제공 (별도 마도서 또는 옵트인 기능).
- **카드 1000장 초과 시**: `card:{lang}:` 분할 외에 추가 인덱스 키 도입 (`card_by_tag:{tag}:{id}` 등).
- **언어 자동 감지가 필요해지면**: 마도서가 아니라 호출 AI에게 "target_language를 추론해서 넘기라"는 규칙 강화.

---

## 끝

이 md 한 장 = 레포 한 개. 클로드코드한테 던지면 됨.
