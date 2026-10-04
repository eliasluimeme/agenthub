export interface ParserOptions {
  delimiter?: string;
  /** Maximum characters in one field. Guards against unterminated quotes eating memory. */
  maxFieldLength?: number;
}

/**
 * Incremental RFC 4180 parser. Feed chunks with `push()`, which returns the rows completed so far,
 * then call `end()`. Handles quoted fields, escaped quotes ("") and LF or CRLF line endings,
 * including a CRLF split across two chunks.
 */
export class CsvParser {
  private field = '';
  private row: string[] = [];
  private quoted = false;
  private quoteSeen = false; // just read a quote while inside a quoted field
  private crSeen = false;
  private readonly delimiter: string;
  private readonly maxFieldLength: number;

  constructor(opts: ParserOptions = {}) {
    this.delimiter = opts.delimiter ?? ',';
    this.maxFieldLength = opts.maxFieldLength ?? 1_000_000;
    if (this.delimiter.length !== 1 || this.delimiter === '"') throw new Error('delimiter must be one character and not a quote');
  }

  push(chunk: string): string[][] {
    const rows: string[][] = [];
    for (const ch of chunk) {
      if (this.crSeen) {
        this.crSeen = false;
        if (ch === '\n') continue;
      }
      if (this.quoted) {
        if (this.quoteSeen) {
          this.quoteSeen = false;
          if (ch === '"') { this.append('"'); continue; }
          this.quoted = false; // closing quote; fall through to handle ch normally
        } else if (ch === '"') { this.quoteSeen = true; continue; }
        else { this.append(ch); continue; }
      }
      if (ch === '"' && this.field === '') this.quoted = true;
      else if (ch === this.delimiter) this.endField();
      else if (ch === '\n' || ch === '\r') {
        this.crSeen = ch === '\r';
        rows.push(this.endRow());
      } else this.append(ch);
    }
    return rows;
  }

  end(): string[][] {
    if (this.quoted && !this.quoteSeen) throw new Error('Unterminated quoted field');
    this.quoted = false;
    this.quoteSeen = false;
    return this.field !== '' || this.row.length > 0 ? [this.endRow()] : [];
  }

  private append(ch: string) {
    if (this.field.length >= this.maxFieldLength) throw new Error(`Field exceeds ${this.maxFieldLength} characters`);
    this.field += ch;
  }

  private endField() {
    this.row.push(this.field);
    this.field = '';
  }

  private endRow() {
    this.endField();
    const row = this.row;
    this.row = [];
    return row;
  }
}
