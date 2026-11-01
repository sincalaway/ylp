#!/usr/bin/env python3
"""Import complete public-domain classic texts from zh.wikisource.org into content/books/<slug>/.

Driven by the manifest scripts/wikisource-books.json, so the import is reproducible:

    pip install pypinyin            # optional, for readable chapter file names
    python3 scripts/import-wikisource.py                 # every book in the manifest
    python3 scripts/import-wikisource.py ben-cao-gang-mu-yuanwen nan-jing   # selected books
    WS_CACHE=/tmp/wscache python3 scripts/import-wikisource.py   # cache raw wikitext between runs

Output for each book:
    content/books/<slug>/meta.json        title/author/... + sources [{title,url,revid}] + chapters
    content/books/<slug>/NN-<pinyin>.md   one file per 卷/篇/subpage, front matter `title:` and source

All texts are {{PD-old}} on Wikisource. Body text keeps the characters as they appear on Wikisource
(traditional characters in most editions). Wikitext is converted to Markdown: templates are expanded or
removed, links unwrapped, ctext-style <目录>/<篇名> dumps turned into headings, and hard-wrapped
transcription lines joined back into paragraphs.

四庫全書本 pages ({{SKQS header}}): each source line stays its own paragraph (unpunctuated text is never joined),
{{SK notes|…}} becomes an inline （…） note (a bare 臣 stays plain), {{SK anchor|X}} becomes a heading (its closing
repeat is dropped), {{SKchar|n}}/{{SKchar2|n}} map through scripts/skchar.json / skchar2.json (copied from
Wikisource's Module:SKchar / Module:SKchar2; □ when the module has no character), {{YL|…}} keeps its first
argument, <子部,醫家類,…> and bare 欽定四庫全書 lines are removed, and /全覽 read-all subpages are skipped.

Manifest book fields:
    slug, page (main Wikisource page), meta {title, author, dynasty, category, summary, coverLabel, featured}
    items      optional explicit list: "Page", "Page#Section" or {"page":..., "section":..., "title":...}
    main       "auto" (default) | true | false  - include the main page's own body text
    filter     optional regex a linked subpage title must match
    exclude    optional regex of subpage titles to skip
    split      optional chars threshold above which a page is split at its top-level headings
    mainTitle  chapter title for the main page's own text (default 全文; 四庫全書本 books use 提要)
"""
import hashlib, html, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from pathlib import Path

API = 'https://zh.wikisource.org/w/api.php'
UA = {'User-Agent': 'yuluoping-importer/1.0 (https://github.com/sincalaway/ylp)'}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'content' / 'books'
MANIFEST = Path(__file__).resolve().parent / 'wikisource-books.json'
CACHE = os.environ.get('WS_CACHE')

try:
    from pypinyin import lazy_pinyin
except Exception:  # pragma: no cover
    lazy_pinyin = None

# ---------------------------------------------------------------- fetching

def api(params):
    params = dict(params, format='json', formatversion=2)
    url = f'{API}?{urllib.parse.urlencode(params)}'
    for attempt in range(8):
        time.sleep(1.1)  # be polite: at most ~1 request per second
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503):
                time.sleep(10 * (attempt + 1)); continue
            raise
        except Exception:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError('request failed: ' + url)

def _cache_path(title):
    return os.path.join(CACHE, hashlib.md5(title.encode()).hexdigest() + '.json') if CACHE else None

def fetch_many(titles):
    """title -> {'title','revid','text'} or {'title','missing':True}; follows redirects; cached if WS_CACHE."""
    out, need = {}, []
    for t in dict.fromkeys(titles):
        p = _cache_path(t)
        if p and os.path.exists(p):
            out[t] = json.load(open(p, encoding='utf-8'))
        else:
            need.append(t)
    for i in range(0, len(need), 20):
        chunk = need[i:i + 20]
        r = api(dict(action='query', titles='|'.join(chunk), prop='revisions', rvprop='content|ids', rvslots='main', redirects=1))
        q = r['query']
        norm = {n['from']: n['to'] for n in q.get('normalized', [])}
        red = {n['from']: n['to'] for n in q.get('redirects', [])}
        by = {p['title']: p for p in q['pages']}
        for t in chunk:
            t2 = norm.get(t, t); t3 = red.get(t2, t2); pg = by.get(t3, {})
            if 'revisions' not in pg and not pg.get('missing') and not pg.get('invalid'):
                continue  # response truncated; fetched one by one below
            if 'revisions' not in pg:
                d = {'title': t3, 'missing': True}
            else:
                rv = pg['revisions'][0]
                d = {'title': t3, 'revid': rv['revid'], 'text': rv['slots']['main']['content']}
            _store(t, d); out[t] = d
    for t in need:
        if t not in out:
            r = api(dict(action='query', titles=t, prop='revisions', rvprop='content|ids', rvslots='main', redirects=1))
            pg = r['query']['pages'][0]
            if 'revisions' not in pg: d = {'title': pg.get('title', t), 'missing': True}
            else:
                rv = pg['revisions'][0]; d = {'title': pg['title'], 'revid': rv['revid'], 'text': rv['slots']['main']['content']}
            _store(t, d); out[t] = d
    return out

def _store(t, d):
    p = _cache_path(t)
    if p:
        os.makedirs(CACHE, exist_ok=True)
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)

def page_url(t): return 'https://zh.wikisource.org/wiki/' + urllib.parse.quote(t.replace(' ', '_'))

# ---------------------------------------------------------------- wikitext -> text

ANNOT = {'*', '**', '注', '註', '小', '小字', 'small', 'smaller', 'sm', '夾注', '夹注', 'note'}
FIRST_ARG = {'pua', '另', '!', '僻字', 'yl', '專', '专', '署名', 'ruby', 'font', 'color', 'coloured', 'big', 'larger',
             '黑體', '粗體', 'bold', 'b', 'center', 'c', 'right', 'r', 'u', 'ul', 'sup', 'sub', 'lang', 'nowrap',
             '異體', '异体', '僻', '另字', 'ref-label', '加框', 'cjk', 'zh', '補', '补', '改', '衍', 'kai', '楷'}

def _split_args(s):
    args, depth, sq, cur, i = [], 0, 0, [], 0
    while i < len(s):
        if s.startswith('{{', i): depth += 1; cur.append('{{'); i += 2; continue
        if s.startswith('}}', i) and depth: depth -= 1; cur.append('}}'); i += 2; continue
        if s.startswith('[[', i): sq += 1; cur.append('[['); i += 2; continue
        if s.startswith(']]', i) and sq: sq -= 1; cur.append(']]'); i += 2; continue
        if s[i] == '|' and not depth and not sq: args.append(''.join(cur)); cur = []; i += 1; continue
        cur.append(s[i]); i += 1
    args.append(''.join(cur))
    return args

def _positional(args):
    pos, named = [], {}
    for a in args:
        m = re.match(r'^\s*([\w-]+)\s*=(.*)$', a, re.S)
        if m: named[m.group(1)] = m.group(2)
        else: pos.append(a)
    for k in ('1', '2', '3'):
        if k in named: pos.insert(int(k) - 1, named[k])
    return pos

def expand_templates(s, transclude=None, _depth=0):
    out, i = [], 0
    while True:
        j = s.find('{{', i)
        if j < 0: out.append(s[i:]); break
        out.append(s[i:j])
        depth, k = 0, j
        while k < len(s):
            if s.startswith('{{', k): depth += 1; k += 2; continue
            if s.startswith('}}', k):
                depth -= 1; k += 2
                if depth == 0: break
                continue
            k += 1
        inner = s[j + 2:k - 2] if depth == 0 else s[j + 2:]
        out.append(_template(inner, transclude, _depth))
        i = k if depth == 0 else len(s)
    return ''.join(out)

_SKCHAR = None

def skchar(code, table='skchar.json'):
    """四庫全書 {{SKchar|n}} / {{SKchar2|n}}: the character from Wikisource's Module:SKchar(2) table
    (scripts/skchar.json, skchar2.json); □ when the module has no displayable character for that code."""
    global _SKCHAR
    if _SKCHAR is None: _SKCHAR = {}
    if table not in _SKCHAR:
        f = Path(__file__).resolve().parent / table
        _SKCHAR[table] = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    return _SKCHAR[table].get(str(code).strip()) or '□'

SKA = '\x01SKA '  # marks an {{SK anchor}} line until to_lines turns it into a heading
DROPPED = {}  # template name -> count of dropped templates that carried CJK text (import diagnostics)

def _template(inner, transclude, depth):
    args = _split_args(inner)
    name = args[0].strip()
    rest = [expand_templates(a, transclude, depth) for a in args[1:]]
    pos = [p.strip() for p in _positional(rest)]
    low = name.lower()
    # 四庫全書 (SKQS) editions
    if name == 'SK notes':
        t = '，'.join(p for p in pos if p)
        if not t: return ''
        return t if t == '臣' else f'（{t}）'
    if name == 'SK anchor':
        return f'\n{SKA}{pos[0]}\n' if pos and pos[0] else ''
    if name in ('SKchar', 'SKchar2'):
        return skchar(pos[0] if pos else '', 'skchar.json' if name == 'SKchar' else 'skchar2.json')
    if low in ('year link',):
        return pos[0] if pos else ''
    if low in ('quote', 'cbox'):  # block quotation / boxed sub-title: keep the text as its own paragraph
        return '\n' + pos[0] + '\n' if pos and pos[0] else ''
    if name in ('+', 'Sub', 'DL'):
        return '　'.join(p for p in pos if p)
    if name in ('參', '++', 'zh-em'):  # 參: text|editorial gloss; ++: larger type; zh-em: emphasis dots
        return pos[0] if pos else ''
    if name == '批':  # marginal comment
        return f'（{pos[0]}）' if pos and pos[0] else ''
    if name.startswith(':') and transclude and depth < 2:
        return '\n' + expand_templates(strip_header(transclude(name[1:].strip())), transclude, depth + 1) + '\n'
    if name in ANNOT or low in ANNOT:
        if not pos: return ''
        if name == '**' and len(pos) >= 2: return f'{pos[0]}（{pos[1]}）'
        t = '，'.join(p for p in pos if p)
        if not t: return ''
        return t if t[0] in '（(〔[【' else f'（{t}）'
    if name == '?': return '□'
    if low in FIRST_ARG or name in FIRST_ARG:
        return pos[0] if pos else ''
    if any(re.search(r'[\u3400-\u9fff]', p) for p in pos):
        DROPPED[name] = DROPPED.get(name, 0) + 1
    return ''

def strip_header(text):
    return re.sub(r'^\s*\{\{\s*[Hh]eader2?[\s\S]*?\n\}\}', '', text or '', count=1)

def unlink(s):
    s = re.sub(r'\[\[\s*:?\s*(?:File|Image|文件|檔案|档案|圖像|图像|Media|Category|分類|分类)\s*:[^\[\]]*(?:\[\[[^\]]*\]\][^\[\]]*)*\]\]', '', s, flags=re.I)
    def link(m):
        target, _, label = m.group(1).partition('|')
        if label.strip(): return label
        target = re.sub(r'^:?(?:w|wikt|wikipedia|zh|en|ja|s|b|q|n|v)\s*:', '', target.strip(), flags=re.I)
        return target.split('#')[0].split('/')[-1]
    s = re.sub(r'\[\[([^\[\]]*)\]\]', link, s)
    s = re.sub(r'\[(?:https?:)?//[^\s\]]+\s+([^\]]+)\]', r'\1', s)
    s = re.sub(r'\[(?:https?:)?//[^\s\]]+\]', '', s)
    return s

def clean(s, transclude=None):
    s = s.replace('\ufeff', '').replace('\r', '')
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<ref[^>/]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S | re.I)
    s = re.sub(r'<references\s*/?>', '', s, flags=re.I)
    s = expand_templates(s, transclude)
    s = re.sub(r'-\{(?:[^|}]*\|)?([^}]*)\}-', r'\1', s)
    s = re.sub(r'__[A-Z]+__', '', s)
    s = unlink(s)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'</?(?:poem|pre|onlyinclude|includeonly|noinclude|center|div|span|font|small|big|sub|sup|b|i|u|s|p|blockquote|nowiki|section|table|tr|td|th|tbody|references)\b[^>]*>', '', s, flags=re.I)
    s = re.sub(r'</?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?/?>', '', s)
    s = html.unescape(s)
    s = s.replace('\\x', '')
    return s

# ---------------------------------------------------------------- text -> markdown

HEAD = re.compile(r'^(=+)\s*(.+?)\s*\1\s*$')
JUAN = re.compile(r'^(卷[第]?[之]?[一二三四五六七八九十百零〇\d]+[上中下]?(?:之[一二三四五六七八九十]+)?)\s*[\\／/]?\s*(.*)$')
CLOSE = re.compile(r'[。」』）)？！；：︰”’」〕】]$')

def _label_parts(label):
    label = label.strip().strip('\\').strip()
    if not label: return []
    if '\\' in label:
        return [p.strip() for p in label.split('\\') if p.strip()][:2]
    m = JUAN.match(label)
    if m and m.group(2).strip(): return [m.group(1), m.group(2).strip()]
    if m: return [m.group(1)]
    m = re.match(r'^(.{1,8}?[门門])(.+)$', label)
    if m: return [m.group(1), m.group(2)]
    return [label]

def heading_text(t):
    t = re.sub(r"'{2,}", '', t).strip().strip('【】').strip()
    return re.sub(r'\s+', ' ', t)

def to_lines(wikitext, transclude=None, main_book=None, label_re=None):
    """Return a list of markdown lines (headings as '## x', paragraphs as raw lines)."""
    siku = is_siku(wikitext)
    text = strip_header(wikitext)
    if main_book:
        # main page: drop table-of-contents lines that link to the book's own subpages
        keep = []
        for line in text.split('\n'):
            if re.search(r'\[\[\s*(?:/|\.\./|' + re.escape(main_book) + r'/)', line) and len(unlink(clean(line)).strip(' *#:　')) < 60:
                continue
            keep.append(line)
        text = '\n'.join(keep)
    text = clean(text, transclude)
    raw = [l.rstrip() for l in text.split('\n')]
    if siku:
        return siku_lines(raw)
    # ctext/zysj dump without tags: a short label line repeated before every entry
    counts = {}
    for l in raw:
        s = l.strip()
        if 0 < len(s) <= 24 and not CLOSE.search(s): counts[s] = counts.get(s, 0) + 1
    has_tags = any(l.strip().startswith(('<目录>', '<目錄>', '<篇名>')) for l in raw)
    labels = set()
    if not has_tags:
        labels = {s for s, c in counts.items() if c >= 3 and (JUAN.match(s) or re.search(r'[门門部]', s))}
        if label_re:
            labels |= {s for s, c in counts.items() if c >= 2 and re.search(label_re, s)}
        if sum(counts[s] for s in labels) < 10: labels = set()
    lines, cur, expect_entry, skip_section = [], [], False, None
    for raw_line in raw:
        line = raw_line.strip().replace('\u3000\u3000', '\u3000')
        m = HEAD.match(line)
        if m:
            level = len(m.group(1)); title = heading_text(m.group(2))
            if skip_section is not None and level <= skip_section: skip_section = None
            if title in ('目錄', '目录', '目次', '總目', '总目') and main_book is not None:
                skip_section = level; continue
            if skip_section is not None or not title: continue
            lines += ['', '#' * min(max(level, 2), 5) + ' ' + title, '']
            expect_entry = False; continue
        if skip_section is not None: continue
        if re.match(r'^(?:https?://|www\.)\S+$', line): continue
        tag = re.match(r'^<(目录|目錄|篇名)>\s*(.*)$', line)
        if tag or (line in labels):
            if tag and tag.group(1) == '篇名':
                name = heading_text(tag.group(2))
                if name: lines += ['', '#' * min(len(cur) + 2, 4) + ' ' + name, '']
                continue
            parts = _label_parts(tag.group(2) if tag else line)
            if parts and parts != cur[:len(parts)] or len(parts) != len(cur):
                for d, p in enumerate(parts):
                    if d >= len(cur) or cur[d] != p or any(cur[x] != parts[x] for x in range(d)):
                        lines += ['', '#' * (d + 2) + ' ' + p, '']
                cur = parts
            expect_entry = not tag
            continue
        if expect_entry and line:
            expect_entry = False
            if len(line) <= 20 and not re.search(r'[。，：︰∶]', line):
                lines += ['', '#' * min(len(cur) + 2, 4) + ' ' + heading_text(line), '']
                continue
        line = re.sub(r'^(?:内容|內容|属性|屬性)[：:]\s*', '', line)
        line = re.sub(r'^[*#:;]+\s*', '', line)
        if re.fullmatch(r"'''(.+?)'''", line):
            line = '**' + re.sub(r"'{2,}", '', line) + '**'
        else:
            line = re.sub(r"'{2,}", '', line)
        if line.startswith(('{|', '|}', '|-', '|+')): continue
        if line.startswith(('|', '!')): line = re.sub(r'\s*(?:\|\||!!)\s*', '　', line.lstrip('|!').strip())
        if re.fullmatch(r'【[^】]{1,12}】', line): lines += ['', f'**{line}**', '']; continue
        line = line.replace('\\', '\\\\')
        line = re.sub(r'^(\d+)\.', r'\1\\.', line)
        line = re.sub(r'^([>+\-|])', r'\\\1', line)
        lines.append(line)
    return join_lines(lines)

def is_siku(wikitext):
    return bool(re.search(r'\{\{\s*(?:SKQS header|SK anchor)', wikitext or ''))

SIKU_DROP = re.compile(r'^(?:<子部[,，][^>]*>|欽定四庫全書(?:\s+子部[一二三四五六七八九十]+)?|\S{1,20}\s{2,}醫家類)$')

def siku_lines(raw):
    """四庫全書本 pages: one unpunctuated paragraph per source line (never joined), {{SK anchor}} lines
    become headings, the closing repeat of the first anchor and the 欽定四庫全書 / <子部,醫家類,…> lines are
    dropped."""
    def norm(x): return re.sub(r'\s', '', x).replace('巻', '卷').replace('衞', '衛')
    out, first, book = [], None, None
    for raw_line in raw:
        line = raw_line.strip()
        if not line or re.fullmatch(r'[{}|]+', line): continue
        if SIKU_DROP.match(line):
            m = re.match(r'^(\S{1,20})\s{2,}醫家類$', line)
            if m and not book: book = m.group(1)
            continue
        if line.startswith(SKA.strip()):
            title = heading_text(line[len(SKA.strip()):].strip())
            if not title: continue
            if first is None: first = title
            elif norm(title) == norm(first): continue
            out += ['', '## ' + title, '']
            continue
        line = line.replace('\\', '\\\\')
        line = re.sub(r'^(\d+)\.', r'\1\\.', line)
        line = re.sub(r'^([>+\-|*#])', r'\\\1', line)
        out += ['', line]
    # a bare closing title line (e.g. 「傷寒論注釋卷二」 or the book title) at the end of the page
    ends = {norm(x) for x in (first, book) if x}
    while out and out[-1] and not out[-1].startswith('#') and (norm(out[-1]) in ends or (
            book and norm(out[-1]).startswith(norm(book)) and len(norm(out[-1])) <= len(norm(book)) + 6
            and re.search(r'[卷巻]', out[-1][len(book):]))):
        out = out[:-1]
        while out and not out[-1]: out = out[:-1]
    md = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip()
    return md

def join_lines(lines):
    """Join hard-wrapped transcription lines back into paragraphs.

    Wikisource paragraphs are normally one source line each. Some editions (ctext/zysj dumps) are
    hard-wrapped at a fixed width; that width is detected and lines that fill it are joined. Otherwise a
    long line (>=30 chars) that does not end in closing punctuation is a wrap and is joined directly
    (no space between Chinese characters); short lines (recipe names, ingredient lists) keep their own line.
    """
    lens = [len(l) for l in lines if len(l) > 20 and not l.startswith(('#', '**'))]
    width = None
    if len(lens) > 30:
        hist = {}
        for n in lens: hist[n] = hist.get(n, 0) + 1
        n, c = max(hist.items(), key=lambda kv: kv[1])
        if c >= 0.12 * len(lens): width = n
    out, last, frag = [], 0, False
    for line in lines:
        prev = out[-1] if out else ''
        if line and prev and not prev.startswith(('#', '**')) and not line.startswith(('#', '**')):
            # frag: the previous source line was itself a continuation of a wrapped paragraph
            join = not CLOSE.search(prev) and (last >= 30 or (frag and last <= 8))
            if width and not join:
                join = last >= width - 2 or (len(line) <= 3 and not CLOSE.search(prev))
            if join:
                out[-1] = prev + line; last = len(line); frag = True; continue
            out.append('')
        out.append(line); last = len(line); frag = False
    md = '\n'.join(out)
    return re.sub(r'\n{3,}', '\n\n', md).strip()

def sections(md, level):
    """Split md at headings of exactly `level`; returns [(title|None, text)]."""
    parts, title, buf = [], None, []
    prefix = '#' * level + ' '
    for line in md.split('\n'):
        if line.startswith(prefix):
            if buf and ''.join(buf).strip(): parts.append((title, '\n'.join(buf).strip()))
            title, buf = line[len(prefix):].strip(), [line]
        else:
            buf.append(line)
    if buf and ''.join(buf).strip(): parts.append((title, '\n'.join(buf).strip()))
    return parts

def top_level(md, minlv=2):
    for lv in range(minlv, 6):
        if re.search(rf'^{"#" * lv} ', md, re.M): return lv
    return None

def split_big(title, md, threshold, target=60000, minlv=2):
    """Split one converted page into chapters when it is larger than threshold."""
    if len(md) <= threshold: return [(title, md)]
    lv, secs = None, []
    for cand in range(minlv, 6):
        if re.search(rf'^{"#" * cand} ', md, re.M):
            secs = sections(md, cand)
            if len([t for t, _ in secs if t]) > 1: lv = cand; break
    if not lv:
        return chunk_plain(title, md, target)
    sizes = sorted(len(b) for _, b in secs)
    if len(secs) > 20 and sizes[len(sizes) // 2] < 3000 and target > 1:
        # many small entries (herbs, formulas): group them into chapters of roughly `target` chars
        return group_secs(title, secs, target)
    merged = []
    for t, body in secs:
        bare = len(re.sub(r'^#+ .*$|\s', '', body, flags=re.M))
        if merged and (bare < 300 or (t and t == merged[-1][0])):
            pt, pb = merged[-1]; merged[-1] = (pt, pb + '\n\n' + body)
        else:
            merged.append((t or title, body))
    if len(merged) > 1 and len(re.sub(r'^#+ .*$|\s', '', merged[0][1], flags=re.M)) < 300:
        (t0, b0), (t1, b1) = merged[0], merged[1]; merged[0:2] = [(t1, b0 + '\n\n' + b1)]
    out = []
    for t, body in merged:
        if len(body) > 150000:
            out += split_big(t, body, 150000, target, lv + 1)
        else:
            out.append((t, body))
    return out

def group_secs(title, secs, target):
    groups, buf, n = [], [], 0
    for t, body in secs:
        buf.append((t, body)); n += len(body)
        if n >= target:
            groups.append(buf); buf, n = [], 0
    if buf:
        if groups and n < target / 4: groups[-1] += buf
        else: groups.append(buf)
    if len(groups) == 1: return [(title, '\n\n'.join(b for _, b in groups[0]))]
    out = []
    for g in groups:
        names = [t for t, _ in g if t]
        if len(names) == 1: out.append((names[0], '\n\n'.join(b for _, b in g))); continue
        label = f'{names[0]}—{names[-1]}' if len(names) > 1 else title
        generic = title in ('全文', '正文') or not title
        out.append((label if generic or title in label else f'{title}·{label}', '\n\n'.join(b for _, b in g)))
    return out

def chunk_plain(title, md, target):
    paras = md.split('\n\n'); out, buf, n = [], [], 0
    for p in paras:
        buf.append(p); n += len(p)
        if n >= target: out.append('\n\n'.join(buf)); buf, n = [], 0
    if buf: out.append('\n\n'.join(buf))
    nums = '一二三四五六七八九十'
    return [(f'{title}（{nums[i] if i < 10 else i + 1}）' if len(out) > 1 else title, b) for i, b in enumerate(out)]

# ---------------------------------------------------------------- books

def main_links(title, text):
    links, labels = [], {}
    for m in re.finditer(r'\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]', text):
        l = m.group(1).strip().replace('_', ' ')
        if l.startswith('/'): l = title + l.rstrip('/')
        if l.startswith('../'): l = title + '/' + l[3:]
        if l.startswith(title + '/') and l not in links:
            links.append(l)
            lab = re.sub(r"'{2,}|\s+", '', unlink(clean(m.group(2) or ''))).strip()
            if lab: labels[l] = lab
    return links, labels

def slugify(title):
    t = unicodedata.normalize('NFKC', title)
    if lazy_pinyin:
        syl = [s for s in lazy_pinyin(t, errors='ignore') if re.fullmatch(r'[a-z]+', s)]
        s = '-'.join(syl[:6])
    else:
        s = re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
    return s or 'pian'

def import_book(spec):
    slug, main = spec['slug'], spec['page']
    pages = fetch_many([main])
    mp = pages[main]
    if mp.get('missing'): raise SystemExit(f'{slug}: main page missing: {main}')
    main_title = mp['title']
    links, labels = main_links(main_title, mp['text'])
    sources, chapters_raw, used = [], [], set()
    transclude_cache = {}

    def transclude(t):
        if t not in transclude_cache:
            d = fetch_many([t])[t]
            transclude_cache[t] = d.get('text', '')
            if not d.get('missing'): sources.append((d['title'], d['revid']))
        return transclude_cache[t]

    items = spec.get('items')
    if items is None:
        flt = re.compile(spec['filter']) if spec.get('filter') else None
        exc = re.compile(spec['exclude']) if spec.get('exclude') else None
        subs = [l for l in links if (not flt or flt.search(l)) and not (exc and exc.search(l))
                and not re.search(r'/全覽\d*$', l)]  # 四庫全書本 read-all pages duplicate the 卷 subpages
        items = [{'page': s} for s in subs]
        include_main = spec.get('main', 'auto')
        if include_main is True or include_main == 'auto':
            it = {'page': main_title, 'auto': include_main == 'auto'}
            if spec.get('mainItemTitle'): it['title'] = spec['mainItemTitle']
            items = items + [it] if spec.get('mainLast') else [it] + items
    norm_items = []
    for it in items:
        if isinstance(it, str):
            p, _, sec = it.partition('#'); it = {'page': p, 'section': sec or None}
        norm_items.append(it)
    fetched = fetch_many([it['page'] for it in norm_items])
    threshold_single = spec.get('split', 60000)
    for it in norm_items:
        d = fetched[it['page']]
        if d.get('missing'):
            print(f'  ! {slug}: missing page skipped: {it["page"]}', file=sys.stderr); continue
        is_main = d['title'] == main_title
        text = d['text']
        md = to_lines(text, transclude, main_book=main_title if is_main else None, label_re=spec.get('labelRegex'))
        if it.get('section'):
            lv = top_level(md) or 2
            secs = [b for t, b in sections(md, lv) if t == it['section']]
            if not secs: raise SystemExit(f'{slug}: section not found: {it}')
            md = secs[0]
        body = re.sub(r'\s+', '', re.sub(r'^#+ .*$', '', md, flags=re.M))
        if it.get('auto') and len(body) < 300:
            continue
        if not body:
            continue
        if (d['title'], d['revid']) not in sources: sources.append((d['title'], d['revid']))
        if it.get('title'): title = it['title']
        elif it.get('section'): title = it['section']
        elif is_main: title = spec.get('mainTitle', '全文')
        else: title = labels.get(it['page']) or d['title'].split('/', 1)[-1]
        title = re.sub(r'\s+', ' ', title).strip()
        if spec.get('combine'):
            chapters_raw.append((title, md, d['title'], d['revid'])); continue
        thr = threshold_single if is_main or it.get('section') else spec.get('splitSub', 150000)
        for t, part in split_big(title, md, thr, spec.get('target', 60000)):
            chapters_raw.append((t or title, part, d['title'], d['revid']))
    if spec.get('combine') and chapters_raw:
        # many tiny subpages: join them (each under its own heading) and re-split by size
        md = '\n\n'.join(('## ' + t + '\n\n' + re.sub(r'^(#+) ', lambda m: '#' + m.group(1) + ' ', b, flags=re.M)) for t, b, _, _ in chapters_raw)
        first_src = chapters_raw[0]
        chapters_raw = [(t, part, first_src[2], first_src[3]) for t, part in split_big(spec.get('mainTitle', '全文'), md, spec.get('split', 60000), spec.get('target', 60000))]
    if not chapters_raw: raise SystemExit(f'{slug}: no text')
    # strip a leading heading identical to the chapter title (the reader shows it as h1)
    folder = OUT / slug
    folder.mkdir(parents=True, exist_ok=True)
    for f in folder.glob('*.md'): f.unlink()
    width = 3 if len(chapters_raw) > 99 else 2
    nums, seen_titles = '一二三四五六七八九十', {}
    for i, (t, md, src, rev) in enumerate(chapters_raw):
        seen_titles[t] = seen_titles.get(t, 0) + 1
        if seen_titles[t] > 1:
            n = seen_titles[t]; chapters_raw[i] = (f'{t}（{nums[n - 1] if n <= 10 else n}）', md, src, rev)
    meta_chapters, seen, total = [], set(), 0
    for i, (title, md, src, rev) in enumerate(chapters_raw, 1):
        md = re.sub(r'^##+ ' + re.escape(title) + r'\s*\n+', '', md.strip(), count=1).strip()
        md = drop_empty_headings(md)
        base = f'{i:0{width}d}-{slugify(title)}'
        while base in seen: base += '-x'
        seen.add(base)
        heads = [h for h in re.findall(r'^##+ (.+)$', md, re.M)]
        top = [h for h in re.findall(r'^## (.+)$', md, re.M)] or [h for h in re.findall(r'^### (.+)$', md, re.M)]
        chars = len(re.sub(r'\s', '', md))
        total += chars
        fm = {'title': title, 'source': src, 'sourceUrl': page_url(src), 'revid': rev, 'license': 'PD-old'}
        front = '\n'.join(f'{k}: {json.dumps(v, ensure_ascii=False)}' for k, v in fm.items())
        (folder / f'{base}.md').write_text(f'---\n{front}\n---\n\n{md}\n', encoding='utf-8')
        meta_chapters.append({'slug': base, 'title': title, 'chars': chars, 'headings': top[:400] if len(top) <= 400 else top[:400]})
    meta = dict(spec['meta'])
    meta.update({
        'wikisource': main_title,
        'license': 'PD-old（公有领域）',
        'sources': [{'title': t, 'url': page_url(t), 'revid': r} for t, r in sources],
        'chars': total,
        'chapters': meta_chapters,
    })
    (folder / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {slug}: {len(meta_chapters)} chapters, {total} chars')
    return meta

def drop_empty_headings(md):
    lines = md.split('\n'); keep = []
    heads = [(i, len(m.group(1))) for i, l in enumerate(lines) for m in [re.match(r'^(#+) ', l)] if m]
    nxt = {}
    for k, (i, lv) in enumerate(heads):
        nxt[i] = heads[k + 1] if k + 1 < len(heads) else None
    for i, l in enumerate(lines):
        if i in nxt:
            lv = len(re.match(r'^(#+)', l).group(1)); n = nxt[i]
            between = ''.join(lines[i + 1:(n[0] if n else len(lines))]).strip()
            if not between and (n is None or n[1] <= lv): continue
        keep.append(l)
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(keep)).strip()

def main(argv):
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if '--t2s' in argv: write_t2s_map(); return
    want = set(a for a in argv if not a.startswith('-'))
    books = [b for b in manifest['books'] if not want or b['slug'] in want]
    if want - {b['slug'] for b in books}: raise SystemExit(f'unknown slugs: {want - {b["slug"] for b in books}}')
    for b in books:
        import_book(b)
    write_t2s_map()

def write_t2s_map():
    """content/books/_t2s.json: traditional->simplified map for the characters used in book/chapter titles and
    headings, so site search can match a simplified query (人参) against traditional text (人參)."""
    try:
        import opencc  # pip install opencc-python-reimplemented
    except Exception:
        print('opencc not installed; _t2s.json not refreshed', file=sys.stderr); return
    conv = opencc.OpenCC('t2s')
    chars = set()
    for meta_file in OUT.glob('*/meta.json'):
        meta = json.loads(meta_file.read_text(encoding='utf-8'))
        for c in meta.get('chapters', []):
            chars.update(c.get('title', '')); [chars.update(h) for h in c.get('headings', [])]
        chars.update(meta.get('title', '')); chars.update(meta.get('author', ''))
    mapping = {}
    for ch in sorted(chars):
        if '\u3400' <= ch <= '\u9fff' or '\uf900' <= ch <= '\ufaff':
            sc = conv.convert(ch)
            if sc != ch and len(sc) == 1: mapping[ch] = sc
    (OUT / '_t2s.json').write_text(json.dumps(mapping, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'wrote _t2s.json ({len(mapping)} characters)')

if __name__ == '__main__':
    main(sys.argv[1:])
