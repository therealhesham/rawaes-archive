# تثبيت روائس - مراقب السكانر

## الخيار الأسهل: ملف Setup جاهز

إذا كان لديك ملف:

`RawaesWatcherSetup.exe`

فهذا هو الخيار الموصى به.

### خطوات التثبيت على أي جهاز Windows

1. شغّل `RawaesWatcherSetup.exe`
2. اضغط `Next` ثم `Install`
3. سيتم إنشاء مجلد السكان الافتراضي تلقائياً
4. بعد التثبيت سيفتح البرنامج
5. من داخل الواجهة:
   - اكتب رابط النظام
   - اكتب `API Token`
   - اختر السكانر
   - اختر الجارور أو الزجاج
   - اختر `DPI` والألوان والوجهين إذا لزم
6. اضغط `حفظ الإعدادات`
7. اضغط `تشغيل`

لا تحتاج إلى:
- Python
- Notepad
- أوامر يدوية

---

## 🚀 تثبيت بأمر واحد

افتح **PowerShell كـ Administrator** على PC الجديد، وشغّل:

```powershell
irm https://raw.githubusercontent.com/NourAlasmar/rawaes-archive/main/scanner-watcher/install.ps1 | iex
```

السكريبت سيقوم تلقائياً بـ:
1. ✅ التحقق من Python (وتثبيته إذا لم يكن موجوداً)
2. ✅ تنزيل ملفات المراقب من GitHub
3. ✅ تثبيت المكتبات المطلوبة
4. ✅ سؤالك عن:
   - رابط النظام
   - API Token
   - اسم الجهاز
   - مجلد السكانر
   - السكانر المفضّل
   - مصدر المسح (درج/زجاج)
5. ✅ إنشاء اختصار سطح المكتب
6. ✅ تفعيل التشغيل التلقائي مع Windows
7. ✅ تشغيل المراقب فوراً

---

## 📋 المعلومات المطلوبة:

قبل البدء، احصل من admin النظام على:

| الحقل | مثال |
|-------|------|
| رابط النظام | `http://45.63.117.248` |
| API Token | `1a814cb14fd1...` |

---

## 🔧 إذا حصلت مشكلة في PowerShell:

إذا منعك Windows من تشغيل السكريبت، شغّل هذا أولاً:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 🔄 لتحديث المراقب لاحقاً:

أعد تشغيل نفس الأمر — سيحدّث الملفات ويبقي على الإعدادات.

---

## 🗑️ لإلغاء التثبيت:

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\RawaesWatcher"
Remove-Item "$env:USERPROFILE\Desktop\Rawaes Scanner.lnk" -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\RawaesWatcher.lnk" -ErrorAction SilentlyContinue
```
