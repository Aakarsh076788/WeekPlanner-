declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare namespace Cloudflare { interface Env { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; } }
