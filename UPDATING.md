# 변경 사항을 GitHub에 올리기

기존 `HeoJinuk/jupyter-notebook-comments` 저장소를 업데이트하는 방법입니다.
`git init`, `git remote add origin`은 다시 실행하지 않습니다.

## 0.5.0 이름 변경 패치 적용

기존 저장소 폴더에서 실행하세요. 먼저 `git status`로 커밋하지 않은 작업이 없는지 확인하세요.
작업 중인 변경이 있다면 먼저 별도로 커밋하거나 보관하세요.

```bash
cd jupyter-notebook-comments
git status
git pull --ff-only
```

다운로드한 `jupyter-notebook-comments-0.5.0.patch`의 실제 경로를 지정하세요.
아래 `PATCH_PATH`에 경로를 넣습니다. 패치 파일은 저장소 밖에 두세요.

```bash
git apply --check "PATCH_PATH"
git apply "PATCH_PATH"
```

`--check`가 실패하면 적용을 멈추고 오류를 확인하세요. 이 패치는
`616e589` 커밋을 기준으로 작성했으므로, 같은 파일의 후속 변경과 충돌할 수 있습니다.
패치는 이전 Python 모듈 폴더의 삭제와 새 폴더 추가를 함께 처리합니다.

Jupyter 서버를 실행하는 Python 환경에서 업데이트하고 변경 내용을 확인하세요.

```bash
python install.py
git diff --stat
git diff -- README.md README.ko.md pyproject.toml install.py
git status
```

설치 스크립트는 새 패키지 설치가 성공한 뒤 이전 `notebook-cell-comments`를 제거합니다.
설치가 끝나면 열린 노트북을 저장하고 Jupyter 서버를 재시작하세요.

```bash
git add .
git commit -m "Rename package to jupyter-notebook-comments"
git push origin main
```

위 push 명령은 기존 `main` 브랜치에서 작업한 경우입니다.
다른 브랜치라면 해당 브랜치로 push하고 GitHub에서 Pull Request를 만드세요.

## 이후 수정 사항 올리기

문서만 바꿨다면 변경 내용을 확인한 뒤 커밋하고 push하면 됩니다.
TypeScript 소스, 스타일 또는 프런트엔드 패키지 설정을 바꿨다면 먼저 빌드하세요.
저장소에는 사용자가 Node.js 없이 설치할 수 있도록 빌드된 확장도 함께 들어 있습니다.

```bash
npm ci
npm test
python -m unittest discover -s tests -p test_install.py
npm run build
python install.py
git status
git add .
git commit -m "Describe the change"
git push origin main
```

개발 환경 구성은 [README](README.ko.md#개발)를 참고하세요.
`git add .` 전에 `git status`를 확인해 개인 노트북이나 불필요한 파일이 포함되지 않게 하세요.
