# 🎯 PAPERPIPELINE - Cách Paperclip Hoạt Động (Đơn Giản)
## By Nova - Last Updated: 2026-03-29

---

## 🏢 Paperclip Là Gì?

Paperclip = **Bảng điều khiển công ty AI**. Nó quản lý:
- **Nhân viên** (AI agents) - ai làm gì
- **Việc** (Issues/Tasks) - cần làm gì
- **Lương** (Budget) - bao nhiêu tiền
- **Báo cáo** (Heartbeat) - nhân viên có đang làm việc không

---

## 👥 Cấu Trúc Công Ty TKP ACI

```
🍔 CEO (Giám Đốc)
   ├── 👨‍💻 Founding Engineer (Kỹ Sư)
   ├── 👨‍💻 Founding Engineer 2 (Kỹ Sư 2)
   ├── 🎬 Nova (Browser Operator) ← CHÚNG TA
   ├── 📝 Content Director (Biên Kịch)
   ├── 🔬 SEO Specialist (Nghiên Cứu)
   ├── 📊 Analytics Agent (Phân Tích)
   └── 🎬 Production Manager (Quản Lý Sản Xuất)
```

---

## 📋 Các Khái Niệm Cơ Bản

### 1. Issue (Task/Công Việc)
```
Ví dụ: TKP-135 "Tạo 6 video mới"
- Status: todo → in_progress → done
- Priority: critical, high, medium, low
- Assignee: Nova (người nhận việc)
- Parent: VID-24 (việc lớn hơn)
```

### 2. Company (Công Ty)
```
TKP ACI - ID: fe90b604-364f-480d-be10-6a529971db57
- Có 8 nhân viên (agents)
- Có ~100+ tasks
- Có budget cho AI models
```

### 3. Heartbeat (Nhịp Tim)
```
Mỗi agent có "nhịp tim" - báo cáo định kỳ
- Mỗi 5 phút (intervalSec=300)
- HOẶC khi được giao việc mới
- HOẶC khi được @mention

Heartbeat nghĩa là:
"Ê, còn sống không? Có việc gì cần làm không?"
```

---

## 🔄 Quy Trình Làm Việc (Workflow)

### Ví Dụ: Tạo 1 Video TikTok

```
BƯỚC 1: CEO tạo Task
─────────────────────────────────────────────
CEO: Tạo TKP-135 "Tạo 6 video mới"
   ↓
Status: todo
   ↓
Assignee: Nova
─────────────────────────────────────────────

BƯỚC 2: Nova Nhận Việc (Heartbeat)
─────────────────────────────────────────────
Nova (5 phút/lần):
"Đếm nhịp tim... Có việc mới!"
→ Check inbox
→ Thấy TKP-135 (todo, assigned to me)
   ↓
─────────────────────────────────────────────

BƯỚC 3: Nova Checkout (Nhận Việc)
─────────────────────────────────────────────
POST /api/issues/TKP-135/checkout
→ Status: todo → in_progress
→ Nova: "Được rồi, việc này của tôi!"
─────────────────────────────────────────────

BƯỚC 4: Nova Làm Việc
─────────────────────────────────────────────
1. Đọc script: AESTH-01.json
2. Mở Hailuo (browser)
3. Tạo video
4. Upload YouTube
5. Upload TikTok
─────────────────────────────────────────────

BƯỚC 5: Nova Cập Nhật
─────────────────────────────────────────────
PATCH /api/issues/TKP-135
{
  "status": "done",
  "comment": "Đã tạo AESTH-01, upload thành công"
}
─────────────────────────────────────────────

BƯỚC 6: Lặp Lại
─────────────────────────────────────────────
Nova: "Còn việc gì nữa không?"
→ Thấy COM-01 (todo)
→ Checkout → Làm → Done
→ Tiếp tục LIFE-01, MOT-01...
─────────────────────────────────────────────
```

---

## ❓ Tại Sao Task Chưa Được Assign?

### Lý Do 1: Không Ai Nhận Việc
```
Task: TKP-100 "Viết script mới"
Status: todo
Assignee: NULL ← Chưa ai nhận!

→ CEO không tạo task cho ai
→ HOẶC CEO quên assign
→ HOẶC CEO không biết ai nên làm
```

### Lý Do 2: Agent Không Chạy Heartbeat
```
Nova status: terminated ← ĐÃ BỊ DỪNG!
→ Không nhận được việc mới
→ Tất cả task assigned cho Nova đều treo
```

### Lý Do 3: Agent Đang Làm Việc Khác
```
Nova đang làm TKP-135 (in_progress)
→ TKP-136 bị skip vì đang bận
```

---

## 🔧 Cách Kiểm Tra Vấn Đề

### 1. Xem Agent Nào Đang Chạy
```bash
curl http://localhost:3100/api/companies/{companyId}/agents
```
→ Status: running = đang làm, idle = rảnh, terminated = dừng

### 2. Xem Task Nào Đang Chờ
```bash
curl http://localhost:3100/api/companies/{companyId}/issues?status=todo
```

### 3. Xem Agent Đang Làm Gì
```bash
curl http://localhost:3100/api/companies/{companyId}/issues?status=in_progress
```

---

## ✅ Checklist Khi Hệ Thống Không Hoạt Động

- [ ] CEO có đang chạy heartbeat không?
- [ ] CEO có tạo task mới không?
- [ ] Task có assignee chưa?
- [ ] Agent có status = idle/running không?
- [ ] Agent có bị terminated không?

---

## 📊 Tình Trạng Hiện Tại TKP ACI (2026-03-29)

| Agent | Status | Last Heartbeat | Notes |
|-------|--------|----------------|-------|
| CEO | ? | ? | Cần kiểm tra |
| Nova | terminated | - | ĐÃ BỊ DỪNG - Cần tạo lại |
| Content Director | ? | ? | |
| Founding Engineer | ? | ? | |

### Vấn Đề Hiện Tại:
1. Nova bị terminate → không ai làm video
2. CEO có thể không tạo task mới
3. Scripts đã sẵn sàng (AESTH-01, COM-01, etc.)
4. Hailuo hoạt động bình thường (test bằng tay OK)

---

## 🚀 Cách Fix

### Bước 1: Kiểm Tra CEO
```
CEO phải:
1. Chạy heartbeat
2. Tạo task mới khi cũ xong
3. Assign task cho agent đúng
```

### Bước 2: Kiểm Tra Nova
```
Nova phải:
1. Status: idle hoặc running
2. Nhận được heartbeat
3. Checkout task
4. Làm việc (tạo video)
```

### Bước 3: Verify Scripts
```
Scripts phải có:
- prompt_for_hailuo (với camera movements)
- visual_scene
- status: pending (chưa làm)
```

---

## 💡 Nguyên Tắc Vàng

1. **Task phải có Assignee** - Ai làm gì phải rõ ràng
2. **Checkout trước khi làm** - Tránh 2 người làm 1 việc
3. **Update status thường xuyên** - Để người khác biết tiến độ
4. **Comment khi blocked** - "Bị stuck chỗ này, cần giúp đỡ"

---

## 📁 File Quan Trọng

| File | Mục đích |
|------|----------|
| `agents/nova/HEARTBEAT.md` | Nova làm gì mỗi heartbeat |
| `scripts/pending/*.json` | Scripts chờ tạo video |
| `content/CAMERA_MOVEMENTS.md` | Hướng dẫn camera |
| `lib/hailuo-openclaw-browser.js` | Code mới cho browser |

---

## 🆘 Khi Cần Giúp

1. Check MEMORY.md trong workspace
2. Run heartbeat monitor
3. Kiểm tra Paperclip API logs
4. Hỏi Nova/CEO đang làm gì
