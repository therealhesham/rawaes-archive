<?php

namespace App\Mail;

use App\Models\ArchiveDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DocumentEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ArchiveDocument $document,
        public string $senderName,
        public ?string $note = null,
        public string $subjectText = ''
    ) {
        $this->subjectText = $subjectText ?: "مستند: {$document->title}";
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectText,
            replyTo: array_filter([
                auth()->user()?->email,
            ]),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.document',
            with: [
                'document' => $this->document,
                'senderName' => $this->senderName,
                'note' => $this->note,
                'appUrl' => config('app.url'),
            ],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromStorageDisk('local', $this->document->file_path)
                ->as($this->document->file_name)
                ->withMime($this->document->mime_type),
        ];
    }
}
