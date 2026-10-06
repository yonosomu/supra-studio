import base64
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class BuildTests(unittest.TestCase):
    def test_build_script_exists(self):
        self.assertTrue((ROOT / 'tools' / 'build.py').is_file(), 'Portable build script missing')

    def test_only_supported_builder_and_model_are_shipped(self):
        self.assertFalse((ROOT / 'scripts' / 'build.py').exists(), 'Obsolete broken builder must not ship')
        self.assertFalse((ROOT / 'assets' / 'supra-body.glb').exists(), 'Redundant model must not ship')

    def test_generated_html_matches_committed_html(self):
        spec = importlib.util.spec_from_file_location('supra_build', ROOT / 'tools' / 'build.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix='supra-build-test-') as folder:
            generated = module.build(Path(folder) / 'index.html')
            self.assertEqual(generated.read_bytes(), (ROOT / 'index.html').read_bytes())

    def test_sanitizer_preserves_binary_and_attribution(self):
        spec = importlib.util.spec_from_file_location('supra_build', ROOT / 'tools' / 'build.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        document = {'asset': {'version': '2.0'}, 'nodes': [{'name': 'hood', 'extras': {'sourceAuthor': 'Lexyc16', 'sourceLicense': 'CC BY-NC 4.0', 'privateMetadata': 'remove-me'}}], 'materials': [{'extras': {'blenderkit': {'unused': True}}}]}
        payload = json.dumps(document).encode()
        payload += b' ' * (-len(payload) % 4)
        binary = b'\x01\x02\x03\x04'
        original = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(payload) + 8 + len(binary)) + struct.pack('<II', len(payload), 0x4E4F534A) + payload + struct.pack('<II', len(binary), 0x004E4942) + binary
        clean = module.sanitize_glb(original)
        length, kind = struct.unpack_from('<II', clean, 12)
        result = json.loads(clean[20:20 + length])
        self.assertEqual(result['nodes'][0]['extras'], {'sourceAuthor': 'Lexyc16', 'sourceLicense': 'CC BY-NC 4.0'})
        self.assertNotIn('extras', result['materials'][0])
        self.assertEqual(clean[20 + length + 8:], binary)
        self.assertEqual(module.sanitize_glb(clean), clean)

if __name__ == '__main__':
    unittest.main()
