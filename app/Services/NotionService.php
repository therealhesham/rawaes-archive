<?php

namespace App\Services;

use Notion\Notion;
use Notion\Pages\Page;

class NotionService
{
    private Notion $client;

    public function __construct()
    {
        $token = config('services.notion.token');
        if (!$token) {
            throw new \RuntimeException('NOTION_API_TOKEN غير مضبوط في ملف البيئة');
        }
        $this->client = Notion::create($token);
    }

    /**
     * جلب كل صفوف قاعدة بيانات Notion كمصفوفة مبسطة
     * (اسم الخاصية => قيمة قابلة للقراءة).
     *
     * @return array<int, array<string, mixed>>
     */
    public function fetchDatabaseRows(?string $databaseId = null): array
    {
        $databaseId = $this->normalizeDatabaseId($databaseId ?? config('services.notion.database_id'));
        if (!$databaseId) {
            throw new \RuntimeException('NOTION_DATABASE_ID غير مضبوط ولم يُمرر معرف قاعدة بيانات');
        }

        $database = $this->client->databases()->find($databaseId);
        $pages = $this->client->databases()->queryAllPages($database);

        return array_map(fn (Page $page) => $this->simplifyPage($page), $pages);
    }

    /**
     * يقبل معرف القاعدة بأي صيغة: معرف خام، رابط Notion كامل، أو معرف بلاحقة ?v=
     * ويعيد المعرف الصافي بصيغة UUID.
     */
    private function normalizeDatabaseId(?string $id): ?string
    {
        if (!$id) {
            return null;
        }

        // رابط كامل: خذ آخر جزء من المسار (صيغة "اسم-الصفحة-<id>")
        if (str_contains($id, '/')) {
            $id = basename(parse_url($id, PHP_URL_PATH) ?? $id);
        }

        // أزل معرف العرض (?v=...) وأي معاملات
        $id = explode('?', trim($id))[0];

        if (preg_match('/([0-9a-f]{32})$/i', str_replace('-', '', $id), $m)) {
            $clean = strtolower($m[1]);
            return sprintf(
                '%s-%s-%s-%s-%s',
                substr($clean, 0, 8),
                substr($clean, 8, 4),
                substr($clean, 12, 4),
                substr($clean, 16, 4),
                substr($clean, 20)
            );
        }

        return $id;
    }

    /**
     * ملفات صفحة Notion (تُجلب طازجة لأن روابط S3 الموقعة تنتهي خلال ساعة).
     *
     * @return array<int, array{name: string, url: string}>
     */
    public function pageFiles(string $pageId): array
    {
        $page = $this->client->pages()->find($pageId);

        return $this->extractFiles($page->toArray()['properties'] ?? []);
    }

    /**
     * استخراج كل الملفات من خصائص من نوع files.
     *
     * @return array<int, array{name: string, url: string}>
     */
    private function extractFiles(array $properties): array
    {
        $files = [];
        foreach ($properties as $property) {
            if (($property['type'] ?? null) !== 'files') {
                continue;
            }
            foreach ($property['files'] ?? [] as $f) {
                $url = $f['file']['url'] ?? $f['external']['url'] ?? null;
                if ($url) {
                    $files[] = ['name' => $f['name'] ?? 'file', 'url' => $url];
                }
            }
        }

        return $files;
    }

    /**
     * تحويل صفحة Notion إلى صف مسطح: المعرف والرابط وكل الخصائص كقيم بسيطة.
     *
     * @return array<string, mixed>
     */
    private function simplifyPage(Page $page): array
    {
        $row = [
            'notion_id' => $page->id,
            'url' => $page->url,
            'created_time' => $page->createdTime->format('Y-m-d H:i:s'),
            'last_edited_time' => $page->lastEditedTime->format('Y-m-d H:i:s'),
        ];

        $raw = $page->toArray()['properties'] ?? [];
        $title = '';
        foreach ($raw as $name => $property) {
            $row[$name] = $this->simplifyProperty($property);
            if (($property['type'] ?? null) === 'title' && is_string($row[$name])) {
                $title = $row[$name];
            }
        }

        // حقول مساعدة للواجهة: عدد الملفات وأسماؤها + عنوان افتراضي للتسمية
        $row['_files'] = $this->extractFiles($raw);
        $row['_title'] = $title;

        return $row;
    }

    /**
     * تبسيط خاصية Notion الخام (JSON) إلى قيمة نصية/رقمية.
     */
    private function simplifyProperty(array $property): mixed
    {
        $type = $property['type'] ?? null;
        $value = $property[$type] ?? null;

        return match ($type) {
            'title', 'rich_text' => implode('', array_map(
                fn ($t) => $t['plain_text'] ?? '',
                is_array($value) ? $value : []
            )),
            'number', 'checkbox', 'url', 'email', 'phone_number' => $value,
            'select', 'status' => $value['name'] ?? null,
            'multi_select' => array_map(fn ($o) => $o['name'] ?? '', is_array($value) ? $value : []),
            'date' => $value['start'] ?? null,
            'people' => array_map(fn ($p) => $p['name'] ?? ($p['id'] ?? ''), is_array($value) ? $value : []),
            'files' => array_map(
                fn ($f) => $f['file']['url'] ?? $f['external']['url'] ?? ($f['name'] ?? ''),
                is_array($value) ? $value : []
            ),
            'relation' => array_map(fn ($r) => $r['id'] ?? '', is_array($value) ? $value : []),
            'formula' => $value[$value['type'] ?? ''] ?? null,
            'created_time', 'last_edited_time' => $value,
            default => $value,
        };
    }
}
