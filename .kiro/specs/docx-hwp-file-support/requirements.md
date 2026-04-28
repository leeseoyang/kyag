# Requirements Document

## Introduction

ReqFlow 앱(kyag/src/App.tsx)에 AI 분석 결과를 저장 카드(SavedCard)로 관리하는 히스토리 기능을 추가한다.
분석 완료 시 결과를 자동으로 localStorage에 저장하고, 같은 파일명에 대해 버전(v1, v2, v3…)을 부여하여 여러 분석 결과를 누적 관리한다.
저장된 카드는 화면 내 히스토리 패널에 목록으로 표시된다.
모든 데이터 변경은 localStorage(`reqflow.history` 키)에 즉시 반영된다.

## Glossary

- **App**: `kyag/src/App.tsx`에 정의된 단일 React 컴포넌트. ReqFlow 앱 전체를 담당한다.
- **SavedCard**: 하나의 AI 분석 결과를 나타내는 데이터 단위. `{ id, fileName, fileVersion, requirements, unmetItems, modifiedContent, savedAt }` 필드를 포함한다.
- **History_Panel**: 저장된 SavedCard 목록을 표시하는 UI 영역. 기존 3패널 레이아웃 하단 또는 별도 섹션에 위치한다.
- **History_Storage**: `localStorage`의 `reqflow.history` 키에 저장되는 SavedCard 배열.
- **Version**: 같은 `fileName`에 대해 분석이 수행될 때마다 1씩 증가하는 정수. 화면에는 `v1`, `v2`, `v3` 형식으로 표시된다.
- **AI_Analysis**: 기존 `analyzeRequirements` 함수가 수행하는 Gemini API 호출 및 결과 파싱 로직.

## Requirements

### Requirement 1: SavedCard 데이터 구조 정의

**User Story:** As a developer, I want a well-defined SavedCard type, so that analysis results are stored consistently.

#### Acceptance Criteria

1. THE App SHALL define a `SavedCard` TypeScript 타입으로 `id: string`, `fileName: string`, `fileVersion: number`, `requirements: string`, `unmetItems: string`, `modifiedContent: string`, `savedAt: string` 필드를 포함한다.
2. THE App SHALL `HISTORY_STORAGE_KEY` 상수를 `'reqflow.history'` 값으로 정의한다.
3. THE App SHALL `savedCards` 상태를 `SavedCard[]` 타입으로 관리하며, 초기값은 History_Storage에서 파싱한 배열로 설정한다.
4. IF History_Storage에 유효하지 않은 JSON이 저장되어 있다면, THEN THE App SHALL `savedCards` 초기값을 빈 배열(`[]`)로 설정한다.

---

### Requirement 2: 분석 완료 시 자동 저장

**User Story:** As a user, I want analysis results to be saved automatically, so that I don't lose any analysis history.

#### Acceptance Criteria

1. WHEN AI_Analysis가 성공적으로 완료되어 `unmetItems`와 `modifiedContent`가 파싱된다면, THE App SHALL 해당 결과를 새로운 SavedCard로 생성하여 `savedCards` 상태에 추가한다.
2. WHEN 새로운 SavedCard가 생성될 때, THE App SHALL `id` 필드를 `Date.now().toString()` 값으로 설정한다.
3. WHEN 새로운 SavedCard가 생성될 때, THE App SHALL `fileName` 필드를 현재 업로드된 파일의 이름으로 설정한다.
4. WHEN 새로운 SavedCard가 생성될 때, THE App SHALL `fileVersion` 필드를 기존 `savedCards` 중 동일한 `fileName`을 가진 카드의 수에 1을 더한 값으로 설정한다.
5. WHEN 새로운 SavedCard가 생성될 때, THE App SHALL `savedAt` 필드를 `new Date().toISOString()` 값으로 설정한다.
6. WHEN `savedCards` 상태가 변경될 때마다, THE App SHALL 변경된 배열을 JSON 직렬화하여 History_Storage에 즉시 저장한다.

---

### Requirement 3: 히스토리 패널 표시

**User Story:** As a user, I want to see all saved analysis cards in a history panel, so that I can review past results.

#### Acceptance Criteria

1. THE App SHALL 기존 3패널 레이아웃 하단 또는 별도 섹션에 History_Panel을 렌더링한다.
2. WHILE `savedCards` 배열이 비어 있다면, THE App SHALL History_Panel에 저장된 분석 결과가 없음을 나타내는 안내 메시지를 표시한다.
3. WHILE `savedCards` 배열에 항목이 존재한다면, THE App SHALL 각 SavedCard를 카드 형태의 UI 요소로 History_Panel에 표시한다.
4. THE App SHALL 각 SavedCard 카드에 `fileName`, `fileVersion`(`v{fileVersion}` 형식), `savedAt`(사람이 읽기 쉬운 날짜/시간 형식) 정보를 표시한다.
5. THE App SHALL `savedCards` 목록을 `savedAt` 기준 내림차순(최신 항목이 상단)으로 정렬하여 표시한다.

---

### Requirement 4: 버전 관리

**User Story:** As a user, I want multiple analysis results for the same file to be versioned, so that I can track changes over time.

#### Acceptance Criteria

1. WHEN 동일한 `fileName`에 대해 두 번째 분석이 완료된다면, THE App SHALL 새로운 SavedCard의 `fileVersion`을 `2`로 설정한다.
2. THE App SHALL `fileVersion` 계산 시 `savedCards` 배열 전체를 기준으로 동일 `fileName` 항목의 수를 집계한다.
3. THE App SHALL 각 SavedCard 카드에 `fileVersion`을 `v1`, `v2`, `v3` 형식의 배지(badge)로 시각적으로 구분하여 표시한다.

---

### Requirement 5: 기존 기능 유지

**User Story:** As a user, I want the existing AI analysis functionality to remain intact, so that the new history feature does not break current workflows.

#### Acceptance Criteria

1. THE App SHALL 기존 AI_Analysis 로직(`analyzeRequirements` 함수, Gemini API 호출, 결과 파싱)을 변경하지 않고 유지한다.
2. THE App SHALL 기존 파일 업로드, 요구사항 입력, 결과 표시, 다운로드 기능을 그대로 유지한다.
3. THE App SHALL 히스토리 기능 추가를 위해 `kyag/src/App.tsx` 단일 파일만 수정한다.
4. THE App SHALL 히스토리 기능 추가를 위해 `package.json`의 의존성을 변경하지 않는다.
5. THE App SHALL 아이콘을 `lucide-react` 패키지에서만 가져온다.
