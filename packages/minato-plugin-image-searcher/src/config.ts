export interface ImageSearcherEngine {
  reduce: number
  limit: number
}

export interface ImageSearcherConfig {
  engines: {
    Ascii2d: ImageSearcherEngine & { flareSolverr: string }
    SauceNAO: ImageSearcherEngine
    Iqdb: ImageSearcherEngine
    TraceMoe: ImageSearcherEngine
    AnimeTrace: ImageSearcherEngine
    TinEye: ImageSearcherEngine
  }

  timeout: number
  in_reply: string
  out_reply: string
  timeout_reply: string
}
