# 페피페푸 볼타 세금계산서 중계서버

1. `.env.example`을 복사해서 `.env` 이름으로 만듭니다.
2. `.env` 안의 `BOLTA_API_KEY`, `BOLTA_SUPPLIER_KEY`, `ANTHROPIC_API_KEY`에 테스트 키를 넣습니다.
3. `run-tax-server.bat`를 실행합니다.
4. 브라우저가 자동으로 열리면 `http://127.0.0.1:3000/` 주소에서 견적기를 사용합니다.
5. 견적서를 만든 뒤 `세금계산서 발행` 버튼을 누릅니다.
6. 사업자등록증 자동 입력은 고객 정보 영역의 `사업자등록증 업로드` 버튼을 사용합니다.

Chrome의 Private Network Access 차단을 피하려면 GitHub Pages 주소가 아니라 위 로컬 주소에서 견적기를 여세요. 로컬 주소에서는 견적기와 중계서버가 같은 origin으로 동작합니다.

사업자등록증 이미지는 서버에 파일로 저장하지 않고 Claude Vision API 요청에만 사용합니다. 현재 업로드 지원 형식은 JPG, PNG, GIF, WebP 이미지입니다.

테스트 키(`test_`)는 실제 국세청에 전송되지 않습니다. 라이브 키(`live_`) 전환은 충분히 테스트한 뒤 별도로 진행하세요.
