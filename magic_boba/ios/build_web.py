#!/usr/bin/env python3
"""Bundle the game (magic_boba/proto) into MagicBoba/Web/index.html for the iOS app.

Runs automatically as an Xcode pre-build step; you can also run it by hand:
    python3 magic_boba/ios/build_web.py
Everything is inlined into one HTML file except the fonts, which live in Web/fonts/ so the app
works fully offline.
"""
import pathlib
import re

here = pathlib.Path(__file__).resolve().parent
proto = here.parent / 'proto'
web = here / 'MagicBoba' / 'Web'

html = (proto / 'play.html').read_text()
fonts = (web / 'fonts' / 'fonts.css').read_text()

# drop the Google Fonts links: the app uses the bundled copies
html = re.sub(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\n?', '', html)
html = html.replace('<style>\n', '<style>\n' + fonts + '\n', 1)
html = html.replace('<title>Magic Boba – Test Levels</title>', '<title>Magic Boba</title>')
html = re.sub(r'<script src="([\w.-]+)"></script>',
              lambda m: '<script>\n' + (proto / m.group(1)).read_text() + '\n</script>', html)
assert '<script src=' not in html and 'fonts.googleapis' not in html

out = web / 'index.html'
if not out.exists() or out.read_text() != html:
    out.write_text(html)
    print(f'wrote {out} ({len(html) // 1024} KB)')
else:
    print('Web/index.html up to date')
