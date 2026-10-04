import type { ReactNode } from 'react';

/**
 * Read-only code view with line numbers (linkable as #L12) and light syntax colouring.
 * The tokenizer is deliberately small: comments, strings, numbers, keywords and keys.
 */

const KEYWORDS: Record<string, string[]> = {
  js: ['import', 'export', 'from', 'default', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'of', 'in', 'new', 'class', 'extends', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'interface', 'type', 'readonly', 'as', 'null', 'undefined', 'true', 'false', 'this', 'break', 'continue', 'switch', 'case', 'void', 'private', 'public', 'static', 'implements', 'enum', 'yield'],
  py: ['def', 'return', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'class', 'with', 'try', 'except', 'finally', 'raise', 'lambda', 'None', 'True', 'False', 'pass', 'yield', 'async', 'await'],
  go: ['package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'nil', 'true', 'false', 'switch', 'case'],
  rs: ['fn', 'let', 'mut', 'pub', 'struct', 'impl', 'enum', 'match', 'if', 'else', 'return', 'use', 'mod', 'self', 'Self', 'true', 'false', 'for', 'in', 'while', 'loop', 'trait', 'where'],
  sh: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'case', 'esac', 'export', 'echo', 'exit', 'function', 'local'],
};

export function languageOf(path: string): string {
  const name = path.split('/').pop() ?? '';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (name.startsWith('.env')) return 'env';
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'js';
  if (['json'].includes(ext)) return 'json';
  if (['py'].includes(ext)) return 'py';
  if (['go'].includes(ext)) return 'go';
  if (['rs'].includes(ext)) return 'rs';
  if (['sh', 'bash', 'zsh'].includes(ext)) return 'sh';
  if (['toml', 'yml', 'yaml', 'ini'].includes(ext)) return 'conf';
  if (['css'].includes(ext)) return 'css';
  if (['md', 'markdown'].includes(ext)) return 'md';
  return 'text';
}

const LANG_NAME: Record<string, string> = { md: 'Markdown', js: 'TypeScript / JavaScript', json: 'JSON', py: 'Python', go: 'Go', rs: 'Rust', sh: 'Shell', conf: 'Config', css: 'CSS', env: 'Environment', text: 'Text' };
export const languageName = (path: string) => {
  const ext = path.split('.').pop();
  if (ext === 'ts' || ext === 'tsx') return 'TypeScript';
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'jsx') return 'JavaScript';
  return LANG_NAME[languageOf(path)];
};

/** Language of a Markdown code fence (```ts, ```sh, ...). */
export function fenceLanguage(tag: string): string {
  const t = tag.toLowerCase();
  return languageOf(`x.${t === 'bash' || t === 'shell' || t === 'zsh' ? 'sh' : t === 'typescript' ? 'ts' : t === 'javascript' ? 'js' : t === 'python' ? 'py' : t || 'txt'}`);
}

export function highlight(line: string, lang: string): ReactNode[] {
  if (lang === 'text' || lang === 'md') return [line];
  const hashComments = ['py', 'sh', 'conf', 'env'].includes(lang);
  const slashComments = ['js', 'go', 'rs', 'css'].includes(lang);
  // env and config files: KEY=value / key = value
  if (lang === 'env' || lang === 'conf') {
    const m = /^(\s*)([A-Za-z_][\w.-]*)(\s*[=:]\s*)(.*)$/.exec(line);
    if (m && !line.trim().startsWith('#')) return [m[1], <span key="k" className="tk-key">{m[2]}</span>, m[3], <span key="v" className="tk-str">{m[4]}</span>];
  }
  const parts: ReactNode[] = [];
  const kw = new Set(KEYWORDS[lang] ?? []);
  const re = new RegExp(
    [
      slashComments ? String.raw`(\/\/.*$|\/\*.*?\*\/)` : hashComments ? String.raw`(#.*$)` : '(?!x)x',
      String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\x60(?:[^\x60\\]|\\.)*\x60)`,
      String.raw`(\b\d[\d_.]*\b)`,
      String.raw`([A-Za-z_$][\w$]*)`,
    ].join('|'),
    'g',
  );
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) parts.push(line.slice(last, m.index));
    const [tok, comment, str, num, word] = m;
    const key = i++;
    if (comment) parts.push(<span key={key} className="tk-com">{tok}</span>);
    else if (str) {
      // JSON object keys get their own colour.
      const isKey = lang === 'json' && /^\s*:/.test(line.slice(m.index! + tok.length));
      parts.push(<span key={key} className={isKey ? 'tk-key' : 'tk-str'}>{tok}</span>);
    } else if (num) parts.push(<span key={key} className="tk-num">{tok}</span>);
    else if (word && kw.has(word)) parts.push(<span key={key} className="tk-kw">{tok}</span>);
    else if (word && /^[A-Z]/.test(word) && lang !== 'json') parts.push(<span key={key} className="tk-type">{tok}</span>);
    else parts.push(tok);
    last = m.index! + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export function CodeView({ path, source }: { path: string; source: string }) {
  const lang = languageOf(path);
  const lines = source.replace(/\n$/, '').split('\n');
  return (
    <div className="code-view" role="region" aria-label={`Contents of ${path}`}>
      <table>
        <tbody>
          {lines.map((l, n) => (
            <tr key={n} id={`L${n + 1}`}>
              <td className="cv-ln"><a href={`#L${n + 1}`} aria-label={`Line ${n + 1}`}>{n + 1}</a></td>
              <td className="cv-code">{l ? highlight(l, lang) : ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
