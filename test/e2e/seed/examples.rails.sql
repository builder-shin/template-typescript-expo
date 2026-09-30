-- E2E 씨앗 데이터 - Rails(`template-ruby-rails`) 스키마 버전.
--
-- `examples.sql`(정본·NestJS 공용)과 **내용은 같고 테이블 이름만 다르다** - Rails 는
-- `db/schema.rb` 가 분류·라벨·조인 테이블에 다른 이름을 쓴다. 어느 백엔드가 어느
-- 파일을 쓰는지, 그리고 왜 두 벌인지는 `test/e2e/seed/README.md` 가 정본이다. 이
-- 파일만 읽어도 이해되도록 필요한 만큼은 아래에도 남기지만, 격리 계약·정렬 키
-- 설계·좁힐 수 없는 자리 같은 공유 근거는 `examples.sql` 머리말이 정본이고 여기서
-- 되풀이하지 않는다 - 같은 설명이 두 파일에 있으면 하나만 고쳐지는 자리가 된다.
--
-- ## 테이블 이름 대응
--
--   | 정본(FastAPI)·NestJS  | Rails(`db/schema.rb`)  |
--   | ---------------------- | ----------------------- |
--   | `categories`           | `example_categories`    |
--   | `tags`                 | `example_tags`          |
--   | `example_tags`(조인)   | `example_taggings`(복합 PK: example_id, tag_id) |
--   | `examples`             | `examples`(컬럼 일치)   |
--
-- **같은 id·같은 값·같은 시각**을 쓴다 - 그래야 같은 E2E 시나리오가 세 백엔드에서
-- 같은 결과를 낸다(`examples` 절의 `05:06:07Z` 포함, D3 가 `TZ=America/Denver` 에서
-- 날짜까지 달라지도록 고른 값이다).
--
-- `docker-compose.e2e.yml` 의 `seed-rails` 서비스가 `-v ON_ERROR_STOP=1` 로 이 파일을
-- 돌린다 - Rails 스키마가 바뀌어 컬럼·테이블이 어긋나면 이 파일이 즉시, 시끄럽게
-- 죽어야 한다(게이트가 초록인 채로 틀리는 모양을 막는다).
--
-- ## 0) 하우스키핑 - `bin/rails db:prepare` 가 먼저 만든 행을 지운다
--
-- `migrate-rails` 서비스는 `bin/rails db:prepare` 를 돈다. Rails 는 데이터베이스를
-- **새로 만든 경우** 스키마 로드에 이어 `db/seeds.rb` 도 함께 돌린다 - 그 파일은
-- `ExampleCategory`·`ExampleTag` 에 각각 "General"·"Ruby"·"API" 세 행을 만든다(정본
-- FastAPI 의 `db/seeds.py`, NestJS 의 대응 스크립트는 이 compose 흐름에서 애초에
-- 돌지 않으므로 이 문제가 Rails 에만 있다).
--
-- 그 세 행을 그대로 두면 아래 "100건 천장 넘침" 행의 이름 정렬 순위가 셋만큼
-- 밀린다 - `test/e2e/examples-write.spec.ts` 가 `힣넘침분류-098`(id
-- `...-098`)을 **101번째(=페이지 밖)** 로 못박아 두고 있어(정본·NestJS 는 그렇게
-- 나온다), 순위가 밀리면 그 단언이 거짓이 된다.
--
-- id 접두사로 지운다(이름으로 지우지 않는다) - `db/seeds.rb` 가 나중에 다른 이름·
-- 다른 행수로 바뀌어도 "우리 것이 아닌 모든 행"이라는 조건은 계속 참이다. 우리
-- 행은 전부 `1111`(분류)·`2222`(라벨) 로 시작하는 고정 id 를 쓰고(카드 각주 "값을
-- 고른 규칙" 참고, `examples.sql`), Rails 자체 시드는 `gen_random_uuid()` 라 이
-- 접두사와 겹칠 수 없다.
--
-- 참조 FK 는 `example_taggings.tag_id`(on_delete cascade)·`examples.category_id`
-- (on_delete nullify) 뿐이고, `db/seeds.rb` 가 만든 행에는 어느 쪽도 걸린 적이
-- 없다(그 스크립트는 태깅·예제를 만들지 않는다) - 그래서 이 DELETE 에 연쇄 삭제
-- 부작용이 없다.
BEGIN;

DELETE FROM example_categories WHERE id::text NOT LIKE '1111%';
DELETE FROM example_tags WHERE id::text NOT LIKE '2222%';

-- 1) 분류 둘. `name` 하나뿐인 자원이다(R-5). `examples.sql` 과 같은 id·이름·시각.
INSERT INTO example_categories (id, name, created_at, updated_at)
VALUES
  ('11110000-0000-4000-8000-000000000001', '프로브 분류 하나',
   '2026-03-01T00:00:00+00:00', '2026-03-01T00:00:00+00:00'),
  ('11110000-0000-4000-8000-000000000002', '프로브 분류 둘',
   '2026-03-01T00:00:00+00:00', '2026-03-01T00:00:00+00:00')
ON CONFLICT (id) DO NOTHING;

-- 2) 라벨 둘.
INSERT INTO example_tags (id, name, created_at, updated_at)
VALUES
  ('22220000-0000-4000-8000-000000000001', '프로브 라벨 하나',
   '2026-03-01T00:00:00+00:00', '2026-03-01T00:00:00+00:00'),
  ('22220000-0000-4000-8000-000000000002', '프로브 라벨 둘',
   '2026-03-01T00:00:00+00:00', '2026-03-01T00:00:00+00:00')
ON CONFLICT (id) DO NOTHING;

-- 3) 예제 여섯. 테이블·컬럼 이름이 정본과 같다 - 그대로 옮긴다.
--
-- `created_at`·`updated_at` 을 다른 값으로 두는 이유, `05:06:07Z` 를 고른 이유,
-- charlie 의 점수가 `0` 인 이유는 `examples.sql` 의 같은 절 주석이 정본이다(요약:
-- 상세의 "수정" 이 "생성" 을 베끼는 결함, 로컬 시각으로 그리는 결함, falsy 검사
-- 결함을 각각 화면에서 구별하기 위해서다).
INSERT INTO examples (id, title, description, status, score, category_id, created_at, updated_at)
VALUES
  ('33330000-0000-4000-8000-00000000000a', 'probe-seed alpha',
   NULL, 'draft', 12, NULL,
   '2026-04-06T05:06:07+00:00', '2026-04-11T01:02:03+00:00'),
  ('33330000-0000-4000-8000-00000000000b', 'probe-seed bravo',
   E'프로브 설명 첫 줄\n프로브 설명 둘째 줄', 'active', 77,
   '11110000-0000-4000-8000-000000000001',
   '2026-04-02T05:06:07+00:00', '2026-04-15T01:02:03+00:00'),
  ('33330000-0000-4000-8000-00000000000c', 'probe-seed charlie',
   NULL, 'archived', 0, '11110000-0000-4000-8000-000000000002',
   '2026-04-05T05:06:07+00:00', '2026-04-12T01:02:03+00:00'),
  ('33330000-0000-4000-8000-00000000000d', 'probe-seed delta',
   NULL, 'active', 63, NULL,
   '2026-04-01T05:06:07+00:00', '2026-04-16T01:02:03+00:00'),
  ('33330000-0000-4000-8000-00000000000e', 'probe-seed echo',
   NULL, 'draft', 38, '11110000-0000-4000-8000-000000000001',
   '2026-04-04T05:06:07+00:00', '2026-04-13T01:02:03+00:00'),
  ('33330000-0000-4000-8000-00000000000f', 'probe-seed foxtrot',
   NULL, 'archived', 94, NULL,
   '2026-04-03T05:06:07+00:00', '2026-04-14T01:02:03+00:00')
ON CONFLICT (id) DO NOTHING;

-- 4) 참조 목록 100건 천장을 실제로 넘기는 채움 행 - `examples.sql` 과 같은 설계
-- (근거: 그 파일의 "왜 99건인가" 절), 이름 접두사 `힣` 로 정렬 맨 뒤에 두는 이유도
-- 같다. **범위(`0, 98`, 99건)도 정본과 완전히 같다** - 오프셋을 두지 않는다.
--
-- 오프셋이 필요 없는 이유: 0) 절의 DELETE 가 "General"·"Ruby"·"API" 를 이미
-- 지웠다(`db:seed` 가 돌았든 안 돌았든 - 안 돌았으면 DELETE 는 0건을 지우고
-- 끝난다, 그래도 결과는 같다). 그래서 이 시점에는 어느 경로로 왔든 분류·라벨
-- 테이블에 우리 행(프로브 둘 + 이 채움 99건 = 101건)만 남는다 - 정본·NestJS 와
-- 정확히 같은 카운트이고, `-098` 은 매번 101번째(=100건 천장 밖)다. 실측(Step 5)
-- 에서 최종 행수가 101이 아니면 0) 절의 DELETE 조건부터 의심해라.
INSERT INTO example_categories (id, name, created_at, updated_at)
SELECT
  ('11119999-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '힣넘침분류-' || lpad(n::text, 3, '0'),
  '2026-03-01T00:00:00+00:00'::timestamptz,
  '2026-03-01T00:00:00+00:00'::timestamptz
FROM generate_series(0, 98) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO example_tags (id, name, created_at, updated_at)
SELECT
  ('22229999-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '힣넘침라벨-' || lpad(n::text, 3, '0'),
  '2026-03-01T00:00:00+00:00'::timestamptz,
  '2026-03-01T00:00:00+00:00'::timestamptz
FROM generate_series(0, 98) AS n
ON CONFLICT (id) DO NOTHING;

-- 5) 라벨 연결(조인). Rails 는 이 테이블 이름이 `example_taggings` 이고 PK 가
-- (example_id, tag_id) 복합키다 - 컬럼 자체는 정본의 `example_tags` 조인과 같다.
INSERT INTO example_taggings (example_id, tag_id)
VALUES
  ('33330000-0000-4000-8000-00000000000b', '22220000-0000-4000-8000-000000000001'),
  ('33330000-0000-4000-8000-00000000000c', '22220000-0000-4000-8000-000000000001'),
  ('33330000-0000-4000-8000-00000000000c', '22220000-0000-4000-8000-000000000002'),
  ('33330000-0000-4000-8000-00000000000d', '22220000-0000-4000-8000-000000000002')
ON CONFLICT (example_id, tag_id) DO NOTHING;

COMMIT;
