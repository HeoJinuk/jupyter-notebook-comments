# Installation script validation

- Added `install.py`; frontend and package version remain 0.4.1.
- Installed the local project into a fresh Python 3.12 virtual environment without Node.js or an npm build.
- Verified installed package version and shared Jupyter extension assets, including a single remote entry.
- Checked current-interpreter selection, absolute project path, upgrade argument, and success/failure reporting with a mocked pip subprocess from another working directory.
- Actual installation was tested on Linux. Windows and macOS were not run in this environment.

# v0.4.1 validation

Verified in Notebook 7.4.4 / Chromium 149:

- The comment toggle is the rightmost normal toolbar item, after kernel controls.
- The native overflow control remains available when the toolbar needs it.
- Repeated toolbar clicks still open and close the sidebar.
- The sidebar's **+ Add Cell Comment** opens the cell comment composer.
- Context-menu actions **Add Cell Comment** and **Add Comment to Selection** work with their English labels.
- Selecting Markdown text still opens a composer quoting the selected text.
- No uncaught browser JavaScript errors.

The changes are limited to toolbar placement, labels, and publication documentation.
Data and math-mapping tests were not repeated for these UI-only changes; their previous verification is recorded below.

# v0.4.0 검증 기록

- 일반 하이라이트 배경 불투명도 0.23 → 0.38, 선택 강조 0.48 → 0.58.
- 수식의 원문 위치를 실제 MathJax 요소와 연결하여 수식 전체 배경에 표시.
- 기존 테스트 19개와 수식 위치 대응 테스트 4개, 총 23개 통과.
- TypeScript strict 및 prebuilt extension 빌드, wheel 빌드 통과.

Notebook 7.4.4 / Chromium 149 실제 화면에서 검증했습니다.

- 인라인·블록 수식, 반복되는 수식의 정확한 두 번째 위치 표시.
- 같은 셀의 일반 문장 하이라이트 유지.
- 수식 클릭 → 해당 메모 열기, 선택 강조, 표시 모드에서 원문 이동.
- 해결·다시 열기 시 수식 배경 숨김·복원.
- 표시된 수식을 실제 우클릭하여 새 메모 생성, 원문 수식 인용 확인.
- LaTeX 일부 수정 → 다시 실행 → 수식 하이라이트 복원.
- 밑줄 없음, 원래 수식 글자 모양 유지.
- 저장·재열기 후 수식 하이라이트 유지.
- 반복되는 수식 중 하나 삭제 시 해당 메모는 위치 확인 필요로 보관하고 다른 수식의 메모 유지.
- 일반 마크다운의 기존 모드 전환·클릭·수정·저장 검증도 다시 통과.
- 처리되지 않은 브라우저 JavaScript 오류 없음.

표시 모드의 수식은 전체 배경으로 강조합니다. 개별 수학 기호의 부분 강조와
기본 MathJax 이외 렌더러는 검증·지원 범위 밖입니다.

# v0.3.1 검증 기록

- 편집 모드의 source anchor를 마크다운 표시 모드의 실제 텍스트에 연결.
- 메모 하이라이트의 밑줄 제거. 배경색과 선택한 메모의 강조는 유지.
- 기존 자동 테스트 14개와 마크다운 위치 대응 테스트 5개, 총 19개 통과.
- 위치 대응 테스트: 굵게·부분 선택·제목, 반복 문장, 링크와 URL 구분,
  엔티티·이스케이프·코드 블록, 목록·인용·표, 예상과 다른 렌더링의 잘못된 연결 방지.

Notebook 7.4.4 / Chromium 149 실제 화면에서 다음을 확인했습니다.

- 기존 편집 모드 메모가 표시 모드에서 반복 문장 중 정확한 두 번째 위치에 표시.
- 편집 화면에서 새 메모 생성 → 표시 모드 전환 → 문법 기호를 제외한 하이라이트 확인.
- 편집기와 표시 화면 모두 하이라이트의 밑줄 없음.
- 표시 하이라이트 클릭으로 같은 메모 열기.
- 패널에서 원문 이동 시 표시 모드 유지.
- 편집·표시 모드 전환, 앞부분 삽입, 해결·다시 열기, 저장·재열기 후 표시 유지.
- 처리되지 않은 브라우저 JavaScript 오류 없음.

사용자 정의 HTML·수식 등의 생성 텍스트는 일반 마크다운과 다를 수 있으므로
표시 텍스트가 일치하지 않는 셀에서는 변환을 추측하지 않습니다.

# v0.3.0 검증 기록

Notebook 7.4.4 / JupyterLab 4.4.4 구성 요소 / Chromium 149에서 확인했습니다.

- TypeScript strict 및 prebuilt extension production 빌드 통과.
- 기존 저장·범위 추적 자동 테스트 14개 통과.
- wheel 설치 후 `jupyter labextension list`에서 v0.3.0 enabled OK 확인.
- 저장된 기존 선택 영역 메모에 코드·실행된 마크다운 하이라이트 자동 표시.
- 해결된 메모와 셀 전체 메모에는 텍스트 하이라이트를 만들지 않음.
- 코드 하이라이트 클릭 시 정확한 메모를 열고, 선택한 메모를 더 진하게 표시.
- 겹친 메모 반복 클릭으로 순환.
- 하이라이트 클릭 뒤 커서 위치에서 입력하고 Undo로 원문 복원.
- 실행된 마크다운 하이라이트 클릭, 선택 강조, 해결 시 숨김, 다시 열기 시 복원.
- 코드와 마크다운 하이라이트를 실제 마우스로 드래그: 정확한 텍스트 선택, 패널을 자동으로 열지 않음.
- 기존 하이라이트 위에 추가 선택 영역 메모 작성.
- 메모 삭제 시 표시 제거.
- 코드 앞부분 삽입 후 연결된 범위와 하이라이트 유지.
- 노트북 저장·페이지 재열기 후 표시 복원.
- 연결된 원문 전체 삭제 후 하이라이트 제거, 다른 셀의 표시 유지.
- 처리되지 않은 브라우저 JavaScript 오류 없음.

`preview.png`는 v0.3.0의 실제 화면입니다. 원문과 코드의 글자색은 변경하지 않습니다.
브라우저별 CSS Custom Highlight API 지원과 다른 Notebook 버전은 별도 검증하지 않았습니다.

# v0.2.0 검증 기록

대상: Notebook 7.4.4, JupyterLab 4.4.4 구성 요소, Python 3.12,
Node.js 24.19.0, headless Chromium 149.

## 빌드와 데이터

- TypeScript strict 및 production prebuilt extension 빌드 통과.
- v0.2.0 wheel을 빌드하고 실제 테스트 서버 환경에 설치.
- `jupyter labextension list`에서 v0.2.0 enabled OK 확인.
- `npm test`: 기존 메타데이터 테스트 6개와 범위 추적 테스트 8개, 총 14개 통과.
- 범위 추적: 앞부분 삽입, 양끝 경계 삽입, 내부 교체와 되돌리기,
  한 트랜잭션의 여러 편집, 전체 삭제, 저장 후 재연결, 중복 문장 구분,
  한글·이모지 UTF-16 위치를 검증.

## 실제 Notebook 화면

Playwright로 브라우저를 조작하고 저장된 `.ipynb`와 비교했습니다.

- 셀 전체 메모와 코드 선택 영역 메모를 함께 생성·저장.
- 최초 선택 코드 인용문과 정확한 범위 저장.
- 코드 앞부분에 삽입한 뒤에도 범위가 따라가는지 확인.
- 메모에서 원문으로 이동하면 정확한 코드가 선택되는지 확인.
- 선택 코드를 교체했을 때 현재 인용문과 변경 상태 추적.
- 실행된 마크다운의 굵은 한글 문장을 실제 마우스로 드래그하고 우클릭하여 메모 추가.
- 문장 메모 클릭 시 정확한 문장으로 이동·선택.
- 마크다운 소스 앞부분을 수정하고 다시 실행한 후에도 위치 유지.
- 페이지 재열기 후 셀 전체·문장·코드 메모 3개 복원.
- 연결된 코드를 모두 삭제하면 메모와 최초 인용문을 보존하고 위치 확인 필요 표시.
- 툴바 패널 토글 및 34px 닫기 버튼 유지.
- 처리되지 않은 브라우저 JavaScript 오류 없음.

Notebook이 같은 마크다운 표시 요소를 떼었다 다시 붙이는 과정에서
브라우저의 선택 범위가 셀 처음으로 바뀌는 문제를 재현했습니다.
같은 텍스트 노드가 그대로 다시 붙은 경우에만 기존 노드·오프셋으로 선택을 복원합니다.
실제 원문이 교체되어 텍스트 노드가 사라진 경우에는 복원하지 않습니다.

`preview.png`와 `examples/with-selection-comments.ipynb`는 이 검증에서 저장했습니다.
출력·그림·셀을 가로지르는 선택, 다중 커서, 다른 브라우저/Notebook 버전은 검증 범위 밖입니다.

# v0.1.1 검증 기록

Notebook 7.4.4 실제 웹 화면에서 이번 변경과 관련된 흐름을 확인했습니다.

- 툴바 버튼 반복 클릭으로 메모 패널 열기/닫기.
- 닫을 때 오른쪽 사이드바 공간도 사라지고 노트북 너비 복원.
- 제목 오른쪽 34×34px 닫기 버튼으로 닫기와 다시 열기.
- 메모 패널을 열었을 때에만 기존 구석의 작은 닫기 버튼 숨김.
- 툴바 토글과 제목 닫기 모두 작성 중인 초안 보존.
- 열린 상태에서 우클릭 메모 추가 시 패널을 닫지 않고 입력 폼 표시.
- 기존 메모 3개 유지, 처리되지 않은 브라우저 JavaScript 오류 없음.

메모 저장 형식은 v0.1.0과 동일합니다.

## v0.1.0 검증 기록

대상 환경: Python 3.12, Notebook 7.4.4, JupyterLab 4.4.4 구성 요소,
Node.js 24.19.0, headless Chromium 149.

## 빌드 및 설치

- TypeScript strict 빌드 통과.
- Jupyter prebuilt extension production 빌드 통과.
- Python wheel 빌드 후 테스트 환경에 설치.
- `jupyter labextension list --verbose`에서 `notebook-cell-comments v0.1.0 enabled OK` 확인.

## 자동 데이터 테스트

`npm test`: 6개 테스트 통과.

1. 여러 메모 추가 → JSON 저장/재열기 → 수정 → 해결/재열기 → 삭제.
2. 알 수 없는 부가 필드와 향후 텍스트 anchor 필드 보존.
3. 손상되었거나 지원하지 않는 스키마를 덮어쓰지 않음.
4. 기존 메모를 수정해도 나중에 추가된 다른 메모를 유지.
5. 빈 내용, 길이 초과, 이미 삭제된 메모의 수정 시 쓰기 차단.
6. 중복 메모 ID 데이터 거부.

## 실제 Notebook 화면 검증

Playwright로 Notebook 7.4.4 웹 화면을 조작하고 `.ipynb` 원본을 대조했습니다.

- 코드·마크다운·Raw 셀의 우클릭 메뉴로 메모 추가.
- 기존 활성 셀과 다른 셀을 우클릭했을 때 우클릭 대상에 정확히 저장.
- 한 셀에 여러 메모 추가.
- 오른쪽 패널에서 메모 수정·삭제 확인창·해결·다시 열기.
- 미해결/해결됨/전체 필터.
- Jupyter 기본 저장 후 `.ipynb` metadata 확인.
- 페이지를 새로 열어 메모와 셀 배지 복원 확인.
- 셀 배지 클릭으로 메모 패널 탐색.
- Jupyter 기본 Move Cell Up 기능으로 셀 이동 후 메모 유지와 셀 번호 변경 확인.
- HTML처럼 생긴 메모를 일반 텍스트로 표시하며 실행하지 않는 것 확인.
- 위 흐름에서 처리되지 않은 브라우저 JavaScript 오류 없음.

## 수정한 호환성 문제

- Notebook 7에서는 이미 열린 오른쪽 패널을 `activateById`로 다시 활성화하면
  닫힐 수 있어, 보이는 상태에서는 재호출하지 않도록 처리했습니다.
- 기본 셀 도구 모음과 겹치지 않도록 메모 배지를 셀 왼쪽 여백에 배치했습니다.
- Python JupyterLab 4.4.4의 apputils 버전은 4.5.x이며 이를 의존성에 반영했습니다.

## 검증 범위 밖

다른 Notebook/JupyterLab 버전, macOS·Windows에서의 실제 설치,
대형 노트북 성능, 다중 사용자 동시 편집 병합은 별도로 검증하지 않았습니다.
v0.1.0 당시에는 선택 영역 메모를 지원하지 않았습니다. v0.2.0 검증은 위 기록을 참고하세요.

`preview.png`는 실제 Notebook 화면입니다. 검증 컨테이너에 한글 폰트가 없어
촬영할 때만 Noto Sans KR을 적용했습니다. 확장에는 별도 폰트를 포함하지 않습니다.
