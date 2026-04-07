# Hailuo Video Generation via OpenClaw Browser Tool
## Hướng dẫn chi tiết cho Nova Agent

---

## Tổng Quan

Thay vì dùng Playwright (`lib/hailuo-app.js`), giờ dùng **OpenClaw Browser Tool** để điều khiển trình duyệt đã đăng nhập sẵn.

### Ưu điểm của OpenClaw Browser:
- ✅ Browser đã login Hailuo (Chrome user profile)
- ✅ Không cần setup session riêng  
- ✅ Không bị "trình duyệt không an toàn" error
- ✅ Hoạt động 24/7

---

## Các Bước Thực Hiện

### Bước 1: Mở Browser
```javascript
browser(action="open", profile="user")
// profile="user" = Chrome profile đã đăng nhập
```

### Bước 2: Navigate đến Hailuo Create Page
```javascript
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
```

### Bước 3: Snapshot để tìm elements
```javascript
browser(action="snapshot", targetId="<id_from_open>")
```
Đọc kết quả để tìm:
- Textarea cho prompt
- Button Create/Generate
- Aspect ratio selector

### Bước 4: Fill Prompt
```javascript
// Click vào textarea trước
browser(action="act", targetId="<id>", kind="click", ref="textarea")

// Type prompt
browser(action="act", targetId="<id>", kind="type", ref="textarea", text="your video prompt here")
```

### Bước 5: Set Aspect Ratio (9:16 cho TikTok)
```javascript
browser(action="act", targetId="<id>", kind="click", ref="[button:has-text('9:16')]")
```

### Bước 6: Submit
```javascript
browser(action="act", targetId="<id>", kind="click", ref="[button:has-text('Create')]"))
// hoặc ref="[button:has-text('Generate')]"
// hoặc ref="[button:has-text('创作')]"
```

### Bước 7: Chờ Video Generated
```javascript
// Poll mỗi 30 giây, tối đa 15 phút
for (i = 0; i < 30; i++) {
    browser(action="snapshot", targetId="<id>")
    // Kiểm tra:
    // - Video element xuất hiện
    // - Download button xuất hiện
    // - Status "Complete" hoặc tương tự
    sleep(30000)
}
```

### Bước 8: Download Video
```javascript
// Click download button
browser(action="act", targetId="<id>", kind="click", ref="[button:has-text('Download')]"))
// hoặc tìm a[href*=".mp4"] và click

// Video sẽ được download vào C:\tmp\openclaw\uploads\
```

### Bước 9: Copy Video đến Workspace
```bash
Copy-Item "C:\tmp\openclaw\uploads\*.mp4" "C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output\videos\<video_name>.mp4"
```

### Bước 10: Đóng Browser
```javascript
browser(action="close", targetId="<id>")
```

---

## Example Script cho Nova

```javascript
// === HAILUO VIDEO GENERATION VIA OPENCLAW BROWSER ===

const PROMPT = "A beautiful sunset over the ocean, cinematic lighting, 9:16 vertical";
const OUTPUT_NAME = "hailuo_" + Date.now() + ".mp4";
const UPLOAD_DIR = "C:\\tmp\\openclaw\\uploads";
const OUTPUT_DIR = "C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\videos";

// 1. Open browser
const openResult = browser(action="open", profile="user");
const targetId = openResult.targetId;
log("Browser opened: " + targetId);

// 2. Navigate
browser(action="navigate", targetId, url="https://hailuoai.video/create/text-to-video");
sleep(3000);

// 3. Fill prompt
browser(action="act", targetId, kind="click", ref="textarea");
browser(action="act", targetId, kind="type", text=PROMPT, ref="textarea");

// 4. Set 9:16
browser(action="act", targetId, kind="click", ref="[button:has-text('9:16')]");

// 5. Create
browser(action="act", targetId, kind="click", ref="button.new-color-btn-bg");

// 6. Wait for video (max 15 min)
let videoReady = false;
for (let i = 0; i < 30; i++) {
    sleep(30000);
    const snap = browser(action="snapshot", targetId);
    if (snap.html.includes(".mp4") || snap.html.includes("download")) {
        videoReady = true;
        break;
    }
}

// 7. Download
if (videoReady) {
    // Click download button
    browser(action="act", targetId, kind="click", ref="[download]");
    
    // Copy to workspace
    exec("Copy-Item \"" + UPLOAD_DIR + "\\*.mp4\" \"" + OUTPUT_DIR + "\\" + OUTPUT_NAME + "\"");
    log("Video saved: " + OUTPUT_NAME);
}

// 8. Close
browser(action="close", targetId);
```

---

## Troubleshooting

### Lỗi "Không tìm thấy element"
→ Chạy `browser(action="snapshot")` để xem page structure hiện tại
→ Có thể URL redirect sang trang khác

### Lỗi "Browser already running"
→ Dùng `browser(action="tabs")` để xem tabs đang mở
→ Close tab cũ hoặc dùng tab đang mở

### Video không download
→ Kiểm tra xem video đã ready chưa (có thể vẫn đang generate)
→ Thử click trực tiếp vào video element

### Aspect ratio không đúng
→ Hailuo mặc định có thể là 16:9
→ Cần click button 9:16 trước khi submit

---

## File Liên Quan

- `lib/hailuo-openclaw-browser.js` - Class wrapper
- `scripts/hailuo-openclaw-browser-steps.md` - File này
- `scripts/pending/*.json` - Script templates

## Status

- **Date:** 2026-03-29
- **Status:** READY FOR NOVA TO USE
- **替代:** `lib/hailuo-app.js` (Playwright - có vấn đề session)
