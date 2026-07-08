<?php

namespace App\Console\Commands;

use App\Models\ArchiveDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateArchiveStorage extends Command
{
    protected $signature = 'archive:migrate-storage
                            {--to=spaces : القرص الهدف}
                            {--delete-source : حذف الملفات من القرص القديم بعد النسخ الناجح}';

    protected $description = 'نقل جماعي لكل مستندات الأرشيف إلى قرص تخزين آخر (لأداة نقل انتقائي من الواجهة استخدم صفحة إدارة التخزين)';

    public function handle(): int
    {
        $to = $this->option('to');
        $toDisk = Storage::disk($to);

        $docs = ArchiveDocument::withTrashed()->where('storage_disk', '!=', $to)->get();

        $this->info("نقل {$docs->count()} مستند إلى {$to}...");

        $ok = $skipped = $failed = 0;
        $bar = $this->output->createProgressBar($docs->count());

        foreach ($docs as $doc) {
            try {
                $fromDisk = Storage::disk($doc->disk());
                if (!$fromDisk->exists($doc->file_path)) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }
                if (!$toDisk->exists($doc->file_path)) {
                    $toDisk->writeStream($doc->file_path, $fromDisk->readStream($doc->file_path));
                }
                if ($this->option('delete-source')) {
                    $fromDisk->delete($doc->file_path);
                }
                $doc->update(['storage_disk' => $to]);
                $ok++;
            } catch (\Throwable $e) {
                $failed++;
                $this->newLine();
                $this->error("فشل: مستند #{$doc->id} — {$e->getMessage()}");
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("تم: {$ok} منقول، {$skipped} غير موجود، {$failed} فشل");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
