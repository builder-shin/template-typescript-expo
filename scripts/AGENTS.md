# scripts/ 작업 지침

게이트와 그 검사기를 둔다. `check.sh` 하나가 유일한 게이트다(스펙 12장) - 단계와 전제 조건은 그 파일의 머리말과 루트
`AGENTS.md` 의 "검증 명령" 이 정본이다.

| 파일                         | 무엇                                                                                | 권한                     |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| `check.sh`                   | 단일 게이트 - 13단계. `--static` 이면 정적 단계 [1]–[11] 만 돈다                    | `100755`                 |
| `check-citations.sh`         | 사라질 자리를 가리키는 인용을 찾는다(게이트 [5]) - 훑을 대상을 인자로만 받는다      | `100755`                 |
| `check-provenance.mjs`       | 복사 출처 기록을 검사한다(게이트 [6]) - 형식·경로·이탈 없는 사본이 원본과 같은 내용 | `100644`(node 가 부른다) |
| `e2e-flow-shards.mjs`        | CI iOS 허용 목록과 두 shard의 무중복 합집합을 정하고 목록을 출력한다                | `100644`(node)           |
| `ios-native-fingerprint.mjs` | CI iOS native/toolchain/레시피 캐시 키와 원천 목록을 만든다                         | `100644`(node)           |
| `check-variant-config.mjs`   | `expo config --type introspect` 의 결과를 변형 표와 맞댄다(게이트 [8])              | `100644`(node 가 부른다) |

- 검사를 바꾸면 그 검사를 재는 시험도 함께 본다 - `test/unit/scripts/` 의 같은 이름 시험이고, `--static` 은
  `check-static.test.ts` 다. 한 번도 빨개지지 않은 검사는 있으나 마나라서 시험마다 어긋난 입력이 실패하는 것을 본다.
- 이 디렉터리와 `docs/`·루트 `AGENTS.md` 는 인용 검사의 대상이 아니다 - 규칙을 적으려면 금지된 패턴의 이름을
  적어야 한다(`check.sh` 머리말).
- `.sh` 는 `100755` 로 커밋한다 - Windows(`core.filemode=false`)에서는 `git update-index --chmod=+x <파일>` 뒤
  `git ls-tree HEAD scripts/` 로 확인한다. 권한이 빠지면 CI 가 `./scripts/check.sh` 를 부르다 멈춘다.
- Windows 에서는 Git Bash 에서 `./scripts/check.sh` 로 돈다 - `pnpm check` 는 cmd.exe 가 `./` 를 찾지 못한다.
