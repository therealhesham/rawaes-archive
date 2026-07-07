<?php

namespace App\Console\Commands;

use App\Models\ArchiveDocument;
use App\Models\PendingScan;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateArchiveStorage extends Command
{
    protected $signature = 'archive:migrate-storage
                            {--from=local : القرص المصدر}
                            {--to=spaces : القرص الهدف}
                            {--delete-source : حذف الملفات من المصدر بعد النسخ الناجح}';

    protected $description = 'نقل ملفات الأرشيف والمسحوبات بين قرصي تخزين (مثلاً من المحلي إلى DigitalOcean Spaces)';

    public function handle(): int
    {
        $from = Storage::disk($this->option('from'));
        $to = Storage::disk($this->option('to'));

        $paths = ArchiveDocument::withTrashed()->pluck('file_path')
            ->merge(PendingScan::pluck('file_path'))
            ->filter()
            ->unique();

        $this->info("نقل {$paths->count()} ملف من {$this->option('from')} إلى {$this->option('to')}...");

        $ok = $skipped = $failed = 0;
        $bar = $this->output->createProgressBar($paths->count());

        foreach ($paths as $path) {
            try {
                if (!$from->exists($path)) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }
                if (!$to->exists($path)) {
                    $to->writeStream($path, $from->readStream($path));
                }
                if ($this->option('delete-source')) {
                    $from->delete($path);
                }
                $ok++;
            } catch (\Throwable $e) {
                $failed++;
                $this->newLine();
                $this->error("فشل: {$path} — {$e->getMessage()}");
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("تم: {$ok} منقول، {$skipped} غير موجود بالمصدر، {$failed} فشل");

        if ($failed === 0 && $ok > 0) {
            $this->comment('غيّر الآن ARCHIVE_DISK=' . $this->option('to') . ' في ملف البيئة وأعد إنشاء الحاوية.');
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
