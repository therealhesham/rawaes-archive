# واجهة تكامل روائس (Integration API) — رفع مستندات مباشرة

هذه الوثيقة مخصصة لمطوري الأنظمة الخارجية الذين يحتاجون لرفع مستندات إلى نظام **روائس للأرشفة** مباشرة بدون تسجيل دخول مستخدم.

---

## 1) معلومات أساسية

- **Base URL:** `http://45.63.117.248`
- **نوع البيانات:** JSON
- **المصادقة:** توكن واحد مشترك عبر الهيدر `X-Integration-Token`
- **حد حجم الملف:** 50MB
- **أنواع الملفات المسموحة:**
  - `pdf`
  - `jpg`, `jpeg`, `png`
  - `doc`, `docx`
  - `xls`, `xlsx`
  - `ppt`, `pptx`
  - `txt`

---

## 2) المصادقة (Authentication)

أرسل هذه الهيدرز في **كل** طلب:

- `X-Integration-Token: <INTEGRATION_API_TOKEN>`
- `Accept: application/json`

ملاحظة: قيمة `<INTEGRATION_API_TOKEN>` يزودكم بها مدير النظام (Admin) فقط.

---

## 3) الحصول على بيانات الميتاداتا (مرة واحدة)

### 3.1 Endpoint واحد شامل (الموصى به)

**GET** `/api/integration/bootstrap`

يرجع:
- `sectors`: القطاعات
- `document_types`: أنواع المستندات
- `folders`: المجلدات (بما فيها الهيكل عبر `parent_id`)

مثال:
```bash
curl "http://45.63.117.248/api/integration/bootstrap" \
  -H "X-Integration-Token: YOUR_TOKEN" \
  -H "Accept: application/json"
```

### 3.2 Endpoints منفصلة (اختياري)

- **GET** `/api/integration/sectors`
- **GET** `/api/integration/document-types`
- **GET** `/api/integration/folders?sector_id=<ID>` (اختياري فلترة حسب القطاع)

---

## 4) رفع مستند للنظام

### 4.1 Endpoint

**POST** `/api/integration/documents`

**Content-Type:** `multipart/form-data`

### 4.2 الحقول المطلوبة

- `file` (ملف واحد)
- `sector_id` (رقم القطاع من `bootstrap`)
- `folder_id` (رقم المجلد من `bootstrap`)
- `document_type_id` (رقم نوع المستند من `bootstrap`)

### 4.3 الحقول الاختيارية

- `title` عنوان المستند (إذا لم يُرسل سيتم اشتقاقه من اسم الملف)
- `document_number` رقم الوثيقة
- `issuing_entity` الجهة المصدرة
- `issue_date` تاريخ الإصدار (`YYYY-MM-DD`)
- `expiry_date` تاريخ الانتهاء (`YYYY-MM-DD`)
- `notes` ملاحظات
- `is_confidential` هل المستند سري (`0/1` أو `true/false`)
- `source_device` اسم النظام/الجهاز لديكم (لإظهاره في السجلات)

### 4.4 مثال جاهز (curl)

```bash
curl -X POST "http://45.63.117.248/api/integration/documents" \
  -H "X-Integration-Token: YOUR_TOKEN" \
  -H "Accept: application/json" \
  -F "file=@/path/to/file.pdf" \
  -F "sector_id=3" \
  -F "folder_id=5" \
  -F "document_type_id=1" \
  -F "title=عنوان المستند" \
  -F "document_number=ABC-123" \
  -F "source_device=ExternalSystem01"
```

### 4.5 الاستجابة (Response)

عند النجاح (HTTP 200):
```json
{
  "success": true,
  "id": 123,
  "serial_number": 45,
  "title": "عنوان المستند",
  "url": "http://45.63.117.248/archive/documents/123"
}
```

---

## 5) قواعد مهمة

1) **تطابق القطاع والمجلد**
- يجب أن يكون `folder_id` تابعًا لـ `sector_id` المحدد، وإلا سيعود خطأ `422`.

2) **OCR**
- النظام قد يقوم باستخراج النص (OCR) في الخلفية حسب نوع الملف وإعدادات النظام.

3) **السجلات (Audit Log)**
- سيتم تسجيل عملية الرفع كسجل في النظام باسم مثل: `Integration [source_device]`.

---

## 6) الأخطاء المتوقعة

- **401 Unauthorized**
  - توكن التكامل غير صحيح أو غير موجود.
- **422 Validation Error**
  - نقص حقل مطلوب أو قيمة غير صحيحة (مثلاً `folder_id` لا يتبع `sector_id`).
- **500 Server Error**
  - مشكلة داخلية بالسيرفر (يرجى التواصل مع مدير النظام مع وقت الخطأ).

---

## 7) نقطة اتصال

في حال احتجتم توكن أو صلاحيات أو إضافة نوع ملف:
- تواصلوا مع **مدير النظام (Admin)** الخاص بنظام روائس.

