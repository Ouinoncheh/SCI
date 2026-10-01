import sys
import types
import unittest
import urllib.error
from unittest.mock import patch
from adapter import fetch_api, get_ad, ImportFailure


class AdapterTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict('os.environ', {'LEBONCOIN_TRANSPORT': 'plain'})
        env.start()
        self.addCleanup(env.stop)

    def test_refusal_is_not_retried(self):
        for status, code in [(403, 'MANUAL_IMPORT_REQUIRED'), (429, 'MANUAL_IMPORT_REQUIRED'), (404, 'LEBONCOIN_LISTING_NOT_FOUND')]:
            opener = unittest.mock.Mock()
            opener.open.side_effect = urllib.error.HTTPError('https://api.leboncoin.fr', status, 'refused', {}, None)
            with patch('urllib.request.build_opener', return_value=opener):
                with self.assertRaises(ImportFailure) as error:
                    fetch_api('GET', 'https://api.leboncoin.fr/api/adfinder/v1/classified/123')
                self.assertEqual(error.exception.code, code)
                self.assertEqual(opener.open.call_count, 1)

    def test_no_arbitrary_endpoint(self):
        with patch('urllib.request.build_opener') as opener:
            with self.assertRaises(ImportFailure):
                fetch_api('GET', 'https://www.leboncoin.fr/')
            opener.assert_not_called()

    def test_browser_challenge_stops_before_ad_request(self):
        from curl_cffi import requests
        session = unittest.mock.MagicMock()
        session.get.return_value.status_code = 403
        with patch.dict('os.environ', {'LEBONCOIN_TRANSPORT': 'chrome_android'}), patch.object(requests, 'Session', return_value=session):
            with self.assertRaises(ImportFailure) as error:
                get_ad('123')
        self.assertEqual(error.exception.code, 'MANUAL_IMPORT_REQUIRED')
        session.get.assert_called_once()
        session.request.assert_not_called()
        session.close.assert_called_once()

    def test_json_transport_identifies_itself_without_cookies(self):
        from email.message import Message
        headers = Message()
        headers['Content-Type'] = 'application/json'
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.headers = headers
        response.read.return_value = b'{"id":123}'
        opener = unittest.mock.Mock()
        opener.open.return_value = response
        with patch('urllib.request.build_opener', return_value=opener):
            self.assertEqual(fetch_api('GET', 'https://api.leboncoin.fr/api/adfinder/v1/classified/123'), {'id': 123})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_header('User-agent'), 'PredictSCI/1.0 (listing data import)')
        self.assertIsNone(request.get_header('Cookie'))
        self.assertIsNone(request.get_header('Authorization'))

    def test_uses_get_ad_without_default_browser_session(self):
        class FakeClient:
            def __init__(self):
                raise AssertionError('Default client initialization prohibited')

            def get_ad(self, ad_id):
                self._fetch('GET', f'https://api.leboncoin.fr/api/adfinder/v1/classified/{ad_id}')
                return types.SimpleNamespace(id=ad_id, subject='Maison', price=100, body='Description', images=[], first_publication_date=None,
                    attributes=[], location=types.SimpleNamespace(city_label='Rognac', zipcode='13340', lat=None, lng=None))
        with patch.dict(sys.modules, {'lbc': types.SimpleNamespace(Client=FakeClient)}), patch('adapter.fetch_api', return_value={}) as fetch:
            self.assertEqual(get_ad('123')['location']['city'], 'Rognac')
            fetch.assert_called_once()

    def test_installed_lbc_parser_compatibility_without_network(self):
        try:
            import lbc
        except ImportError:
            self.skipTest('Installer requirements.txt pour vérifier le parser réel')
        raw = {'list_id': 123, 'subject': 'Appartement', 'price_cents': 24500000,
               'location': {'city_label': 'Rognac', 'zipcode': '13340'},
               'attributes': [{'key': 'square', 'value': '70'},
                              {'key': 'outside_access', 'values': ['balcony']}],
               'images': {'urls_large': ['https://img.leboncoin.fr/photo.jpg']}}
        with patch('adapter.fetch_api', return_value=raw), patch.object(lbc.Client, '_init_session', side_effect=AssertionError('Forbidden session')):
            result = get_ad('123')
            self.assertEqual(result['id'], '123')
            self.assertEqual(result['price'], 245000)
            self.assertEqual(result['attributes'][1]['value'], ['balcony'])


if __name__ == '__main__':
    unittest.main()
