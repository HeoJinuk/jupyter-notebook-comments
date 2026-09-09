# Notebook Cell Comments

Jupyter Notebook 7에서 셀 전체 또는 셀 안의 선택한 문장·코드에 검토용 메모를 붙이는 확장입니다.
코드·마크다운·Raw 셀을 지원하며 메모는 `.ipynb` 파일 내부에 저장됩니다.

## 빠른 설치

현재 Jupyter Notebook 서버를 실행하는 Python/conda/venv 환경을 활성화한 뒤 설치하세요.
노트북 커널의 환경과 서버 환경은 다를 수 있습니다.

프로젝트를 다운로드해 압축을 풀거나 저장소를 복제한 뒤 실행하세요.

```bash
cd jupyter-notebook-comments
python install.py
```

스크립트를 실행한 Python 환경에 확장을 설치하거나 업데이트합니다.
Windows·macOS·Linux에서 사용할 수 있으며, 다른 폴더에서도 스크립트의 전체 경로로 실행할 수 있습니다.
업데이트할 때도 최신 프로젝트를 다운로드하거나 `git pull`한 뒤 같은 명령을 실행하세요.

빌드된 확장이 포함돼 있으므로 Node.js나 npm 빌드는 필요하지 않습니다.
설치 중 Python 빌드 의존성을 다운로드할 수 있습니다.

열린 노트북을 저장하고 Jupyter 서버를 종료한 뒤 다시 실행하세요.
커널 재시작만으로는 확장이 로드되지 않습니다.

```bash
jupyter notebook
```

설치 확인:

```bash
jupyter labextension list
```

`notebook-cell-comments v0.4.1 enabled OK` 항목을 확인하세요.
이 명령의 이름은 `labextension`이지만 Notebook 7의 확장 확인에도 사용합니다.
PyPI 배포 없이 설치할 수 있습니다. 스크립트는 [pip의 로컬 프로젝트 설치](https://pip.pypa.io/en/stable/topics/local-project-installs/)를 사용합니다.

## 사용법

1. 셀 전체는 우클릭 → **Add Cell Comment**, 문장·코드 일부는 드래그 → 우클릭 → **Add Comment to Selection**를 선택합니다.
2. 오른쪽 패널에서 내용을 작성하고 **등록**을 누릅니다.
3. **노트북을 저장**합니다. 기본 자동 저장이 켜져 있으면 자동 저장에도 포함됩니다.
4. 메모가 있는 셀의 `▤ 숫자` 버튼을 누르면 해당 메모를 볼 수 있습니다.
5. 패널에서 **수정**, **삭제**, **해결**, **다시 열기**를 사용할 수 있습니다.
6. **미해결 / 해결됨 / 전체** 필터로 목록을 전환합니다.
7. 메모의 셀 제목·본문·인용문을 클릭하면 연결된 셀 또는 선택 영역으로 이동합니다.

상단 도구 모음 오른쪽 끝의 말풍선 아이콘은 패널을 열고 닫는 토글 버튼입니다.
패널 제목 오른쪽의 큰 닫기 버튼으로도 닫을 수 있습니다.
패널을 닫았다 다시 열어도 작성 중인 초안은 유지됩니다(페이지 새로고침 시에는 유지되지 않음).
화면이 좁아 아이콘이 보이지 않으면 도구 모음의 `…` 메뉴나 셀 우클릭을 사용하세요.
메모 입력 중 `Ctrl+Enter` 또는 macOS `⌘+Enter`로 등록할 수 있습니다.
등록 전 초안은 파일에 저장되지 않습니다. 페이지를 닫을 때 변경된 초안이 있으면
브라우저가 확인을 요청합니다(브라우저의 기본 확인 정책에 따름).

## 선택 영역 메모

셀 전체 메모와 선택 영역 메모를 같은 셀에 함께 달 수 있습니다.
패널의 **+ Add Cell Comment**는 항상 셀 전체에 붙입니다.
선택 영역 메모에는 처음 선택한 원문이 인용문으로 표시됩니다.

- 코드·Raw·편집 중인 마크다운: 편집기의 텍스트를 드래그합니다.
- 실행된 마크다운: 화면에 보이는 문장을 드래그합니다. 굵은 글씨 등의 서식을 포함할 수 있습니다.
- 한 셀 안의 연속된 영역 하나를 지원합니다. 여러 셀에 걸친 선택, 다중 커서, 출력·그림의 좌표 메모는 지원하지 않습니다.
- 코드와 편집기 원문의 변경을 추적합니다. 앞에 텍스트를 추가해도 위치가 따라가고, 선택 영역 내부를 수정하면 **원문 변경됨**으로 표시합니다.
- 실행된 마크다운은 다시 렌더링된 텍스트에서 인용문과 앞뒤 문맥으로 위치를 확인합니다.
- 원문 전체를 삭제하거나 위치를 확정할 수 없으면 **위치 확인 필요**로 표시하고 메모와 최초 인용문을 보관합니다. 다른 문장에 임의로 연결하지 않습니다.
- 위치를 잃은 메모는 원문을 되살려도 자동으로 재연결하지 않습니다. 필요한 경우 원문을 다시 선택해 새 메모를 작성하세요.

## 하이라이트

- 미해결 선택 영역 메모는 본문에서 **노란색 배경**으로 표시합니다.
- 선택한 메모는 더 진하게 표시하며, 패널의 해당 메모에도 테두리가 생깁니다.
- 하이라이트를 클릭하면 패널이 열리고 해당 메모로 이동합니다. 코드의 클릭 위치와 커서는 유지합니다.
- 하이라이트 위에서도 드래그하여 텍스트를 선택하거나 코드를 편집할 수 있습니다.
- 같은 위치에 메모가 겹치면 반복 클릭으로 차례로 확인할 수 있습니다.
- 해결하거나 삭제한 메모, 원문 위치를 잃은 메모는 하이라이트를 표시하지 않습니다.
- 셀 전체 메모는 기존 셀 옆 배지로 표시합니다.
- 하이라이트는 화면 표시이며 원문이나 메타데이터 형식을 바꾸지 않습니다. 기존 메모에도 자동으로 적용됩니다.
- 마크다운 편집 모드에서 만든 메모는 표시 모드에서도 하이라이트합니다. 기존 메모에도 적용됩니다.
- 제목·굵게·기울임·목록·인용·링크·인라인 코드·코드 블록·표의 문법 기호를 제외하고 실제 글자 위치를 연결합니다. 같은 문장이 반복되어도 순서를 유지합니다.
- 표시 모드에서 해당 메모로 이동하면 표시 모드를 유지합니다.
- 사용자 정의 HTML 또는 기본 MathJax 이외의 수식 렌더러 등으로 표시 결과를 연결할 수 없으면 위치를 추측해 표시하지 않습니다. 이때 편집 모드의 하이라이트와 메모는 유지됩니다.
- 표시 모드에서 처음 만든 메모는 기존처럼 표시 화면에 연결됩니다.

실행된 마크다운의 일반 텍스트 하이라이트에는 브라우저의 CSS Custom Highlight API가 필요합니다.
검증 환경은 Chromium 149이며, 이 API가 없는 브라우저에서는 실행 화면의 상시 하이라이트가 표시되지 않습니다.

## 수식 메모

- 편집 모드에서 `$...$` 또는 `$$...$$`의 LaTeX 전체나 일부를 선택하고 메모를 추가합니다.
- 표시 모드에서는 **수식 전체의 배경**을 하이라이트합니다. 분수·첨자의 개별 기호를 따로 칠하는 방식은 아닙니다.
- 표시된 수식을 **우클릭 → Add Comment to Selection**로 바로 메모할 수도 있습니다. 이 경우 수식 전체의 원문 위치에 연결합니다.
- 수식 하이라이트 클릭으로 메모를 열고, 해결하면 표시가 사라집니다.
- 같은 수식이 여러 번 있어도 원문 순서와 주변 텍스트를 함께 확인해 해당 수식에 연결합니다.
- 수식이 있는 셀에서도 일반 문장 하이라이트를 함께 사용할 수 있습니다.
- Notebook 7.4.4 기본 MathJax의 인라인 수식과 블록 수식으로 검증했습니다. 다른 수식 렌더러는 별도 지원이 필요합니다.

## 데이터와 동작 범위

- 셀의 `metadata.notebook_cell_comments`에 저장합니다. 별도 서버·DB·커널 실행이 필요하지 않습니다.
- 메모는 코드로 실행되지 않으며, HTML/Markdown으로 해석하지 않고 일반 텍스트로 표시합니다.
- 셀의 순번이 아닌 해당 셀의 메타데이터에 붙습니다. 셀 이동 후에도 메모가 따라갑니다.
- 셀을 삭제하면 그 셀의 메모도 함께 삭제됩니다. 셀을 복사하면 메타데이터도 복사될 수 있습니다.
- `.ipynb`를 공유하면 메모 데이터도 공유됩니다. UI로 보려면 상대방도 이 확장이 필요합니다.
- 메타데이터를 제거하는 외부 도구를 사용하면 메모가 제거될 수 있습니다.
- 답글, 작성자 계정, 실시간 공동 검토는 미구현입니다.
- 여러 사용자의 동시 수정에 대한 병합은 보장하지 않습니다. 개인 검토용 첫 버전입니다.
- 읽기 전용 노트북에서는 메모를 조회할 수만 있습니다.
- 알 수 없는 스키마 버전/손상된 데이터는 경고하고 덮어쓰지 않습니다.
- 일반 텍스트 한 메모당 최대 20,000자입니다.

```json
{
  "notebook_cell_comments": {
    "schemaVersion": 1,
    "comments": [
      {
        "id": "f5386226-0319-48a9-9180-41a1d5cba62d",
        "body": "이 보상 범위를 다시 확인하자.",
        "createdAt": "2026-09-08T00:00:00.000Z",
        "updatedAt": "2026-09-08T00:00:00.000Z",
        "resolved": false,
        "anchor": { "type": "cell" }
      }
    ]
  }
}
```

기존 셀 메모 형식은 유지합니다. 선택 영역 메모의 `anchor`에는
`type: "text"`, `surface: "source" | "rendered"`, UTF-16 기준 `start/end`,
최초 `quote`, 현재 `currentQuote`, 앞뒤 문맥, 텍스트 해시, 연결 상태를 저장합니다.
`schemaVersion`은 1을 유지하므로 기존 셀 메모를 그대로 열 수 있습니다.

예제 `examples/with-selection-comments.ipynb`에는 셀 전체·문장·코드 메모가 함께 들어 있습니다.

## 개발

검증 대상: **Notebook 7.4.4 / JupyterLab 구성 요소 4.4.x**.
공통 shell API를 사용하지만 다른 버전과 JupyterLab 화면의 동작은 별도 검증이 필요합니다.

Node.js 20 이상과 Python 개발 환경이 필요합니다.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install "notebook==7.4.4" "jupyterlab==4.4.4" hatchling build
npm ci
npm test
npm run build
python -m pip install -e .
jupyter labextension develop . --overwrite --sys-prefix
jupyter notebook
```

Windows에서는 가상환경 활성화 명령을 `.venv\Scripts\activate`로 바꾸세요.
심볼릭 링크 권한이 없다면 `develop` 대신 빌드 후 `pip install . --force-reinstall`로 복사 설치하세요.

소스 수정 후:

```bash
npm run build
```

브라우저를 새로고침하면 새 번들이 적용됩니다. 복사 설치한 경우에는 다시 설치해야 합니다.
배포 wheel 생성:

```bash
npm run build
python -m build --wheel --no-isolation
```

`dist/`의 wheel에는 프런트엔드 번들이 들어 있어 사용자는 Node.js 없이 설치할 수 있습니다.
Python 패키징 전에 반드시 프런트엔드를 빌드하세요.
빌드 재현성을 위해 `package-lock.json`을 포함하고 webpack을 5.99.9로 고정했습니다.
Notebook 7.4.4의 apputils 구성 요소는 4.5.x라서 패키지의 버전 숫자가 서로 다릅니다.

## 소스 구성

| 파일 | 역할 |
| --- | --- |
| `src/model.ts` | 버전별 메타데이터 검증과 메모 CRUD |
| `src/anchors.ts` | 선택 범위 생성, 변경 추적, 인용문·문맥으로 위치 확인 |
| `src/math.ts` | Jupyter가 추출한 수식과 원문 위치 연결 |
| `src/markdown-dom.ts` | 표시 텍스트·수식 요소와 원문 대응 |
| `src/markdown.ts` | 마크다운 문법을 제외한 원문·표시 위치 대응 |
| `src/highlights.ts` | 편집기·마크다운 하이라이트, 클릭 연결, 겹친 메모 탐색 |
| `src/selection.ts` | 편집기·마크다운 선택 수집, 변경 감시, 원문 이동 |
| `src/notebook.ts` | 셀 모델 접근, 쓰기 권한 확인, 셀 이동 |
| `src/panel.ts` | 사이드바, 작성 폼, 필터, 수정·삭제 UI |
| `src/index.ts` | 플러그인 등록, 우클릭 메뉴, 도구 모음, 셀 배지 |
| `style/index.css` | Jupyter 테마 변수를 사용하는 스타일 |
| `tests/model.test.ts` | 저장·재열기·손상 데이터 보호 검증 |
| `tests/anchors.test.ts` | 삽입·삭제·교체·중복 문장·한글 범위 추적 검증 |

## 제거

```bash
python -m pip uninstall notebook-cell-comments
```

Jupyter 서버를 다시 시작하세요. 기존 `.ipynb`에 저장된 메모 데이터는 삭제되지 않습니다.

## 참고

- [Jupyter 확장 개발](https://jupyterlab.readthedocs.io/en/4.4.x/extension/extension_tutorial.html)
- [Notebook 7 호환 확장](https://jupyterlab.readthedocs.io/en/4.4.x/extension/extension_multiple_ui.html)
- [노트북 메타데이터 형식](https://nbformat.readthedocs.io/en/stable/format_description.html)

하이라이트 구현 참고: [CodeMirror decorations](https://codemirror.net/examples/decoration/), [JupyterLab 편집기 확장](https://jupyterlab.readthedocs.io/en/4.4.x/api/classes/codemirror.ExtensionsHandler.html).
