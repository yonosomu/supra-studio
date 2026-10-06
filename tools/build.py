#!/usr/bin/env python3
"""Build the offline HTML using only Python's standard library."""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
ATTRIBUTION_KEYS = {'sourceAuthor', 'sourceLicense'}


def sanitize_metadata(value):
    """Remove exporter/plugin extras while keeping source credit metadata."""
    if isinstance(value, list):
        return [sanitize_metadata(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if key == 'extras':
            kept = {name: item[name] for name in ATTRIBUTION_KEYS if isinstance(item, dict) and name in item}
            if kept:
                result[key] = kept
        else:
            result[key] = sanitize_metadata(item)
    return result


def sanitize_glb(data: bytes) -> bytes:
    if len(data) < 20:
        raise ValueError('GLB is too short')
    magic, version, total = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or total != len(data):
        raise ValueError('Invalid GLB 2 header')
    chunks = []
    cursor = 12
    json_found = False
    while cursor < len(data):
        if cursor + 8 > len(data):
            raise ValueError('Truncated GLB chunk header')
        size, kind = struct.unpack_from('<II', data, cursor)
        cursor += 8
        if size % 4 or cursor + size > len(data):
            raise ValueError('Invalid GLB chunk size')
        chunk = data[cursor:cursor + size]
        cursor += size
        if kind == 0x4E4F534A:
            if json_found:
                raise ValueError('Multiple GLB JSON chunks')
            json_found = True
            document = sanitize_metadata(json.loads(chunk))
            chunk = json.dumps(document, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode('utf-8')
            chunk += b' ' * (-len(chunk) % 4)
        chunks.append(struct.pack('<II', len(chunk), kind) + chunk)
    if not json_found:
        raise ValueError('GLB JSON chunk missing')
    payload = b''.join(chunks)
    return struct.pack('<III', magic, version, 12 + len(payload)) + payload


def encoded(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode('ascii')


def build(output: Path) -> Path:
    template = (ROOT / 'src' / 'template.html').read_text(encoding='utf-8')
    body = (ROOT / 'src' / 'body.js').read_text(encoding='utf-8')
    model = sanitize_glb((ROOT / 'assets' / 'supra.glb').read_bytes())
    body = body.replace('__MODEL_BASE64__', base64.b64encode(model).decode('ascii'))
    app = (ROOT / 'src' / 'app.js').read_text(encoding='utf-8')
    app = app.replace('__ENGINE_AUDIO_BASE64__', encoded(ROOT / 'assets' / 'engine.mp3'))
    app = app.replace('__TURBO_AUDIO_BASE64__', encoded(ROOT / 'assets' / 'turbo-grain.mp3'))
    replacements = {
        '__THREE_BUNDLE__': (ROOT / 'vendor' / 'three.bundle.min.js').read_text(encoding='utf-8'),
        '__ENGINE_CODE__': (ROOT / 'src' / 'engine.js').read_text(encoding='utf-8'),
        '__CHASSIS_CODE__': (ROOT / 'src' / 'chassis.js').read_text(encoding='utf-8'),
        '__BODY_CODE__': body,
        '__APP_CODE__': app,
    }
    for token, code in replacements.items():
        if template.count(token) != 1:
            raise ValueError(f'Template must contain exactly one {token}')
        template = template.replace(token, code.replace('</script', '<\\/script'))
    for token in ['__MODEL_BASE64__', '__ENGINE_AUDIO_BASE64__', '__TURBO_AUDIO_BASE64__', *replacements]:
        if token in template:
            raise ValueError(f'Unresolved build token: {token}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(template, encoding='utf-8')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'index.html', help='Output HTML path')
    args = parser.parse_args()
    path = build(args.output.resolve())
    print(f'Built {path.name}: {path.stat().st_size} bytes')
