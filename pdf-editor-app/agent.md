# Agent Work Instructions & Harness (agent.md)

이 파일은 AI 에이전트(Antigravity)가 이 프로젝트에서 작업을 수행할 때 반드시 숙지하고 따라야 하는 지침서입니다.

## ⚠️ 작업 시작 전 필수 읽기 목록

모든 프롬프트 실행 전 아래 3개 파일을 반드시 읽고 시작할 것:

| 파일 | 경로 | 목적 |
|------|------|------|
| **Mistake Log** | `.kiro/agent-docs/Mistake_Log.md` | 반복 금지 실수 목록 |
| **Implementation Rules** | `.kiro/agent-docs/Implementation_Rules.md` | 중요 구현 규칙 |
| **Daily PR Log** | `.kiro/agent-docs/Daily_PR_Log.md` | 날짜별 작업 이력 |

---

## 核心 규칙 (Harness)

1. **범위 제한**: 반드시 프롬프트 내용에 포함된 것들만 작업하며, 요청되지 않은 내용은 절대 수정하지 말 것.
2. **질문 우선**: 프롬프트 내용 중 궁금하거나 모호한 점은 "실행" 전에 반드시 질문하고, 추가 내용이 반영되면 Planning을 재구축할 것.
3. **금지 사항 준수**: 사용자가 "하지 말라"거나 "넣지 말라"고 명시한 사항은 예외 없이 반드시 준수할 것.
4. **피드백 후 전환**: 이전 작업에 대해 사용자가 "오케이" 또는 "확인했어"라고 답변하면, 해당 작업은 기술 부채로 간주하고 그대로 둔 채 다음 작업에 집중할 것.
5. **실수 기록**: 에이전트가 실패하거나 실수한 부분이 프롬프트에서 반복적으로 발생 및 언급되면 `.kiro/agent-docs/Mistake_Log.md`에 즉시 업데이트하여 반복을 방지할 것 (성공 사례는 제외).
6. **PR 생성 및 기록**: 실행된 프롬프트에 대해서 작업을 성공적으로 마치면 `.kiro/agent-docs/Daily_PR_Log.md`에 날짜별로 기록할 것. 실패한 작업에 대해서는 왜 실패했고, 이 부분을 어떻게 해결했는지 또한 기록할 것.
7. **README.md 업데이트**: 주요 기능 추가/변경 시 `README.md`의 업데이트 이력 섹션에 반영할 것.
8. **값 커스터마이즈 설정 위치 알려주기 또는 표시**: 크기 값 설정 또는 세부내용 변경이 필요할 때 설정하는 위치를 따로 표시하고 나중에 사용자가 수정이 필요한 시점이 오면 그 위치를 찾을 수 있도록 `// [CUSTOMIZE]` 주석으로 표시할 것.
9. **무한 Searching 방지**: AI 에이전트가 실행 중일 때 해당 코드의 단어를 Searching 중일 때 무한로딩 중으로 뜬다면 이를 생략하고 다음으로 넘어갈 것.
10. **구현 규칙 갱신**: 새로운 중요 구현 패턴이 확립되면 `.kiro/agent-docs/Implementation_Rules.md`에 추가할 것.

---

## 파일 구조

```
.kiro/agent-docs/
├── Mistake_Log.md          # 날짜별 실수 기록 (반복 금지)
├── Implementation_Rules.md # 중요 구현 규칙 및 패턴
└── Daily_PR_Log.md         # 날짜별 작업 완료 이력
```

---

## 빠른 참조 — 자주 발생하는 실수

> 상세 내용은 `.kiro/agent-docs/Mistake_Log.md` 참조

- ToolManager에 도구가 등록되어 있는지 항상 확인
- Zustand store에 클래스 인스턴스 저장 금지 → useRef 사용
- handleTextClick hit test는 `el.type === 'text'`만 대상으로
- 한글 파일명은 `encodeURIComponent` / `URLDecoder.decode` 처리
- textBgOpacity는 편집 시 덮어쓰지 말 것 (사용자 설정 유지)
