<?php

namespace App\Notifications;

use App\Models\ArchiveDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DocumentExpiringNotification extends Notification
{
    use Queueable;

    public function __construct(
        public ArchiveDocument $document,
        public int $daysUntilExpiry
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'document_id' => $this->document->id,
            'document_title' => $this->document->title,
            'document_number' => $this->document->document_number,
            'sector_name' => $this->document->sector?->name,
            'days_remaining' => $this->daysUntilExpiry,
            'expiry_date' => $this->document->expiry_date?->format('Y-m-d'),
            'type' => $this->daysUntilExpiry <= 0 ? 'expired' : 'expiring',
            'title' => $this->daysUntilExpiry <= 0
                ? "انتهت صلاحية المستند"
                : "المستند ينتهي خلال {$this->daysUntilExpiry} يوم",
            'url' => "/archive/documents/{$this->document->id}",
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}
