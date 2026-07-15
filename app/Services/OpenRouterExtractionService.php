<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * استخراج نص المستندات بالذكاء الاصطناعي عبر OpenRouter (نماذج vision).
 * يقرأ الصورة/الـ PDF ويُعيد نصاً نظيفاً منسّقاً بديلاً عن OCR التقليدي.
 */
class OpenRouterExtractionService
{
    protected string $diskName = 'local';

    public function isConfigured(): bool
    {
        return !empty(config('services.openrouter.api_key'));
    }

    /**
     * استخراج نص نظيف من المستند. يُرجع null عند الفشل أو عدم التهيئة.
     * $disk: قرص المستند الفعلي (من ArchiveDocument::disk()).
     */
    public function extract(string $filePath, ?string $disk = null): ?string
    {
        if (!$this->isConfigured()) {
            Log::warning('OpenRouter: API key not configured');
            return null;
        }

        $this->diskName = $disk ?: config('filesystems.archive_disk', 'local');

        if (!Storage::disk($this->diskName)->exists($filePath)) {
            Log::warning("OpenRouter: file not found: {$filePath}");
            return null;
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        // الصور تُرسل مباشرة للنموذج متعدد الوسائط.
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'])) {
            $mime = $this->imageMime($ext);
            $b64 = base64_encode(Storage::disk($this->diskName)->get($filePath));
            return $this->visionRequest(["data:{$mime};base64,{$b64}"]);
        }

        // PDF: نحوّل الصفحات الأولى إلى صور ثم نرسلها للنموذج.
        if ($ext === 'pdf') {
            $images = $this->pdfToImageDataUrls($filePath);
            if (empty($images)) {
                Log::warning("OpenRouter: could not rasterize PDF: {$filePath}");
                return null;
            }
            return $this->visionRequest($images);
        }

        // ملفات نصية/مكتبية: نستخرج النص أولاً ثم نطلب من النموذج تنظيفه وتنسيقه.
        $raw = app(OcrService::class)->extract($filePath, 'ara', $this->diskName);
        if (!$raw) {
            return null;
        }

        return $this->textCleanupRequest($raw);
    }

    /**
     * طلب vision للنموذج مع قائمة صور (data URLs).
     */
    protected function visionRequest(array $imageDataUrls): ?string
    {
        $content = [[
            'type' => 'text',
            'text' => $this->extractionPrompt(),
        ]];

        foreach ($imageDataUrls as $url) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $url],
            ];
        }

        return $this->chat([
            ['role' => 'system', 'content' => $this->systemPrompt()],
            ['role' => 'user', 'content' => $content],
        ]);
    }

    /**
     * طلب تنظيف نص مُستخرَج مسبقاً (للملفات المكتبية/النصية).
     */
    protected function textCleanupRequest(string $rawText): ?string
    {
        // نحدّ من الطول لتفادي تجاوز حدود النموذج.
        $rawText = mb_substr($rawText, 0, 60000);

        return $this->chat([
            ['role' => 'system', 'content' => $this->systemPrompt()],
            ['role' => 'user', 'content' => $this->extractionPrompt() . "\n\n---\n" . $rawText],
        ]);
    }

    protected function chat(array $messages): ?string
    {
        try {
            $response = Http::withToken(config('services.openrouter.api_key'))
                ->withHeaders([
                    'HTTP-Referer' => config('app.url'),
                    'X-Title'      => config('app.name', 'Rawaes Archive'),
                ])
                ->timeout(120)
                ->post(rtrim(config('services.openrouter.base_url'), '/') . '/chat/completions', [
                    'model' => config('services.openrouter.model'),
                    'temperature' => 0,
                    'messages' => $messages,
                ]);

            if (!$response->successful()) {
                Log::error('OpenRouter error: HTTP ' . $response->status() . ' ' . $response->body());
                return null;
            }

            $data = $response->json();
            $text = $data['choices'][0]['message']['content'] ?? null;

            if (is_array($text)) {
                // بعض النماذج تُرجع محتوى على هيئة أجزاء.
                $text = collect($text)->pluck('text')->filter()->implode("\n");
            }

            $text = is_string($text) ? trim($text) : null;

            return $text !== '' ? $text : null;
        } catch (\Throwable $e) {
            Log::error('OpenRouter exception: ' . $e->getMessage());
            return null;
        }
    }

    protected function systemPrompt(): string
    {
        return 'أنت مساعد متخصص في استخراج النصوص من صور ومستندات الأرشيف. '
            . 'استخرج كل النص الظاهر بدقة وحافظ على ترتيبه المنطقي.';
    }

    protected function extractionPrompt(): string
    {
        return 'استخرج النص الكامل من هذا المستند وأعد كتابته نصاً نظيفاً ومنسّقاً وقابلاً للقراءة. '
            . 'حافظ على الأسطر والفقرات والجداول قدر الإمكان، وصحّح أخطاء التعرّف الواضحة دون إضافة أو حذف معلومات. '
            . 'أعد النص فقط دون أي شرح أو تعليق أو عبارات تمهيدية.';
    }

    protected function imageMime(string $ext): string
    {
        return match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'bmp'  => 'image/bmp',
            'tif', 'tiff' => 'image/tiff',
            default => 'image/png',
        };
    }

    /**
     * تحويل الصفحات الأولى من ملف PDF إلى صور PNG وإرجاعها كـ data URLs.
     */
    protected function pdfToImageDataUrls(string $filePath): array
    {
        $fullPath = $this->localPath($filePath);
        $maxPages = max(1, (int) config('services.openrouter.max_pages', 5));
        $dpi = max(120, (int) config('services.openrouter.dpi', 200));

        $tmpDir = storage_path('app/ai_ocr_tmp/' . uniqid('pdf_', true));
        if (!is_dir($tmpDir) && !mkdir($tmpDir, 0775, true) && !is_dir($tmpDir)) {
            Log::error("OpenRouter: cannot create tmp dir: {$tmpDir}");
            return [];
        }

        try {
            $prefix = $tmpDir . '/page';
            $convert = new Process([
                'pdftoppm',
                '-r', (string) $dpi,
                '-f', '1',
                '-l', (string) $maxPages,
                '-png',
                $fullPath,
                $prefix,
            ]);
            $convert->setTimeout(240);
            $convert->run();

            if (!$convert->isSuccessful()) {
                Log::error('OpenRouter(pdftoppm) failed: ' . $convert->getErrorOutput());
                return [];
            }

            $images = glob($tmpDir . '/page-*.png') ?: [];
            sort($images);

            $urls = [];
            foreach ($images as $img) {
                $b64 = base64_encode(file_get_contents($img));
                $urls[] = "data:image/png;base64,{$b64}";
            }

            return $urls;
        } finally {
            foreach (glob($tmpDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($tmpDir);
        }
    }

    /**
     * مسار محلي فعلي للملف — مع التخزين السحابي يُنزَّل مؤقتاً أولاً.
     */
    protected function localPath(string $filePath): string
    {
        if ($this->diskName === 'local') {
            return Storage::disk('local')->path($filePath);
        }

        $tmp = sys_get_temp_dir() . '/ai_ocr_' . md5($filePath)
            . '.' . strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if (!file_exists($tmp)) {
            file_put_contents($tmp, Storage::disk($this->diskName)->get($filePath));
        }

        return $tmp;
    }
}
