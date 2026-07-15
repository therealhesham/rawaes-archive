<?php

namespace App\Jobs;

use App\Models\ArchiveDocument;
use App\Services\OpenRouterExtractionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessDocumentAiExtraction implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;
    public int $timeout = 180;

    public function __construct(public int $documentId) {}

    public function handle(OpenRouterExtractionService $ai): void
    {
        $doc = ArchiveDocument::find($this->documentId);
        if (!$doc) {
            return;
        }

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

        $text = $ai->extract($doc->file_path, $doc->disk());

        if ($text) {
            $doc->update([
                'ocr_content' => mb_substr($text, 0, 65000),
            ]);
            Log::info("AI extraction completed for document {$doc->id}: " . mb_strlen($text) . " chars");
        } else {
            Log::info("AI extraction returned no text for document {$doc->id}");
        }
    }
}
