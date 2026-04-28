# Implementation Plan: DOCX/HWP 파일 지원

## Overview

`kyag/src/App.tsx` 단일 파일에 ZIP 기반 문서 파싱 로직을 추가한다.
외부 라이브러리 없이 브라우저 내장 API(`DecompressionStream`, `DOMParser`, `FileReader`)만 사용하며,
기존 텍스트 파일 처리 흐름을 유지하면서 `.docx`와 `.hwpx` 파싱을 지원한다.

## Tasks

- [x] 1. 파일 유효성 검사 및 파서 선택 함수 구현
  - `App.tsx` 컴포넌트 외부(모듈 스코프)에 상수 및 헬퍼 정의
    - `ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx', '.hwp', '.hwpx']`
    - `MAX_FILE_SIZE = 500 * 1024 * 1024`
    - `getExtension(filename: string): string` — 소문자 변환 후 확장자 반환
  - `validateFile(file: File): { valid: true } | { valid: false; message: string }` 구현
    - 비지원 확장자: `지원하지 않는 파일 형식입니다: {ext} (지원 형식: .txt, .md, .docx, .hwp, .hwpx)` 반환
    - 500MB 초과: `파일 크기가 500MB를 초과합니다 (현재: {n}MB)` 반환
    - 정확히 500MB는 허용
  - `selectParser(extension: string): 'text' | 'docx' | 'hwpx' | 'hwp'` 구현
    - `.txt`, `.md` → `'text'`
    - `.docx` → `'docx'`
    - `.hwpx` → `'hwpx'`
    - `.hwp` → `'hwp'`
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 1.1 Property 1 테스트 작성 — 파일 확장자 검증 완전성
    - **Property 1: 파일 확장자 검증 완전성**
    - 허용 확장자 외 임의 문자열로 끝나는 파일명에 대해 `validateFile`이 항상 `valid: false`를 반환함을 검증
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.2 Property 2 테스트 작성 — 파일 크기 차단 일관성
    - **Property 2: 파일 크기 차단 일관성**
    - 500MB 초과 크기에 대해 항상 오류, 이하 크기에 대해 크기 이유로는 오류 없음을 검증
    - **Validates: Requirements 1.3, 7.1**

  - [ ]* 1.3 Property 3 테스트 작성 — 파서 선택 결정론성
    - **Property 3: 파서 선택 결정론성**
    - 각 지원 확장자(대소문자 포함)에 대해 `selectParser`가 항상 동일한 파서 타입을 반환함을 검증
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 2. ZIP 파일 파서 구현 (`parseZipFile`)
  - `parseZipFile(buffer: ArrayBuffer): Map<string, Uint8Array>` 구현 (모듈 스코프)
  - EOCD 탐색: 버퍼 끝에서 역방향으로 시그니처 `0x06054b50` 탐색
  - EOCD에서 Central Directory 오프셋과 엔트리 수 읽기
  - Central Directory 순회: 각 엔트리(`0x02014b50`)에서 파일명과 Local Header 오프셋 추출
  - Local File Header(`0x04034b50`) 파싱: 압축 방식, 압축 크기, 파일명 길이, 추가 필드 길이 읽기
  - 압축 방식 0(무압축): 데이터 그대로 복사
  - 압축 방식 8(Deflate): `DecompressionStream('deflate-raw')`로 해제
  - 유효하지 않은 ZIP 시그니처 시 오류 throw
  - _Requirements: 2.1, 2.3, 3.1, 3.3_

- [x] 3. DOCX 파서 구현 (`parseDocx`)
  - `parseDocx(buffer: ArrayBuffer): Promise<string>` 구현 (모듈 스코프)
  - `parseZipFile`로 ZIP 엔트리 맵 획득
  - `word/document.xml` 엔트리 추출 → `TextDecoder`로 UTF-8 디코딩
  - `DOMParser().parseFromString(xmlString, 'text/xml')`로 XML 파싱
  - `<w:body>` 하위 `<w:p>` 요소 순회
  - 각 `<w:p>` 내 `<w:t>` 요소의 `textContent` 연결
  - 단락 간 `\n` 삽입 (`<w:hdr>`, `<w:ftr>` 제외)
  - `word/document.xml` 없거나 ZIP 파싱 실패 시 오류 throw
  - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.1 Property 4 테스트 작성 — DOCX 텍스트 보존
    - **Property 4: DOCX 텍스트 보존**
    - 임의 텍스트를 담은 유효한 DOCX 바이너리에 대해 `parseDocx` 결과가 원본 `<w:t>` 텍스트를 모두 포함함을 검증
    - **Validates: Requirements 2.1**

  - [ ]* 3.2 Property 5 테스트 작성 — DOCX 단락 구분 보존
    - **Property 5: DOCX 단락 구분 보존**
    - N개(N ≥ 2) 단락을 가진 DOCX에 대해 결과 문자열에 최소 (N-1)개의 `\n`이 포함됨을 검증
    - **Validates: Requirements 2.2**

- [x] 4. HWPX 파서 구현 (`parseHwpx`)
  - `parseHwpx(buffer: ArrayBuffer): Promise<string>` 구현 (모듈 스코프)
  - `parseZipFile`로 ZIP 엔트리 맵 획득
  - `Contents/section0.xml`, `Contents/section1.xml` 등 섹션 파일 순차 처리 (존재하는 섹션만)
  - 각 섹션 XML을 `TextDecoder`로 디코딩 후 `DOMParser`로 파싱
  - `<hp:p>` 단락 요소 순회, 각 `<hp:p>` 내 `<hp:t>` 요소의 `textContent` 연결
  - 단락 간 `\n` 삽입
  - `Contents/section0.xml` 없거나 ZIP 파싱 실패 시 오류 throw
  - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 4.1 Property 6 테스트 작성 — HWPX 텍스트 보존
    - **Property 6: HWPX 텍스트 보존**
    - 임의 텍스트를 담은 유효한 HWPX 바이너리에 대해 `parseHwpx` 결과가 원본 `<hp:t>` 텍스트를 모두 포함함을 검증
    - **Validates: Requirements 3.1**

  - [ ]* 4.2 Property 7 테스트 작성 — 손상된 파일 오류 처리
    - **Property 7: 손상된 파일 오류 처리**
    - ZIP 시그니처가 없는 임의 바이너리에 대해 `parseDocx`와 `parseHwpx` 모두 반드시 오류를 throw함을 검증
    - **Validates: Requirements 2.3, 3.3**

- [x] 5. Checkpoint — 파서 함수 단위 검증
  - 모든 순수 함수(`validateFile`, `selectParser`, `parseZipFile`, `parseDocx`, `parseHwpx`)가 독립적으로 올바르게 동작하는지 확인한다.
  - 테스트 프레임워크가 없는 경우 브라우저 콘솔에서 직접 호출하여 확인한다.
  - 구현 중 의문 사항이 있으면 사용자에게 질문한다.

- [-] 6. `handleFileChange` 수정 및 오류 처리 연결
  - 기존 동기 `handleFileChange`를 `async` 함수로 교체
  - `validateFile` 호출 → 실패 시 `setError` 후 파일 입력 초기화 및 return
  - `selectParser`로 파서 타입 결정
  - `parserType === 'hwp'` 분기: HWP 바이너리 안내 메시지 설정 후 return
  - `parserType === 'text'` 분기: 기존 `FileReader.readAsText` 로직 유지 (`readAsText` 헬퍼 함수로 Promise 래핑)
  - `parserType === 'docx'` / `'hwpx'` 분기: `arrayBuffer()` → 각 파서 호출
  - `try/catch`에서 오류 메시지 형식 `'${fileName}' 파싱 실패: ${원인}` 적용
  - `isAnalyzing` 상태를 파싱 중 로딩 표시에 재활용 (`finally`에서 `setIsAnalyzing(false)`)
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 6.1_

  - [ ]* 6.1 Property 8 테스트 작성 — 파싱 오류 메시지 형식
    - **Property 8: 파싱 오류 메시지 형식**
    - 임의 파일명과 오류 원인에 대해 파싱 실패 시 `error` 상태 문자열이 파일명과 오류 원인을 모두 포함함을 검증
    - **Validates: Requirements 6.1**

- [~] 7. UI 수정 — `accept` 속성 및 로딩 표시
  - 파일 `<input>` 요소의 `accept` 속성을 `.txt,.md,.docx,.hwp,.hwpx`로 설정
  - 파싱 중(`isAnalyzing`) 로딩 표시: 기존 `Loader2` 아이콘 재활용 (이미 중앙 패널 버튼에 존재)
  - 파일 업로드 영역에도 파싱 중 상태 시각적 피드백 추가 (선택적)
  - 기존 파일명 표시, 오류 표시 UI는 변경 없이 유지
  - _Requirements: 5.1, 5.2_

- [~] 8. Final Checkpoint — 전체 통합 검증
  - `tsc --noEmit`(`npm run lint`)으로 TypeScript 컴파일 오류 없음 확인
  - 기존 `.txt`/`.md` 파일 업로드 동작이 그대로 유지되는지 확인
  - `.docx` 파일 업로드 → `fileContent` 상태에 텍스트 설정 확인
  - `.hwpx` 파일 업로드 → `fileContent` 상태에 텍스트 설정 확인
  - `.hwp` 파일 업로드 → 안내 메시지 표시 확인
  - 비지원 확장자(`.pdf` 등) 업로드 → 오류 메시지 표시 확인
  - 모든 테스트 통과 확인, 의문 사항이 있으면 사용자에게 질문한다.

## Notes

- `*` 표시 서브태스크는 선택적이며 MVP 구현 시 건너뛸 수 있다
- 속성 기반 테스트는 `vitest` + `fast-check` 도입 후 구현한다 (design.md 전략 참조)
- 모든 구현은 `kyag/src/App.tsx` 단일 파일 내에서 완결된다 (새 파일 생성 금지)
- 의존성 추가 없이 브라우저 내장 API만 사용한다
- 각 태스크는 이전 태스크 결과 위에 누적되므로 순서대로 실행한다
