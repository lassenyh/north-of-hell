import type { Deck } from "./model";
export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict?: boolean; error: string };
export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";
/** One in-flight save. Acknowledgements advance version, never replace local content. */
export class SaveQueue {
  document: Deck;
  version: number;
  status: SaveStatus = "saved";
  error = "";
  private generation = 0;
  private savedGeneration = 0;
  private running?: Promise<boolean>;
  constructor(
    document: Deck,
    version: number,
    private save: (document: Deck, version: number) => Promise<SaveResult>,
    private notify: () => void,
  ) {
    this.document = document;
    this.version = version;
  }
  get dirty() {
    return this.generation !== this.savedGeneration;
  }
  edit(document: Deck) {
    this.document = document;
    this.generation++;
    if (this.status !== "conflict" && this.status !== "error")
      this.status = "dirty";
    this.notify();
  }
  flush(retry = false): Promise<boolean> {
    if (this.running) return this.running;
    if (this.status === "conflict" || (this.status === "error" && !retry))
      return Promise.resolve(false);
    // Defer execution until running is assigned, including synchronous test transports.
    this.running = Promise.resolve()
      .then(async () => {
        while (this.dirty) {
          const generation = this.generation;
          const document = this.document;
          this.status = "saving";
          this.error = "";
          this.notify();
          let result: SaveResult;
          try {
            result = await this.save(document, this.version);
          } catch {
            result = {
              ok: false,
              error:
                "Kunne ikke lagre. Endringene finnes fortsatt i denne fanen.",
            };
          }
          if (!result.ok) {
            this.status = result.conflict ? "conflict" : "error";
            this.error = result.error;
            this.notify();
            return false;
          }
          this.version = result.version;
          this.savedGeneration = generation;
        }
        this.status = "saved";
        this.notify();
        return true;
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
}
