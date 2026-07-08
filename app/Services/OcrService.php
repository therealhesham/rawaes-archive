<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class OcrService
{
    protected string $apiKey;
    protected string $endpoint = 'https://api.ocr.space/parse/image';
    protected string $diskName = 'local';

    public function __construct()
    {
        $this->apiKey = config('services.ocr.api_key', 'helloworld');
    }

    /**
     * مسار محلي فعلي للملف — أدوات OCR (tesseract/pdftotext) تحتاج ملفاً على القرص.
     * مع التخزين السحابي (DigitalOcean Spaces) يُنزَّل الملف إلى مجلد مؤقت أولاً.
     */
    protected function localPath(string $filePath): string
    {
        if ($this->diskName === 'local') {
            return Storage::disk('local')->path($filePath);
        }

        $tmp = sys_get_temp_dir() . '/ocr_' . md5($filePath)
            . '.' . strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if (!file_exists($tmp)) {
            file_put_contents($tmp, Storage::disk($this->diskName)->get($filePath));
        }

        return $tmp;
    }

    /**
     * Extract text from a file. Routes to OCR for images/PDF,
     * or direct text extraction for DOCX/TXT.
     * $disk: قرص المستند الفعلي (من ArchiveDocument::disk())، يُترك فارغاً لاستخدام الإعداد العام.
     */
    public function extract(string $filePath, string $language = 'ara', ?string $disk = null): ?string
    {
        $this->diskName = $disk ?: config('filesystems.archive_disk', 'local');

        if (!Storage::disk($this->diskName)->exists($filePath)) {
            Log::warning("OCR: file not found: {$filePath}");
            return null;
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        // Direct text extraction for Office docs
        if (in_array($ext, ['docx', 'doc'])) {
            return $this->extractFromWord($filePath);
        }

        if (in_array($ext, ['xlsx', 'xls'])) {
            return $this->extractFromExcel($filePath);
        }

        if ($ext === 'txt') {
            return Storage::disk($this->diskName)->get($filePath);
        }

        // PDF: if it contains selectable text, extract directly; otherwise run OCR.
        if ($ext === 'pdf') {
            $fullPath = $this->localPath($filePath);
            $text = $this->extractPdfText($fullPath, (int) (config('services.ocr.max_pages') ?? 10));
            if ($text) return $text;
            return $this->extractLocally($fullPath, $ext, $language);
        }

        // OCR for images
        try {
            $fullPath = $this->localPath($filePath);
            $fileSize = filesize($fullPath);

            // If OCR.space key isn't configured (default demo key), use local OCR directly.
            if (empty($this->apiKey) || $this->apiKey === 'helloworld') {
                return $this->extractLocally($fullPath, $ext, $language);
            }

            // Prefer local OCR for large files to avoid OCR.space free-tier limits.
            if ($fileSize > 1024 * 1024) {
                return $this->extractLocally($fullPath, $ext, $language);
            }

            $response = Http::timeout(60)
                ->attach('file', file_get_contents($fullPath), basename($filePath))
                ->post($this->endpoint, [
                    'apikey' => $this->apiKey,
                    'language' => $language,
                    'isOverlayRequired' => 'false',
                    'detectOrientation' => 'true',
                    'scale' => 'true',
                    'OCREngine' => '2',
                ]);

            $data = $response->json();

            if (!empty($data['IsErroredOnProcessing'])) {
                Log::error('OCR error: ' . json_encode($data['ErrorMessage'] ?? []));
                // Remote rejected params/file; fallback to local OCR.
                return $this->extractLocally($fullPath, $ext, $language);
            }

            $texts = [];
            foreach ($data['ParsedResults'] ?? [] as $result) {
                if (!empty($result['ParsedText'])) {
                    $texts[] = trim($result['ParsedText']);
                }
            }

            $remote = $texts ? implode("\n\n", $texts) : null;
            if ($remote) return $remote;

            // Fallback to local OCR if remote returns no text.
            return $this->extractLocally($fullPath, $ext, $language);
        } catch (\Throwable $e) {
            Log::error('OCR exception: ' . $e->getMessage());
            // Fallback to local OCR on remote failures.
            try {
                $fullPath = $this->localPath($filePath);
                return $this->extractLocally($fullPath, $ext, $language);
            } catch (\Throwable $e2) {
                Log::error('OCR local fallback exception: ' . $e2->getMessage());
                return null;
            }
        }
    }

    protected function extractPdfText(string $fullPath, int $maxPages): ?string
    {
        // If PDF already contains selectable text, extract it (best quality).
        $pdftotext = new Process(['pdftotext', '-layout', '-f', '1', '-l', (string) max(1, $maxPages), $fullPath, '-']);
        $pdftotext->setTimeout(60);
        $pdftotext->run();
        if ($pdftotext->isSuccessful()) {
            $txt = trim($pdftotext->getOutput());
            // Avoid returning noise for image-only PDFs.
            if (mb_strlen($txt) >= 60) return $txt;
        } else {
            Log::warning('OCR(pdftotext) failed: ' . $pdftotext->getErrorOutput());
        }
        return null;
    }

    protected function extractLocally(string $fullPath, string $ext, string $language): ?string
    {
        $lang = $this->mapLanguage($language);
        $maxPages = (int) (config('services.ocr.max_pages') ?? 10);
        $dpi = (int) (config('services.ocr.dpi') ?? 300);

        if ($ext === 'pdf') {
            // If it has text, extract it; else OCR.
            $txt = $this->extractPdfText($fullPath, $maxPages);
            if ($txt) return $txt;
            return $this->extractFromPdfWithTesseract($fullPath, $lang, $maxPages, $dpi);
        }

        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'])) {
            return $this->extractFromImageWithTesseract($fullPath, $lang);
        }

        return null;
    }

    protected function extractFromImageWithTesseract(string $fullPath, string $lang): ?string
    {
        $tmpDir = storage_path('app/ocr_tmp/' . uniqid('img_', true));
        if (!is_dir($tmpDir) && !mkdir($tmpDir, 0775, true) && !is_dir($tmpDir)) {
            Log::error("OCR: cannot create tmp dir: {$tmpDir}");
            return null;
        }

        try {
            $pre = $tmpDir . '/pre.png';
            // Improve small label text: upscale + normalize + mild sharpen. Avoid hard threshold for photos.
            $magick = new Process([
                'magick',
                $fullPath,
                '-auto-orient',
                '-resize', '200%',
                '-colorspace', 'Gray',
                '-contrast-stretch', '1%x1%',
                '-sharpen', '0x1',
                $pre,
            ]);
            $magick->setTimeout(30);
            $magick->run();
            $inputForOcr = ($magick->isSuccessful() && file_exists($pre)) ? $pre : $fullPath;

            // Two-pass OCR: English-only often works better for device labels; fallback to ara+eng.
            $candEng = $this->runTesseract($inputForOcr, 'eng');
            $candMixed = $this->runTesseract($inputForOcr, $lang);

            $best = $this->pickBestOcrText([$candEng, $candMixed]);
            return $best;
        } finally {
            foreach (glob($tmpDir . '/*') ?: [] as $f) @unlink($f);
            @rmdir($tmpDir);
        }
    }

    protected function runTesseract(string $path, string $lang): ?string
    {
        $p = new Process([
            'tesseract',
            $path,
            'stdout',
            '-l', $lang,
            '--oem', '1',
            '--psm', '6',
            '-c', 'preserve_interword_spaces=1',
        ]);
        $p->setTimeout(120);
        $p->run();
        if (!$p->isSuccessful()) {
            Log::warning('OCR(tesseract) failed: ' . $p->getErrorOutput());
            return null;
        }
        $text = trim($p->getOutput());
        return $text !== '' ? $text : null;
    }

    protected function pickBestOcrText(array $candidates): ?string
    {
        $best = null;
        $bestScore = -INF;
        foreach ($candidates as $text) {
            if (!$text) continue;
            $score = $this->scoreOcrText($text);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $text;
            }
        }
        return $best;
    }

    protected function scoreOcrText(string $text): float
    {
        $t = trim($text);
        if ($t === '') return -1e9;

        $len = mb_strlen($t);
        $alnum = preg_match_all('/[A-Za-z0-9]/u', $t) ?: 0;
        $arabic = preg_match_all('/[\x{0600}-\x{06FF}]/u', $t) ?: 0;
        $lines = substr_count($t, "\n") + 1;
        $zerosRuns = preg_match_all('/0{5,}/', $t) ?: 0;
        $onesRuns = preg_match_all('/1{8,}/', $t) ?: 0;
        $garbageRuns = preg_match_all('/[|_`~]{3,}/', $t) ?: 0;

        // Reward meaningful characters; penalize obvious OCR noise patterns.
        $score = 0.0;
        $score += min(400, $alnum) * 1.2;
        $score += min(200, $arabic) * 1.0;
        $score += min(800, $len) * 0.05;
        $score -= $zerosRuns * 40;
        $score -= $onesRuns * 30;
        $score -= $garbageRuns * 20;
        $score -= max(0, $lines - 40) * 1.5;

        return $score;
    }

    protected function extractFromPdfWithTesseract(string $fullPath, string $lang, int $maxPages, int $dpi): ?string
    {
        $tmpDir = storage_path('app/ocr_tmp/' . uniqid('pdf_', true));
        if (!is_dir($tmpDir) && !mkdir($tmpDir, 0775, true) && !is_dir($tmpDir)) {
            Log::error("OCR: cannot create tmp dir: {$tmpDir}");
            return null;
        }

        try {
            $prefix = $tmpDir . '/page';
            // Convert first N pages to PNG using poppler (pdftoppm).
            $convert = new Process([
                'pdftoppm',
                '-r', (string) max(150, $dpi),
                '-gray',
                '-f', '1',
                '-l', (string) max(1, $maxPages),
                '-png',
                $fullPath,
                $prefix,
            ]);
            $convert->setTimeout(240);
            $convert->run();

            if (!$convert->isSuccessful()) {
                Log::error('OCR(pdftoppm) failed: ' . $convert->getErrorOutput());
                return null;
            }

            $images = glob($tmpDir . '/page-*.png') ?: [];
            sort($images);
            if (empty($images)) return null;

            $texts = [];
            foreach ($images as $img) {
                // Light preprocessing (optional): normalize/threshold can help scanned docs.
                $pre = $tmpDir . '/' . basename($img, '.png') . '-pre.png';
                $magick = new Process([
                    'magick',
                    $img,
                    '-deskew', '40%',
                    '-normalize',
                    '-sharpen', '0x1',
                    '-threshold', '55%',
                    $pre,
                ]);
                $magick->setTimeout(30);
                $magick->run();

                $inputForOcr = ($magick->isSuccessful() && file_exists($pre)) ? $pre : $img;

                $p = new Process([
                    'tesseract',
                    $inputForOcr,
                    'stdout',
                    '-l', $lang,
                    '--oem', '1',
                    '--psm', '6',
                    '-c', 'preserve_interword_spaces=1',
                ]);
                $p->setTimeout(120);
                $p->run();
                if ($p->isSuccessful()) {
                    $t = trim($p->getOutput());
                    if ($t !== '') $texts[] = $t;
                } else {
                    Log::warning('OCR(tesseract pdf page) failed: ' . $p->getErrorOutput());
                }
            }

            return $texts ? implode("\n\n", $texts) : null;
        } finally {
            foreach (glob($tmpDir . '/*') ?: [] as $f) @unlink($f);
            @rmdir($tmpDir);
        }
    }

    protected function mapLanguage(string $language): string
    {
        $lang = strtolower(trim($language));
        // For mixed documents, adding English improves recognition of numbers/latin.
        if ($lang === 'ara') return 'ara+eng';
        if ($lang === 'eng') return 'eng';
        return 'ara+eng';
    }

    /**
     * Extract text from DOCX/DOC using PhpWord.
     */
    protected function extractFromWord(string $filePath): ?string
    {
        try {
            $fullPath = $this->localPath($filePath);
            $phpWord = \PhpOffice\PhpWord\IOFactory::load($fullPath);

            $text = [];
            foreach ($phpWord->getSections() as $section) {
                $this->walkElements($section->getElements(), $text);
            }

            return $text ? trim(implode("\n", $text)) : null;
        } catch (\Throwable $e) {
            Log::error('Word extraction error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Extract text from XLSX/XLS using PhpSpreadsheet (no OCR).
     */
    protected function extractFromExcel(string $filePath): ?string
    {
        try {
            $fullPath = $this->localPath($filePath);
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($fullPath);

            $lines = [];
            foreach ($spreadsheet->getWorksheetIterator() as $sheet) {
                $sheetTitle = $sheet->getTitle();
                $lines[] = "=== Sheet: {$sheetTitle} ===";

                $highestRow = min(5000, (int) $sheet->getHighestDataRow());
                $highestCol = $sheet->getHighestDataColumn();

                // Read as formatted strings.
                for ($row = 1; $row <= $highestRow; $row++) {
                    $rowVals = $sheet->rangeToArray("A{$row}:{$highestCol}{$row}", null, true, true, true);
                    $rowVals = $rowVals[0] ?? [];
                    $cells = [];
                    foreach ($rowVals as $v) {
                        $str = is_scalar($v) ? trim((string) $v) : '';
                        $cells[] = $str;
                    }
                    // Skip empty rows
                    if (implode('', $cells) === '') continue;
                    $lines[] = implode("\t", $cells);
                    if (count($lines) >= 20000) break 2; // safety
                }
            }

            $text = trim(implode("\n", $lines));
            return $text !== '' ? $text : null;
        } catch (\Throwable $e) {
            Log::error('Excel extraction error: ' . $e->getMessage());
            return null;
        }
    }

    protected function walkElements(array $elements, array &$text): void
    {
        foreach ($elements as $el) {
            if (method_exists($el, 'getText')) {
                $str = $el->getText();
                if (is_string($str) && trim($str) !== '') {
                    $text[] = $str;
                }
            }
            if (method_exists($el, 'getElements')) {
                $this->walkElements($el->getElements(), $text);
            }
        }
    }
}
