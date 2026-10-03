"""Bundle the reviewed static assets into one offline HTML file."""
from pathlib import Path

root = Path(__file__).resolve().parent
dist = root / 'dist'
html = (dist / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">',
                    '<style>' + (dist / 'style.css').read_text(encoding='utf-8') + '</style>')
for name in ('data.js', 'engine.js', 'ui-model.js', 'audit-data.js', 'app.js'):
    code = (dist / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}"></script>', '<script>' + code + '</script>')
output = root.parent / 'Traveller-Vehicle-Builder.html'
output.write_text(html, encoding='utf-8')
assert '<script src=' not in html and 'href="style.css"' not in html
print(f'Created {output.name} ({output.stat().st_size:,} bytes)')
