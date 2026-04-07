# 🎬 HAILUO WEB AUTOMATION PIPELINE
## Chỉ dùng Hailuo Web + OpenClaw Browser Tool

---

## 📋 NGUYÊN TẮC

1. **CHỈ HAILUO WEB** - Không Pexels, không FFmpeg edit riêng
2. **HAILUO TỰ TẠO VIDEO HOÀN CHỈNH** - Visual + Audio trong 1 video
3. **OPENCLAW BROWSER TOOL TỰ ĐỘNG HÓA** - Click, type, download tự động

---

## 🎯 HAILUO CÓ GÌ?

### Models:
| Model | Use Case |
|-------|----------|
| **T2V-01** | Text to Video - prompt → video |
| **I2V-01-DIRECTOR** | Image to Video - reference image + prompt → video |
| **I2V&T2V-01-DIRECTOR** | Cả hai - với camera movements |

### Features:
- ✅ Video từ text prompt
- ✅ Video từ image reference  
- ✅ Camera movements trong prompt
- ✅ Audio/voice trong video
- ✅ Duration: 6s, 10s, 15s, 30s

---

## 🔄 WORKFLOW (3 BƯỚC)

### BƯỚC 1: CHUẨN BỊ PROMPT
**Tạo prompt hoàn chỉnh cho Hailuo:**

```markdown
[Push in]Beautiful woman with long dark hair, wearing red team jersey, sitting in packed World Cup stadium. Eyes locked on the pitch. GOAL SCORED! Stadium erupts. She jumps up, arms raised high, screaming with pure joy. Confetti rains down. Flags wave wildly. Crowd surges. Close-up on her face - eyes closed, elated smile. She hugs the stranger next to her. Stadium lights blazing. Fireworks flash. Cinematic lighting. 9:16 portrait. Realistic style.
```

**Prompt Structure:**
```
[Camera Movement]Subject + Action + Environment + Emotion + Details + Style + Aspect Ratio
```

### BƯỚC 2: HAILUO WEB (OPENCLAW BROWSER)

```javascript
// 1. Mở Hailuo Web
browser(action="open", profile="user")
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")

// 2. Chờ trang load
sleep(3000)
browser(action="snapshot", targetId)

// 3. Click vào textarea (REQUIRED!)
browser(action="act", targetId, kind="click", ref="[contenteditable]")

// 4. Clear textarea cũ (REQUIRED!)
browser(action="act", targetId, kind="press", key="Control+a")
browser(action="act", targetId, kind="press", key="Backspace")

// 5. Type PROMPT MỚI (chậm để tránh lỗi)
browser(action="act", targetId, kind="type", 
       text="[Push in]Beautiful woman in World Cup stadium celebrating...",
       ref="[contenteditable]", 
       slowly=true)

// 6. Chọn Model (I2V&T2V-01-DIRECTOR)
browser(action="act", targetId, kind="click", ref="[model-selector]")
browser(action="act", targetId, kind="click", ref="[option:I2V&T2V-01-DIRECTOR]")

// 7. Chọn Duration (6s)
browser(action="act", targetId, kind="click", ref="[duration-6s]")

// 8. Click CREATE
browser(action="act", targetId, kind="click", ref="[button:Create]")

// 9. ĐỢI VIDEO GENERATE (5-15 PHÚT!)
for (i = 0; i < 30; i++) {
    sleep(30000)  // 30 giây
    browser(action="snapshot", targetId)
    
    // Kiểm tra video xong chưa
    if (snapshot contains "Download" OR "Complete" OR ".mp4") {
        break
    }
}

// 10. Click DOWNLOAD
browser(action="act", targetId, kind="click", ref="[button:Download]")
```

### BƯỚC 3: UPLOAD

```javascript
// YouTube
browser(action="navigate", url="https://studio.youtube.com")
// Upload + Fill metadata + Publish

// TikTok
browser(action="navigate", url="https://www.tiktok.com/upload")
// Upload + Add caption + Post
```

---

## 📝 PROMPT TEMPLATE

```markdown
[CAMERA_MOVEMENT]SUBJECT doing ACTION in ENVIRONMENT. DETAIL 1. DETAIL 2. DETAIL 3. EMOTION. STYLE. 9:16 portrait.
```

### Camera Movements:
| Code | Effect |
|------|--------|
| `[Push in]` | Zoom vào subject |
| `[Pull out]` | Zoom ra từ subject |
| `[Pan left]` | Quay camera trái |
| `[Pan right]` | Quay camera phải |
| `[Tilt up]` | Ngẩng camera lên |
| `[Tilt down]` | Hạ camera xuống |
| `[Tracking shot]` | Theo dõi subject |
| `[Static]` | Đứng yên |

---

## ⚠️ CRITICAL RULES

### 1. CLEAR TEXTAREA TRƯỚC KHI TYPE MỚI
```javascript
// SAI - prompt chồng lên nhau → video trùng!
browser(action="act", kind="type", text="prompt1")
browser(action="act", kind="type", text="prompt2") // vẫn ghi tiếp

// ĐÚNG - clear trước
browser(action="act", kind="click", ref="[contenteditable]")
browser(action="act", kind="press", key="Control+a")
browser(action="act", kind="press", key="Backspace")
browser(action="act", kind="type", text="prompt1")
```

### 2. CLICK TRƯỚC KHI TYPE
```javascript
// ContentEditable div cần focus trước
browser(action="act", kind="click", ref="[contenteditable]")  // Click TRƯỚC
browser(action="act", kind="type", text="prompt")  // Rồi mới type
```

### 3. DÙNG SLOWLY=TRUE CHO PROMPT DÀI
```javascript
browser(action="act", kind="type", text="long prompt here...", slowly=true)
```

### 4. ĐỢI ĐỦ THỜI GIAN GENERATE
```javascript
// Video 6s có thể mất 5-15 phút để generate
// Kiểm tra mỗi 30 giây, tối đa 30 lần (15 phút)
```

---

## 🔍 DEBUG COMMON ISSUES

### Issue: "contenteditable not found"
```javascript
// Thử các selectors khác
ref="[contenteditable]"
ref="#video-create-textarea"
ref="div[role='textbox']"
ref="[data-slate-editor]"
```

### Issue: Type không hoạt động
```javascript
// Thử click lại + delay
browser(action="act", kind="click", ref="[contenteditable]")
sleep(500)
browser(action="act", kind="type", text="prompt")
```

### Issue: Video trùng nhau
```javascript
// Luôn clear trước
browser(action="act", kind="click", ref="[contenteditable]")
browser(action="act", kind="press", key="Control+a")
browser(action="act", kind="press", key="Delete")
```

---

## 📊 WORKFLOW CHO 1 VIDEO

| Step | Action | Time |
|------|--------|------|
| 1 | Open Hailuo + Navigate | 5s |
| 2 | Click textarea + Clear | 2s |
| 3 | Type prompt | 30s |
| 4 | Select model + duration | 5s |
| 5 | Click Create | 2s |
| 6 | Wait for generate | 5-15 min |
| 7 | Download video | 30s |
| 8 | Upload YouTube | 2 min |
| 9 | Upload TikTok | 2 min |
| **Total** | | **12-22 min/video** |

---

## 🎯 SCRIPT CHO 6 VIDEOS

### AESTH-01 (Trending Aesthetic)
```markdown
[Push in]Beautiful woman with natural wavy hair, wearing flowy white dress, standing on cliff edge at sunset. Wind blows through hair. Closes eyes, takes deep breath. Spins slowly with arms out. Dress billowing. Golden sunset ocean view. Magical atmosphere. Cinematic drone-like shot. 9:16 portrait.
```

### COM-01 (Comedy)
```markdown
[Tracking shot]Man walking down busy street, accidentally steps on banana peel. Slow-motion slip. Arms flailing. Crashes into stack of boxes. Boxes topple. Gets covered in cardboard. Puzzled look. Funny background music cue. 9:16 portrait. Comedy style.
```

### LIFE-01 (Lifestyle)
```markdown
[Pan right]Morning routine. Coffee brewing. Fresh croissants on counter. Sunlight through window. Person stretches, looks outside. Grabs coffee, smiles. Peaceful morning. Warm tones. Aesthetic lifestyle shot. 9:16 portrait.
```

### MOT-01 (Motivation)
```markdown
[Pull out]Athlete alone in gym at dawn. Push-ups in slow motion. Muscles working. Sweat drops. Dawn light through windows. Gets up, determined look. Cracks knuckles. Looks at camera. Eyes burning with determination. Cinematic. 9:16 portrait. Motivational.
```

### MOVIE-01 (Movie Review)
```markdown
[Static]Dramatic movie scene recreation. Dark alley. Rain falling. Character in trench coat walking slowly. Stops. Turns to camera. Intense eyes. Lightning flash. Car headlights in background. Epic music building. Cinematic noir style. 9:16 portrait.
```

### TECH-01 (Tech AI)
```markdown
[Tracking shot]Futuristic office. Holographic screens floating. AI robot arm working. Person watching with amazed expression. Code scrolling on screens. Neon lights. Clean design. High-tech atmosphere. 9:16 portrait. Sci-fi tech style.
```

---

## 🚀 AUTOMATION SCRIPT

```javascript
// Full automation for 1 video
async function generateVideo(script) {
    // 1. Open Hailuo
    browser(action="open", profile="user")
    browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
    sleep(5000)
    
    // 2. Clear and type prompt
    browser(action="act", kind="click", ref="[contenteditable]")
    browser(action="act", kind="press", key="Control+a")
    browser(action="act", kind="press", key="Backspace")
    browser(action="act", kind="type", text=script.prompt, slowly=true)
    
    // 3. Generate
    browser(action="act", kind="click", ref="[button:Create]")
    
    // 4. Wait (max 15 min)
    for (i = 0; i < 30; i++) {
        sleep(30000)
        browser(action="snapshot")
        if (hasDownloadButton()) break
    }
    
    // 5. Download
    browser(action="act", kind="click", ref="[Download]")
    
    // 6. Copy to project
    exec(`Copy-Item "C:\\tmp\\openclaw\\uploads\\*.mp4" "output\\videos\\${script.id}.mp4"`)
    
    // 7. Upload
    uploadYouTube(script)
    uploadTikTok(script)
}

// Run for all scripts
for (script of [AESTH-01, COM-01, LIFE-01, MOT-01, MOVIE-01, TECH-01]) {
    if (script.status === "pending") {
        generateVideo(script)
    }
}
```

---

## ✅ CHECKLIST

- [ ] Prompt đầy đủ (subject + action + environment + camera)
- [ ] Textarea cleared trước khi type
- [ ] Click trước khi type
- [ ] Dùng slowly=true cho prompt dài
- [ ] Chờ đủ thời gian generate
- [ ] Verify video hash khác với video trước
- [ ] Upload lên cả YouTube + TikTok
