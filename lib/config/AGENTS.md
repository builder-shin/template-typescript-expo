# lib/config/ 작업 지침

`app.config.ts`가 이 디렉터리를 Node의 type stripping으로 직접 실행한다(실측 M7). 타입만 지우면
도는 구문만 쓴다 - `enum`·값이 있는 `namespace`·매개변수 프로퍼티는 안 되고, 타입만 가져올 때는
`import type`(또는 `{ type X }`)으로 쓴다. 서로 import할 때는 `.ts` 확장자를 붙인다. 어기면
`app.config.ts`를 평가하는 expo 명령이 죽고(`expo config`로 확인했다), 게이트 [8/13]이 그것을 잡는다.

`settings.ts`는 `template-typescript-nextjs`에서 복사한 파일이다. 고치면
`docs/provenance/copied-core.json`의 `divergences`에 `what`·`why`를 더한다. `app-variant.ts`와
`startup.ts`는 이 저장소의 새 파일이다. `startup.ts`는 앱 시작 설정의 판단(extra 읽기, 검증 실패 →
문구)이고 `platform/config.ts`가 부른다 - 설정 자리를 바꾸는 바인딩(`setSettingsSource` 호출)은 이
디렉터리가 아니라 거기 있다.
