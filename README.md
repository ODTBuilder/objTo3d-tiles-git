# objTo3d-tiles-git
[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![Korean](https://img.shields.io/badge/language-Korean-blue.svg)](#korean)


<a name="korean"></a>
objTo3d-tiles-git (웹 기반 공간자료 3D 편집도구 파일 변환 node 서버)
=======
이 프로젝트는 국토공간정보연구사업 중 [공간정보 SW 활용을 위한 오픈소스 가공기술 개발]과제의 연구성과 입니다.<br>
[웹 기반 3차원 편집도구](https://github.com/ODTBuilder/OpenGDS3DBuilder2019Prod)와 연동되어 obj 파일을 3dtiles, gltf 등으로 변환하는 node 기반의 서버입니다 .<br>
[objTo3d-tiles](https://github.com/PrincessGod/objTo3d-tiles.git)를 활용하여 개발되었으며 웹 기반 3차원 편집도구와 연동하기 위해 일부 소스코드를 수정한 버전입니다. <br>

감사합니다.<br>
공간정보기술(주) 연구소 <link>http://www.git.co.kr/<br>
OpenGeoDT 팀


Getting Started
=====
### 1. 환경 ###
- node v10.16.0

### 2. Clone or Download ###
- https://github.com/ODTBuilder/objTo3d-tiles-git 접속 후 Git 또는 SVN을 통해 Clone 하거나 zip 파일 형태로 소스코드 다운로드 

### 3. 환경설정 ###
- 프로젝트 경로 내 config.json 파일 열기
- 개인 개발환경에 따라 config.json 파일 수정
<pre><code> 
{   "datapath": "D:/data",   // obj 파일 다운로드 경로
    "serverhost": "localhost",      // 아파치 서버 호스트
    "serverport": "8888"            // 아파치 서버 포트 }
</code></pre>

### 4. 실행 및 요청 ###
- 프로젝트 경로 내 server.js 실행
- [웹 기반 3차원 편집도구](https://github.com/ODTBuilder/OpenGDS3DBuilder2019Prod) 설치 및 실행 후 REST 요청 가능
