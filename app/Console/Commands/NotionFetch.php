<?php

namespace App\Console\Commands;

use App\Services\NotionService;
use Illuminate\Console\Command;

class NotionFetch extends Command
{
    protected $signature = 'notion:fetch
                            {database? : معرف قاعدة بيانات Notion (اختياري، الافتراضي NOTION_DATABASE_ID)}
                            {--json : إخراج النتائج بصيغة JSON}';

    protected $description = 'جلب صفوف قاعدة بيانات Notion وعرضها';

    public function handle(NotionService $notion): int
    {
        try {
            $rows = $notion->fetchDatabaseRows($this->argument('database'));
        } catch (\Throwable $e) {
            $this->error('فشل الجلب من Notion: ' . $e->getMessage());
            return self::FAILURE;
        }

        if (empty($rows)) {
            $this->warn('قاعدة البيانات فارغة أو لا توجد صفوف مطابقة.');
            return self::SUCCESS;
        }

        if ($this->option('json')) {
            $this->line(json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            return self::SUCCESS;
        }

        // جدول: الأعمدة من مفاتيح أول صف (بحد أقصى 6 أعمدة للقراءة)
        $headers = array_slice(array_keys($rows[0]), 0, 6);
        $tableRows = array_map(function ($row) use ($headers) {
            return array_map(function ($h) use ($row) {
                $v = $row[$h] ?? '';
                if (is_array($v)) $v = implode(', ', $v);
                if (is_bool($v)) $v = $v ? 'نعم' : 'لا';
                return mb_strimwidth((string) $v, 0, 40, '…');
            }, $headers);
        }, $rows);

        $this->table($headers, $tableRows);
        $this->info('إجمالي الصفوف: ' . count($rows));

        return self::SUCCESS;
    }
}
