---
name: kin-brand-guidelines
description: Applies Kin's official brand colors and typography to any sort of artifact that may benefit from having Kin's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.
license: Complete terms in LICENSE.txt
---
 
ALWAYS fetch the latest brand guidelines using:

```
curl -sf --max-time 10 -w "\n%{http_code}" https://brand.kin.insure/llms.txt
```

Before using the response:
1. Check exit code is 0 (network/TLS success)
2. Parse the last line as the HTTP status code — accept only 200; treat 204, 4xx, 5xx, or anything else as a failure
3. Strip the status line and verify the remaining body is non-empty plain text (not HTML, not JSON, not blank)

If any check fails, skip applying brand guidelines and note that they were unavailable rather than proceeding with partial or malformed content.
