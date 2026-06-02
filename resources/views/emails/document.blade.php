<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $document->title }}</title>
</head>
<body style="margin:0; padding:0; font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; direction: rtl; text-align: right;">

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 30px 10px;">
        <tr>
            <td align="center">

                <!-- Main Card -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">

                    <!-- Brand Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e2a4a 0%, #243561 50%, #2c3e6e 100%); padding: 35px 30px; text-align: center; position: relative;">
                            <div style="display: inline-block; width: 56px; height: 56px; background-color: #f59e0b; border-radius: 14px; line-height: 56px; margin-bottom: 14px;">
                                <span style="font-size: 28px; color: #ffffff;">📄</span>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">روائس</h1>
                            <p style="margin: 6px 0 0; color: #fcd34d; font-size: 13px; font-weight: 500;">نظام الأرشفة الإلكترونية</p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 35px 35px 20px;">
                            <h2 style="margin: 0 0 12px; color: #1f2937; font-size: 22px; font-weight: 700;">
                                مرحباً 👋
                            </h2>
                            <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.7;">
                                أرسل لك <strong style="color: #1e2a4a;">{{ $senderName }}</strong> المستند التالي من نظام روائس للأرشفة الإلكترونية.
                            </p>
                        </td>
                    </tr>

                    <!-- Document Card -->
                    <tr>
                        <td style="padding: 0 35px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fcd34d; border-radius: 12px; overflow: hidden;">
                                <tr>
                                    <td style="padding: 20px 24px; border-bottom: 1px solid #fcd34d;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td>
                                                    <div style="display: inline-block; padding: 8px 14px; background-color: #1e2a4a; color: #fcd34d; border-radius: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;">
                                                        {{ strtoupper($document->file_extension) }}
                                                    </div>
                                                </td>
                                                <td align="left" style="text-align: left;">
                                                    @if($document->document_number)
                                                    <span style="color: #92400e; font-size: 12px; font-weight: 600;">
                                                        رقم الوثيقة: {{ $document->document_number }}
                                                    </span>
                                                    @endif
                                                </td>
                                            </tr>
                                        </table>
                                        <h3 style="margin: 14px 0 0; color: #1f2937; font-size: 18px; font-weight: 700; line-height: 1.4;">
                                            {{ $document->title }}
                                        </h3>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 18px 24px; background-color: rgba(255,255,255,0.6);">
                                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                                            @if($document->documentType)
                                            <tr>
                                                <td style="padding: 5px 0; color: #78716c; width: 100px;">📋 النوع</td>
                                                <td style="padding: 5px 0; color: #1f2937; font-weight: 600;">{{ $document->documentType->name }}</td>
                                            </tr>
                                            @endif
                                            @if($document->sector)
                                            <tr>
                                                <td style="padding: 5px 0; color: #78716c;">🏢 القطاع</td>
                                                <td style="padding: 5px 0; color: #1f2937; font-weight: 600;">{{ $document->sector->name }}</td>
                                            </tr>
                                            @endif
                                            @if($document->issuing_entity)
                                            <tr>
                                                <td style="padding: 5px 0; color: #78716c;">🏛️ الجهة المصدرة</td>
                                                <td style="padding: 5px 0; color: #1f2937; font-weight: 600;">{{ $document->issuing_entity }}</td>
                                            </tr>
                                            @endif
                                            @if($document->issue_date)
                                            <tr>
                                                <td style="padding: 5px 0; color: #78716c;">📅 تاريخ الإصدار</td>
                                                <td style="padding: 5px 0; color: #1f2937; font-weight: 600;" dir="ltr">{{ $document->issue_date->format('Y-m-d') }}</td>
                                            </tr>
                                            @endif
                                            @if($document->expiry_date)
                                            <tr>
                                                <td style="padding: 5px 0; color: #78716c;">⏰ تاريخ الانتهاء</td>
                                                <td style="padding: 5px 0; color: #b91c1c; font-weight: 700;" dir="ltr">{{ $document->expiry_date->format('Y-m-d') }}</td>
                                            </tr>
                                            @endif
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    @if($note)
                    <!-- Sender Note -->
                    <tr>
                        <td style="padding: 25px 35px 5px;">
                            <div style="border-right: 4px solid #f59e0b; background-color: #fffbeb; padding: 16px 20px; border-radius: 8px;">
                                <p style="margin: 0 0 6px; color: #92400e; font-size: 12px; font-weight: 600;">💬 رسالة المرسل:</p>
                                <p style="margin: 0; color: #451a03; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">{{ $note }}</p>
                            </div>
                        </td>
                    </tr>
                    @endif

                    <!-- Attachment Notice -->
                    <tr>
                        <td style="padding: 25px 35px;">
                            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px 22px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="width: 40px; vertical-align: middle;">
                                            <span style="font-size: 28px;">📎</span>
                                        </td>
                                        <td style="vertical-align: middle; padding-right: 12px;">
                                            <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">المستند مُرفق</p>
                                            <p style="margin: 2px 0 0; color: #3b82f6; font-size: 12px;">{{ $document->file_name }}</p>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 35px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                                هذه الرسالة مُرسلة من <strong style="color: #1e2a4a;">نظام روائس للأرشفة الإلكترونية</strong>
                            </p>
                            <p style="margin: 6px 0 0; color: #9ca3af; font-size: 11px;">
                                © {{ date('Y') }} شركة رواس لتأجير السيارات — المدينة المنورة 🇸🇦
                            </p>
                        </td>
                    </tr>

                </table>

                <!-- Tagline below card -->
                <p style="margin: 20px 0 0; color: #9ca3af; font-size: 11px;">
                    ⚠️ إذا لم تكن المستلم المقصود، يرجى تجاهل هذه الرسالة وعدم الرد عليها.
                </p>

            </td>
        </tr>
    </table>

</body>
</html>
