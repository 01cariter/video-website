# Studio model pricing

Snapshot date: 2026-08-20. Upstream prices and capabilities come from the
[Vercel AI Gateway model API](https://ai-gateway.vercel.sh/v1/models). The
catalog is intentionally versioned in code; Vercel Flags only changes model
availability, markup, minimum credits, and the active Agent model.

## Credit conversion

- 1 credit represents $0.01 of metered value (10,000 USD micros).
- Default model markup: 15,000 basis points (1.5x upstream cost).
- Hard policy floor: 12,500 basis points (1.25x upstream cost).
- A model policy may set a higher per-request minimum.
- All outputs in one request are priced together, then rounded up once:

```text
credits = max(
  minimumCredits,
  ceil(upstreamUsdMicros * markupBps / 100,000,000)
)
```

This keeps the UI estimate and the server-side debit on the same pure pricing
function. Invalid parameters or disabled models are rejected before a provider
request is made.

## Upstream catalog

### Agent

| Model | Input / 1M tokens | Output / 1M tokens |
| --- | ---: | ---: |
| `deepseek/deepseek-v4-flash` | $0.13 | $0.26 |
| `openai/gpt-5.6-luna` | $0.20 ($0.40 long context) | $1.20 ($1.80 long context) |
| `openai/gpt-5.6-terra` | $2.00 ($4.00 long context) | $12.00 ($18.00 long context) |
| `openai/gpt-5.6-sol` | $2.50 ($5.00 long context) | $15.00 ($22.50 long context) |
| `anthropic/claude-sonnet-5` | $2.00 | $10.00 |
| `google/gemini-3.1-pro-preview` | $2.00 ($4.00 long context) | $12.00 ($18.00 long context) |

The Agent model is selected by the `studio-agent-model` enum Flag. Invalid or
disabled values fall back to DeepSeek V4 Flash.

The Agent accepts at most 64 KB of serialized message/canvas input. Its
pre-authorization covers that context across all eight steps, fixed tool
context, up to 120 KB of request-scoped Skill resources, and 2,048 output
tokens per step. On completion, aggregated provider token usage is repriced
per provider call—including the 272K OpenAI and 200,001-token Gemini tier
boundaries—with the same policy, and every unused reserved credit is refunded
idempotently. Text nodes reserve and enforce 1K / 2K / 4K output-token caps for
low / medium / high effort, and price the current UTF-8 prompt with the same
token-rate table.

Completed steps are settled even when the stream errors; only a request that
reaches no billable provider step receives a full refund. The server
independently consumes the Agent stream, so a client disconnect does not cancel
an in-flight provider step before usage is reported.

### Image

| Model | Billable parameters | Gateway cost |
| --- | --- | ---: |
| `xai/grok-imagine-image-2.0` | standard / low; 1K / 2K | $0.06 standard, $0.04 low, $0.08 2K, $0.06 low 2K per image |
| `bytedance/seedream-5.0-pro` | output count | $0.035 per image, plus text input tokens |
| `openai/gpt-image-2` | output dimensions and low / medium / high quality | $5/M text input and $30/M image output tokens; references add image-input tokens |
| `recraft/recraft-v4.1` | raster / vector illustration | $0.035 raster or $0.08 vector per image |
| `google/gemini-3.1-flash-image` | 512 / 1K / 2K / 4K | $0.045 / $0.067 / $0.101 / $0.151 per image, plus language tokens |

Gemini image generation uses the language-model response-modalities contract,
not `generateImage`. Seedream 5 Pro is treated as a single-output model.

Default-policy one-image examples (before any reference-input reserve):

| Model parameters | Credits |
| --- | ---: |
| Grok 1K low / standard | 6 / 9 |
| Grok 2K low / standard | 9 / 12 |
| Seedream | 6 plus negligible prompt-token reserve |
| GPT Image 2 low square / landscape | 1 / 1 plus text input |
| GPT Image 2 medium square / landscape | 8 / 7 plus text input |
| GPT Image 2 high square / landscape | 32 / 25 plus text input |
| Recraft raster / vector | 6 / 12 |
| Gemini 512 / 1K / 2K / 4K | 7 / 11 / 16 / 23 including response reserve |

GPT Image 2 reference dimensions cannot be known for a remote URL before the
provider call. The pre-authorization therefore uses the larger published
high-fidelity input allowance (6,240 image tokens per reference) so a paid
request cannot exceed its reserve.

### Video

| Model | Billable parameters | Gateway cost |
| --- | --- | ---: |
| `bytedance/seedance-2.5` | output pixels, 24 fps, duration, resolution | 480p/720p $10.70/M video tokens; 1080p $11.70/M (no video input) |
| `minimax/minimax-h3` | seconds | $0.13/sec |
| `xai/grok-imagine-video-1.5` | resolution and seconds | $0.08 / $0.14 / $0.25 per sec for 480p / 720p / 1080p |
| `google/veo-3.1-lite-generate-001` | resolution, audio, seconds | 720p $0.03/$0.05; 1080p $0.05/$0.08 per sec, silent/audio |
| `google/veo-3.1-fast-generate-001` | resolution, audio, seconds | 720p/1080p $0.10/$0.15; 4K $0.30/$0.35 per sec, silent/audio |
| `google/veo-3.1-generate-001` | resolution, audio, seconds | 720p/1080p $0.20/$0.40; 4K $0.40/$0.60 per sec, silent/audio |

Seedance 2.5 video tokens are estimated as
`duration * width * height * 24 / 1024`. Its `generateAudio` option is a
top-level video-generation parameter.

Default-policy video formulas shown in credits (the whole clip is aggregated
before rounding):

| Model / parameters | Credits |
| --- | ---: |
| Seedance | `ceil(duration × width × height × 24 / 1024 × rate × 1.5 / 10,000)` |
| MiniMax H3 2K | `ceil(seconds × 19.5)` |
| Grok 480p / 720p / 1080p | `seconds × 12` / `seconds × 21` / `ceil(seconds × 37.5)` |
| Veo Lite 720p silent/audio | `ceil(seconds × 4.5)` / `ceil(seconds × 7.5)` |
| Veo Lite 1080p silent/audio | `ceil(seconds × 7.5)` / `seconds × 12` |
| Veo Fast 720p or 1080p silent/audio | `seconds × 15` / `ceil(seconds × 22.5)` |
| Veo Fast 4K silent/audio | `seconds × 45` / `ceil(seconds × 52.5)` |
| Veo 720p or 1080p silent/audio | `seconds × 30` / `seconds × 60` |
| Veo 4K silent/audio | `seconds × 60` / `seconds × 90` |

## Flag policy shape

The full capability and upstream-price catalog is deliberately not editable
JSON. It is validated and versioned code. The `studio-model-policy` JSON Flag
contains only safe commercial controls, pre-populated for every model:

```json
{
  "xai/grok-imagine-image-2.0": {
    "enabled": true,
    "markupBps": 15000,
    "minimumCredits": 1
  },
  "google/veo-3.1-generate-001": {
    "enabled": true,
    "markupBps": 17500,
    "minimumCredits": 1
  }
}
```

Values below 12,500 basis points are clamped to the 1.25x safety floor.

## Credit packs and margin guardrail

| Pack | Credits | Price | Revenue / credit |
| --- | ---: | ---: | ---: |
| Light | 10 | $0.99 | $0.0990 |
| Start | 100 | $2.99 | $0.0299 |
| Create | 1,000 | $17.99 | $0.01799 |
| Studio | 5,000 | $69.99 | $0.0140 |
| Custom | 100–50,000 | $2.99 for 100, then $0.02/additional credit | $0.0200 marginal |

Custom pricing intentionally stays above the discounted fixed packs: 1,000
custom credits cost $20.99 versus $17.99 in Create; 5,000 custom credits cost
$100.99 versus $69.99 in Studio.

Using Stripe's US domestic-card baseline of 2.9% + $0.30, the Studio pack
nets about $67.66. At the default 1.5x model policy, its maximum modeled
upstream liability is $33.33 (about 50.7% contribution margin after payment
fees, measured against post-fee net revenue, and before infrastructure). Even
at the enforced 1.25x floor, modeled margin remains about 40.9% on that same
net-revenue basis.

Image, video, and text requests use deterministic parameter-rate
pre-authorizations rather than later Gateway-invoice reconciliation. Fixed
image/video tariffs and the Seedance output-token formula are known before
execution; language/image-input usage that cannot be known in advance uses
explicit conservative reserves. Agent requests additionally settle from the
AI SDK's aggregated provider token usage and refund unused reserve.

Welcome credit is 50. The grant remains idempotent, so changing the amount does
not grant an additional balance to existing accounts.
