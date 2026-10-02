"""get_ad adapter inspired by wydii/leboncoin-mcp (MIT).

Uses the chrome_android setting documented by BPiroga/leboncoin-mcp.
The user authorized this browser transport after the plain transport failed.
No proxy or retries; blocked requests retain the manual fallback.
"""
import json
import os
import urllib.error
import urllib.request


class ImportFailure(Exception):
    def __init__(self, code, status=503):
        self.code, self.status = code, status
        super().__init__(code)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_api(method, url, payload=None, max_retries=-1):
    # Fixed endpoint assembled by lbc.get_ad. No proxy, cookies, impersonation,
    # authentication material, HTML, challenge solver or automatic retries.
    import re
    if method != 'GET' or not re.fullmatch(r'https://api\.leboncoin\.fr/api/adfinder/v1/classified/[1-9]\d{0,19}', url):
        raise ImportFailure('LEBONCOIN_IMPORT_FAILED')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'PredictSCI/1.0 (listing data import)'})
    try:
        with opener.open(request, timeout=6) as response:
            if response.headers.get_content_type() != 'application/json':
                raise ImportFailure('LEBONCOIN_IMPORT_FAILED')
            body = response.read(1_000_001)
            if len(body) > 1_000_000:
                raise ImportFailure('LEBONCOIN_IMPORT_FAILED')
            return json.loads(body)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403, 429):
            raise ImportFailure('MANUAL_IMPORT_REQUIRED', 403) from None
        if error.code in (404, 410):
            raise ImportFailure('LEBONCOIN_LISTING_NOT_FOUND', 404) from None
        raise ImportFailure('LEBONCOIN_SERVICE_UNAVAILABLE') from None
    except (OSError, ValueError):
        raise ImportFailure('LEBONCOIN_SERVICE_UNAVAILABLE') from None


def get_ad(ad_id):
    try:
        import lbc

        class PlainClient(lbc.Client):
            def __init__(self):
                # Intentionally skip Client.__init__ and SessionMixin entirely.
                pass

            def _fetch(self, method, url, payload=None, max_retries=-1):
                return fetch_api(method, url, payload, max_retries)

        if os.environ.get('LEBONCOIN_TRANSPORT') == 'plain':
            ad = PlainClient().get_ad(ad_id)
        else:
            # Bound the cookie initialization request too (lbc otherwise omits
            # a timeout there). No account cookies are read from the computer.
            class BrowserClient(lbc.Client):
                def _init_session(self, proxy=None, impersonate=None, request_verify=True):
                    from curl_cffi import requests
                    session = requests.Session(impersonate='chrome_android', trust_env=False)
                    session.headers.update({'User-Agent': self._generate_user_agent(),
                                            'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors',
                                            'Sec-Fetch-Site': 'same-site'})
                    try:
                        response = session.post('https://api.leboncoin.fr/finder/search',
                                               json={'filters': {}, 'limit': 1, 'limit_alu': 0,
                                                     'offset': 0, 'disable_total': True,
                                                     'extend': False, 'listing_source': 'direct-search'}, timeout=3,
                                               verify=True, allow_redirects=False)
                        if response.status_code in (401, 403, 429):
                            raise ImportFailure('MANUAL_IMPORT_REQUIRED', 403)
                        if not response.ok:
                            raise ImportFailure('LEBONCOIN_SERVICE_UNAVAILABLE')
                        return session
                    except Exception:
                        session.close()
                        raise

            client = BrowserClient(impersonate='chrome_android', timeout=3, max_retries=0)
            try:
                ad = client.get_ad(ad_id)
            except lbc.exceptions.DatadomeError:
                raise ImportFailure('MANUAL_IMPORT_REQUIRED', 403) from None
            except lbc.exceptions.NotFoundError:
                raise ImportFailure('LEBONCOIN_LISTING_NOT_FOUND', 404) from None
            finally:
                client.session.close()
        loc = ad.location
        # Preserve stable keys AND labels so normalization is independent of UI language.
        entries = ad.attributes.values() if isinstance(ad.attributes, dict) else ad.attributes
        attributes = [{'key': a.key, 'key_label': a.key_label,
                       'value': a.value if a.value is not None else a.values,
                       'value_label': a.value_label} for a in entries]
        return {'id': str(ad.id), 'title': ad.subject, 'price': ad.price,
                'body': ad.body, 'images': ad.images or [],
                'first_publication_date': ad.first_publication_date,
                'location': {'city': loc.city_label, 'zipcode': loc.zipcode,
                             'lat': loc.lat, 'lng': loc.lng}, 'attributes': attributes}
    except ImportFailure:
        raise
    except Exception:
        # Library changes, missing dependency and parsing errors have a safe fallback.
        raise ImportFailure('LEBONCOIN_IMPORT_FAILED') from None
