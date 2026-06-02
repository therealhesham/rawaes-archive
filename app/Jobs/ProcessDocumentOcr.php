<?php

namespace App\Jobs;

use App\Models\ArchiveDocument;
use App\Services\OcrService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessDocumentOcr implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(public int $documentId) {}

    public function handle(OcrService $ocr): void
    {
        $doc = ArchiveDocument::find($this->documentId);
        if (!$doc) return;

        // Supported extensions for text extraction / OCR.
        $supportedExt = [
            'pdf',
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
            'docx', 'doc',
            'xlsx', 'xls',
            'txt',
        ];
        if (!in_array(strtolower($doc->file_extension), $supportedExt)) {
            return;
        }

        $text = $ocr->extract($doc->file_path, 'ara');

        if ($text) {
            // Save OCR text (truncate if huge to avoid DB bloat)
            $doc->update([
                'ocr_content' => mb_substr($text, 0, 65000),
            ]);
            Log::info("OCR completed for document {$doc->id}: " . mb_strlen($text) . " chars");
        } else {
            Log::info("OCR returned no text for document {$doc->id}");
        }
    }
}
